import { parseTOML, getStaticTOMLValue, type AST } from "toml-eslint-parser";
import type { Diagnostic, GenoDocument, Person, Sex, Union, EmotionalLink, Annotation } from "./model";
import { validate } from "./validate";

export type ElementKind = "people" | "unions" | "emotional" | "annotations";

export interface FieldLoc {
  key: [number, number];
  value: [number, number];
  kv: [number, number];
}

export interface ElementLoc {
  kind: ElementKind;
  table: [number, number]; // full table: header through last key-value
  header: [number, number]; // the `kind.id` key inside the brackets
  fields: Map<string, FieldLoc>;
}

export interface LayoutLoc {
  table: [number, number];
  entries: Map<string, FieldLoc>;
}

export interface SourceMap {
  elements: Map<string, ElementLoc>;
  layout: LayoutLoc | null;
}

export interface ParseResult {
  ok: boolean; // false only on TOML syntax errors
  doc: GenoDocument | null;
  map: SourceMap | null;
  diagnostics: Diagnostic[];
}

const KINDS: ElementKind[] = ["people", "unions", "emotional", "annotations"];

type Raw = Record<string, unknown>;
const asStr = (v: unknown) => (typeof v === "string" ? v : undefined);
const asStrOrNum = (v: unknown) => (typeof v === "string" || typeof v === "number" ? v : undefined);
const strArray = (v: unknown) => (Array.isArray(v) && v.every((x) => typeof x === "string") ? (v as string[]) : undefined);

function keyName(kv: AST.TOMLKeyValue): string {
  const k = kv.key.keys[0] as { type: string; name?: string; value?: unknown };
  return k.name ?? String(k.value ?? "");
}

function fieldLocs(table: AST.TOMLTable): Map<string, FieldLoc> {
  const out = new Map<string, FieldLoc>();
  for (const kv of table.body) {
    if (kv.type !== "TOMLKeyValue") continue;
    out.set(keyName(kv), { key: [...kv.key.range], value: [...kv.value.range], kv: [...kv.range] });
  }
  return out;
}

export function parseGenogram(text: string): ParseResult {
  let program: AST.TOMLProgram;
  try {
    program = parseTOML(text);
  } catch (e) {
    const err = e as { message?: string; index?: number };
    const at = typeof err.index === "number" ? Math.max(0, Math.min(err.index, text.length)) : 0;
    return {
      ok: false,
      doc: null,
      map: null,
      diagnostics: [{ severity: "error", message: err.message ?? "TOML syntax error", range: [at, Math.min(at + 1, text.length)] }],
    };
  }

  const doc: GenoDocument = { people: new Map(), unions: new Map(), emotional: new Map(), annotations: new Map(), layout: new Map() };
  const map: SourceMap = { elements: new Map(), layout: null };
  const diagnostics: Diagnostic[] = [];
  const warn = (message: string, range: [number, number]) => diagnostics.push({ severity: "warning", message, range });
  const err = (message: string, range: [number, number]) => diagnostics.push({ severity: "error", message, range });

  function take<T>(raw: Raw, fields: Map<string, FieldLoc>, key: string, coerce: (v: unknown) => T | undefined, expected: string): T | undefined {
    if (!(key in raw)) return undefined;
    const got = coerce(raw[key]);
    if (got === undefined) warn(`\`${key}\` must be ${expected}`, fields.get(key)?.value ?? [0, 0]);
    return got;
  }

  const top = program.body[0];
  for (const node of top.body) {
    if (node.type !== "TOMLTable") continue;
    const path = node.resolvedKey.map(String);
    const headerRange: [number, number] = [...node.key.range];
    const tableRange: [number, number] = [...node.range];
    const fields = fieldLocs(node);
    // getStaticTOMLValue nests the table's contents under its full key path — unwrap it
    const raw = (path.reduce<unknown>((acc, k) => (acc as Raw | undefined)?.[k], getStaticTOMLValue(node)) ?? {}) as Raw;

    if (path[0] === "meta" && path.length === 1) {
      doc.title = asStr(raw.title);
    } else if (path[0] === "layout" && path.length === 1) {
      const entries = new Map<string, FieldLoc>();
      for (const [id, loc] of fields) {
        const v = raw[id];
        if (Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === "number")) {
          doc.layout.set(id, [v[0] as number, v[1] as number]);
          entries.set(id, loc);
        } else warn(`layout.${id} must be [x, y] numbers`, loc.value);
      }
      map.layout = { table: tableRange, entries };
    } else if (KINDS.includes(path[0] as ElementKind) && path.length === 2) {
      const kind = path[0] as ElementKind;
      const id = path[1];
      if (map.elements.has(id)) err(`duplicate id \`${id}\``, headerRange);
      map.elements.set(id, { kind, table: tableRange, header: headerRange, fields });
      if (kind === "people") {
        const p: Person = {
          id,
          name: take(raw, fields, "name", asStr, "a string"),
          sex: take(raw, fields, "sex", (v) => (v === "M" || v === "F" || v === "U" ? (v as Sex) : undefined), '"M", "F", or "U"') ?? "U",
          birth: take(raw, fields, "birth", asStrOrNum, "a number or string"),
          death: take(raw, fields, "death", asStrOrNum, "a number or string"),
          index: take(raw, fields, "index", (v) => (typeof v === "boolean" ? v : undefined), "a boolean") ?? false,
          decorations: take(raw, fields, "decorations", strArray, "an array of strings") ?? [],
          notes: take(raw, fields, "notes", asStr, "a string"),
          parents: take(raw, fields, "parents", asStr, "a string id"),
          relation: take(raw, fields, "relation", asStr, "a child-link kind"),
          twin: take(raw, fields, "twin", asStr, "a twin-group key"),
          identical: take(raw, fields, "identical", (v) => (typeof v === "boolean" ? v : undefined), "a boolean") ?? false,
          color: take(raw, fields, "color", asStr, "a color string"),
          fill: take(raw, fields, "fill", asStr, "a color string"),
          badge: take(raw, fields, "badge", asStr, "a color string"),
          shape: take(raw, fields, "shape", asStr, "a shape name"),
        };
        doc.people.set(id, p);
      } else if (kind === "unions") {
        const u: Union = {
          id,
          partners: take(raw, fields, "partners", strArray, "an array of 2 person ids") ?? [],
          status: take(raw, fields, "status", asStr, "a string") ?? "married",
          year: take(raw, fields, "year", asStrOrNum, "a number or string"),
          decorations: take(raw, fields, "decorations", strArray, "an array of strings") ?? [],
          color: take(raw, fields, "color", asStr, "a color string"),
        };
        doc.unions.set(id, u);
      } else if (kind === "emotional") {
        const l: EmotionalLink = {
          id,
          between: take(raw, fields, "between", strArray, "an array of 2 person ids") ?? [],
          kind: take(raw, fields, "kind", asStr, "a string") ?? "close",
          color: take(raw, fields, "color", asStr, "a color string"),
        };
        doc.emotional.set(id, l);
      } else {
        const a: Annotation = {
          id,
          text: take(raw, fields, "text", asStr, "a string") ?? "",
          attach: take(raw, fields, "attach", asStr, "a person id"),
          color: take(raw, fields, "color", asStr, "a color string"),
        };
        doc.annotations.set(id, a);
      }
    } else {
      warn(`unknown table [${path.join(".")}]`, headerRange);
    }
  }

  diagnostics.push(...validate(doc, map));
  return { ok: true, doc, map, diagnostics };
}
