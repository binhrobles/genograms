import type { GenoDocument } from "./model";
import type { SourceMap, ElementKind } from "./parse";

export interface TextEdit {
  from: number;
  to: number;
  insert: string;
}

/** Wrap a string to serialize it as a TOML multiline basic string ("""..."""). */
export class Multiline {
  constructor(public readonly value: string) {}
}

export type TomlValue = string | number | boolean | Array<string | number> | Multiline;

export function serializeValue(v: TomlValue): string {
  if (v instanceof Multiline) {
    const body = v.value.replace(/\\/g, "\\\\").replace(/"""/g, '""\\"');
    return `"""\n${body}\n"""`;
  }
  if (Array.isArray(v)) return `[${v.map((x) => serializeValue(x)).join(", ")}]`;
  if (typeof v === "string") return JSON.stringify(v); // JSON escaping is valid for TOML basic strings
  return String(v);
}

/**
 * Apply edits (all ranges relative to the ORIGINAL text). Overlapping edits throw.
 * Same-position inserts keep their array order.
 */
export function applyEdits(text: string, edits: TextEdit[]): string {
  const indexed = edits.map((e, i) => ({ ...e, i }));
  indexed.sort((a, b) => b.from - a.from || b.to - a.to || b.i - a.i);
  for (let k = 0; k + 1 < indexed.length; k++) {
    if (indexed[k].from < indexed[k + 1].to) throw new Error("overlapping edits");
  }
  let out = text;
  for (const e of indexed) out = out.slice(0, e.from) + e.insert + out.slice(e.to);
  return out;
}

const lineStart = (text: string, pos: number) => text.lastIndexOf("\n", pos - 1) + 1;
const lineEndIncl = (text: string, pos: number) => {
  const i = text.indexOf("\n", pos);
  return i === -1 ? text.length : i + 1;
};
/** Expand a span to full lines (including the trailing newline) for clean deletion. */
const lineRange = (text: string, [from, to]: [number, number]): [number, number] => [lineStart(text, from), lineEndIncl(text, to)];

export function setLayoutEntry(text: string, map: SourceMap, id: string, pos: [number, number]): TextEdit[] {
  const val = `[${Math.round(pos[0])}, ${Math.round(pos[1])}]`;
  if (map.layout) {
    const e = map.layout.entries.get(id);
    if (e) return [{ from: e.value[0], to: e.value[1], insert: val }];
    return [{ from: map.layout.table[1], to: map.layout.table[1], insert: `\n${id} = ${val}` }];
  }
  const nl = text.endsWith("\n") || text.length === 0 ? "" : "\n";
  return [{ from: text.length, to: text.length, insert: `${nl}\n[layout]\n${id} = ${val}\n` }];
}

export function setField(text: string, map: SourceMap, id: string, key: string, value: TomlValue): TextEdit[] {
  const el = map.elements.get(id);
  if (!el || el.inline) return []; // inline edge entries have no fields to edit
  const f = el.fields.get(key);
  if (f) return [{ from: f.value[0], to: f.value[1], insert: serializeValue(value) }];
  return [{ from: el.table[1], to: el.table[1], insert: `\n${key} = ${serializeValue(value)}` }];
}

export function removeField(text: string, map: SourceMap, id: string, key: string): TextEdit[] {
  const el = map.elements.get(id);
  if (!el || el.inline) return [];
  const f = el.fields.get(key);
  if (!f) return [];
  const [from, to] = lineRange(text, f.kv);
  return [{ from, to, insert: "" }];
}

/** Delete one item of an inline array, eating an adjacent comma. */
function removeArrayItem(text: string, [from, to]: [number, number]): TextEdit {
  let end = to;
  let i = end;
  while (text[i] === " ") i++;
  if (text[i] === ",") {
    end = i + 1;
    while (text[end] === " ") end++;
  } else {
    let j = from - 1;
    while (j >= 0 && (text[j] === " " || text[j] === "\n")) j--;
    if (text[j] === ",") from = j;
  }
  return { from, to: end, insert: "" };
}

export function appendToArray(text: string, map: SourceMap, id: string, key: string, item: string | number): TextEdit[] {
  const el = map.elements.get(id);
  if (!el || el.inline) return [];
  const f = el.fields.get(key);
  if (!f) return setField(text, map, id, key, [item]);
  const inner = text.slice(f.value[0] + 1, f.value[1] - 1).trim();
  const insert = inner.length ? `, ${serializeValue(item)}` : serializeValue(item);
  return [{ from: f.value[1] - 1, to: f.value[1] - 1, insert }];
}

/** New tables go right below the `after` anchor element when given (keeping related
 *  definitions together), else just above [layout], else at end of file. */
export function addTable(
  text: string,
  map: SourceMap | null,
  kind: ElementKind,
  id: string,
  fields: Record<string, TomlValue>,
  opts?: { after?: string },
): TextEdit[] {
  let body = `[${kind}.${id}]\n`;
  for (const [k, v] of Object.entries(fields)) body += `${k} = ${serializeValue(v)}\n`;
  const anchor = opts?.after ? map?.elements.get(opts.after) : undefined;
  if (anchor) {
    const at = lineEndIncl(text, anchor.table[1]);
    return [{ from: at, to: at, insert: `\n${body}` }];
  }
  if (map?.layout) {
    const at = lineStart(text, map.layout.table[0]);
    return [{ from: at, to: at, insert: body + "\n" }];
  }
  const nl = text.endsWith("\n") || text.length === 0 ? "" : "\n";
  return [{ from: text.length, to: text.length, insert: `${nl}\n${body}` }];
}

/** Drop edits that are exact duplicates or deletions fully contained in another deletion. */
function dedupeEdits(edits: TextEdit[]): TextEdit[] {
  const uniq = new Map<string, TextEdit>();
  for (const e of edits) uniq.set(`${e.from}:${e.to}:${e.insert}`, e);
  const all = [...uniq.values()];
  return all.filter((e) => !all.some((o) => o !== e && o.insert === "" && o.from <= e.from && e.to <= o.to && (o.from < e.from || e.to < o.to)));
}

/** Remove an element plus everything that would dangle: its layout line, unions it partners
 *  in (and those unions' children's `parents` fields), emotional links touching it, and
 *  `attach`/`parents` references to it. Comments directly above removed tables are left in place. */
export function removeElement(text: string, map: SourceMap, doc: GenoDocument, id: string): TextEdit[] {
  const el = map.elements.get(id);
  if (!el) return [];
  const edits: TextEdit[] = [];

  const removeTable = (eid: string) => {
    const loc = map.elements.get(eid);
    if (loc) {
      if (loc.inline) {
        edits.push(removeArrayItem(text, loc.table)); // splice just this edge out of the array
      } else {
        const [from, to] = lineRange(text, loc.table);
        edits.push({ from, to, insert: "" });
      }
    }
    const lay = map.layout?.entries.get(eid);
    if (lay) {
      const [from, to] = lineRange(text, lay.kv);
      edits.push({ from, to, insert: "" });
    }
  };

  removeTable(id);

  if (el.kind === "people") {
    for (const u of doc.unions.values())
      if (u.partners.includes(id)) {
        removeTable(u.id);
        for (const c of doc.people.values()) if (c.parents === u.id) edits.push(...removeField(text, map, c.id, "parents"));
      }
    for (const c of doc.people.values()) if (c.parents === id) edits.push(...removeField(text, map, c.id, "parents"));
    for (const e of doc.emotional.values()) if (e.between.includes(id)) removeTable(e.id);
    for (const a of doc.annotations.values()) if (a.attach === id) edits.push(...removeField(text, map, a.id, "attach"));
  } else if (el.kind === "unions") {
    for (const c of doc.people.values()) if (c.parents === id) edits.push(...removeField(text, map, c.id, "parents"));
  }

  return dedupeEdits(edits);
}

/** Remove several elements at once (cascades included), deduped across overlapping cascades. */
export function removeElements(text: string, map: SourceMap, doc: GenoDocument, ids: string[]): TextEdit[] {
  return dedupeEdits(ids.flatMap((id) => removeElement(text, map, doc, id)));
}

/** Rename an element id everywhere: table header, layout key, and all reference sites. */
export function renameId(text: string, map: SourceMap, doc: GenoDocument, oldId: string, newId: string): TextEdit[] {
  const el = map.elements.get(oldId);
  if (!el) return [];
  const edits: TextEdit[] = [{ from: el.header[0], to: el.header[1], insert: `${el.kind}.${newId}` }];
  const lay = map.layout?.entries.get(oldId);
  if (lay) edits.push({ from: lay.key[0], to: lay.key[1], insert: newId });

  const sub = (arr: string[]) => arr.map((x) => (x === oldId ? newId : x));
  if (el.kind === "people") {
    for (const u of doc.unions.values()) if (u.partners.includes(oldId)) edits.push(...setField(text, map, u.id, "partners", sub(u.partners)));
    for (const c of doc.people.values()) if (c.parents === oldId) edits.push(...setField(text, map, c.id, "parents", newId));
    for (const e of doc.emotional.values())
      if (e.between.includes(oldId)) {
        const loc = map.elements.get(e.id);
        if (loc?.inline) {
          const [from, to] = sub(e.between);
          edits.push({ from: loc.table[0], to: loc.table[1], insert: serializeValue(`${from} ${e.kind} ${to}`) });
        } else {
          edits.push(...setField(text, map, e.id, "between", sub(e.between)));
        }
      }
    for (const a of doc.annotations.values()) if (a.attach === oldId) edits.push(...setField(text, map, a.id, "attach", newId));
  } else if (el.kind === "unions") {
    for (const c of doc.people.values()) if (c.parents === oldId) edits.push(...setField(text, map, c.id, "parents", newId));
  }
  return edits;
}
