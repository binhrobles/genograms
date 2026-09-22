import type { GenoDocument } from "../core/model";
import type { SourceMap } from "../core/parse";
import { addTable, setField, removeField, appendToArray, setLayoutEntry, type TextEdit, type TomlValue } from "../core/surgeon";
import { placePartner, placeChild, placeSibling } from "../core/placement";

export interface Ctx {
  doc: GenoDocument;
  map: SourceMap;
  text: string;
}

const taken = (doc: GenoDocument, id: string) => doc.people.has(id) || doc.unions.has(id) || doc.emotional.has(id) || doc.annotations.has(id);

export function slugify(name: string, doc: GenoDocument): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "person";
  if (!taken(doc, base)) return base;
  let i = 2;
  while (taken(doc, `${base}-${i}`)) i++;
  return `${base}-${i}`;
}

export function addPartner(ctx: Ctx, personId: string, name: string): { edits: TextEdit[]; newId: string } {
  const pid = slugify(name, ctx.doc);
  const pos = placePartner(ctx.doc, personId);
  const person = ctx.doc.people.get(personId);
  const sex: TomlValue = person?.sex === "M" ? "F" : person?.sex === "F" ? "M" : "U";
  const unionId = slugify(`${personId} ${pid}`, ctx.doc);
  return {
    newId: pid,
    edits: [
      ...addTable(ctx.text, ctx.map, "people", pid, { name, sex }),
      ...addTable(ctx.text, ctx.map, "unions", unionId, { partners: [personId, pid], status: "married" }),
      ...setLayoutEntry(ctx.text, ctx.map, pid, pos),
    ],
  };
}

/** `parentId` may be a person or a union. A person with unions defers to their latest union. */
export function addChild(ctx: Ctx, parentId: string, name: string): { edits: TextEdit[]; newId: string } {
  let parentRef = parentId;
  if (ctx.doc.people.has(parentId)) {
    const unions = [...ctx.doc.unions.values()].filter((u) => u.partners.includes(parentId));
    if (unions.length) parentRef = unions[unions.length - 1].id;
  }
  const id = slugify(name, ctx.doc);
  const pos = placeChild(ctx.doc, parentRef);
  return {
    newId: id,
    edits: [...addTable(ctx.text, ctx.map, "people", id, { name, parents: parentRef }), ...setLayoutEntry(ctx.text, ctx.map, id, pos)],
  };
}

export function addSibling(ctx: Ctx, personId: string, name: string): { edits: TextEdit[]; newId: string } | null {
  const person = ctx.doc.people.get(personId);
  if (!person?.parents) return null;
  const id = slugify(name, ctx.doc);
  const pos = placeSibling(ctx.doc, personId);
  return {
    newId: id,
    edits: [...addTable(ctx.text, ctx.map, "people", id, { name, parents: person.parents }), ...setLayoutEntry(ctx.text, ctx.map, id, pos)],
  };
}

export function addEmotional(ctx: Ctx, from: string, to: string, kind: string): { edits: TextEdit[]; newId: string } {
  const id = slugify(`${from} ${to}`, ctx.doc);
  return { newId: id, edits: addTable(ctx.text, ctx.map, "emotional", id, { between: [from, to], kind }) };
}

export function addNote(ctx: Ctx, personId: string, text: string): { edits: TextEdit[]; newId: string } {
  const id = slugify(`note ${personId}`, ctx.doc);
  return {
    newId: id,
    edits: [...addTable(ctx.text, ctx.map, "annotations", id, { text, attach: personId }), ...setLayoutEntry(ctx.text, ctx.map, id, [-24, 48])],
  };
}

export function toggleDeceased(ctx: Ctx, personId: string): TextEdit[] {
  const p = ctx.doc.people.get(personId);
  if (!p) return [];
  const isDeceased = p.death != null || p.decorations.includes("deceased");
  if (!isDeceased) return appendToArray(ctx.text, ctx.map, personId, "decorations", "deceased");
  const edits: TextEdit[] = [];
  if (p.death != null) edits.push(...removeField(ctx.text, ctx.map, personId, "death"));
  if (p.decorations.includes("deceased")) {
    const rest = p.decorations.filter((d) => d !== "deceased");
    edits.push(
      ...(rest.length ? setField(ctx.text, ctx.map, personId, "decorations", rest) : removeField(ctx.text, ctx.map, personId, "decorations")),
    );
  }
  return edits;
}

/** Make this person the index person (clearing any other index flags). */
export function setIndex(ctx: Ctx, personId: string): TextEdit[] {
  const edits: TextEdit[] = [];
  for (const p of ctx.doc.people.values()) if (p.index && p.id !== personId) edits.push(...removeField(ctx.text, ctx.map, p.id, "index"));
  const me = ctx.doc.people.get(personId);
  if (me && !me.index) edits.push(...setField(ctx.text, ctx.map, personId, "index", true));
  return edits;
}

/** The selected elements' TOML tables, for copying to the clipboard. */
export function selectionToTOML(ctx: Ctx, ids: string[]): string {
  const parts: string[] = [];
  for (const id of ids) {
    const el = ctx.map.elements.get(id);
    if (el) parts.push(ctx.text.slice(...el.table));
  }
  return parts.join("\n\n");
}
