import type { Diagnostic, GenoDocument } from "./model";
import type { SourceMap } from "./parse";

export function validate(doc: GenoDocument, map: SourceMap): Diagnostic[] {
  const out: Diagnostic[] = [];
  const err = (message: string, range: [number, number]) => out.push({ severity: "error", message, range });
  const warn = (message: string, range: [number, number]) => out.push({ severity: "warning", message, range });
  const loc = (id: string, field?: string): [number, number] => {
    const el = map.elements.get(id);
    if (!el) return [0, 0];
    return (field && el.fields.get(field)?.value) || el.header;
  };

  // duplicate ids across kinds (same-kind duplicates are flagged during parse)
  const kinds: Array<[string, Map<string, unknown>]> = [
    ["people", doc.people],
    ["unions", doc.unions],
    ["emotional", doc.emotional],
    ["annotations", doc.annotations],
  ];
  const seen = new Map<string, string>();
  for (const [kind, m] of kinds)
    for (const id of m.keys()) {
      if (seen.has(id)) err(`duplicate id \`${id}\` (used by both ${seen.get(id)} and ${kind})`, loc(id));
      else seen.set(id, kind);
    }

  for (const u of doc.unions.values()) {
    if (u.partners.length !== 2) err(`union \`${u.id}\` must have exactly 2 partners`, loc(u.id, "partners"));
    else if (u.partners[0] === u.partners[1]) err(`union \`${u.id}\` partners must be distinct`, loc(u.id, "partners"));
    for (const p of u.partners) if (!doc.people.has(p)) err(`union \`${u.id}\` references unknown person \`${p}\``, loc(u.id, "partners"));
    for (const cid of u.children ?? []) {
      const c = doc.people.get(cid);
      if (!c) err(`union \`${u.id}\` lists unknown child \`${cid}\``, loc(u.id, "children"));
      else if (c.parents !== u.id) err(`child \`${cid}\` of union \`${u.id}\` already has parents \`${c.parents}\``, loc(u.id, "children"));
    }
  }
  for (const e of doc.emotional.values()) {
    if (e.between.length !== 2) err(`emotional \`${e.id}\` must connect exactly 2 people`, loc(e.id, "between"));
    else if (e.between[0] === e.between[1]) err(`emotional \`${e.id}\` endpoints must be distinct`, loc(e.id, "between"));
    for (const p of e.between) if (!doc.people.has(p)) err(`emotional \`${e.id}\` references unknown person \`${p}\``, loc(e.id, "between"));
  }
  for (const a of doc.annotations.values())
    if (a.attach && !doc.people.has(a.attach)) err(`annotation \`${a.id}\` attaches to unknown person \`${a.attach}\``, loc(a.id, "attach"));
  for (const p of doc.people.values())
    if (p.parents && !doc.unions.has(p.parents) && !doc.people.has(p.parents))
      err(`person \`${p.id}\` has unknown parents ref \`${p.parents}\``, loc(p.id, "parents"));

  // parent cycles: child -> parent persons (a union expands to its partners)
  const parentsOf = (id: string): string[] => {
    const ref = doc.people.get(id)?.parents;
    if (!ref) return [];
    const u = doc.unions.get(ref);
    if (u) return u.partners.filter((x) => doc.people.has(x));
    return doc.people.has(ref) ? [ref] : [];
  };
  const state = new Map<string, "visiting" | "done">();
  const dfs = (id: string): boolean => {
    if (state.get(id) === "visiting") return true;
    if (state.get(id) === "done") return false;
    state.set(id, "visiting");
    const cyc = parentsOf(id).some(dfs);
    state.set(id, "done");
    return cyc;
  };
  for (const p of doc.people.values())
    if (p.parents && state.get(p.id) !== "done" && dfs(p.id)) {
      err(`parents cycle involving \`${p.id}\``, loc(p.id, "parents"));
      break;
    }

  // layout coverage
  for (const id of doc.layout.keys())
    if (!doc.people.has(id) && !doc.annotations.has(id))
      warn(`layout entry \`${id}\` matches no person/annotation`, map.layout?.entries.get(id)?.key ?? [0, 0]);
  for (const [kindName, m] of [["person", doc.people], ["annotation", doc.annotations]] as const)
    for (const id of (m as Map<string, unknown>).keys())
      if (!doc.layout.has(id)) warn(`${kindName} \`${id}\` has no layout entry; defaults to 0,0`, loc(id));

  return out;
}
