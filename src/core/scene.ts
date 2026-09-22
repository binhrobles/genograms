import type { Diagnostic, GenoDocument, Person } from "./model";
import { h, type VNode } from "./vnode";
import { unionBoxes, expandBox, type Box, type Point } from "./geom";
import { personShapes, decorations, unionLines, emotionalLines } from "./registry";

export const PERSON_SIZE = 40;
export const BUS_DROP = 30;

export interface SceneElement {
  id: string;
  kind: "person" | "union" | "child-link" | "emotional" | "annotation";
  bounds: Box; // absolute; hit-test/marquee target
  vnodes: VNode[]; // fully positioned
  selectable: boolean;
  draggable: boolean;
  layoutPos?: [number, number]; // current layout value to write back on drag (attached annotation = offset)
}

export interface SceneGraph {
  elements: SceneElement[];
  bbox: Box;
  diagnostics: Diagnostic[];
}

export function personPos(doc: GenoDocument, id: string): Point {
  const [x, y] = doc.layout.get(id) ?? [0, 0];
  return { x, y };
}

export function unionGeometry(doc: GenoDocument, unionId: string): { a: Point; b: Point; busY: number; midX: number } | null {
  const u = doc.unions.get(unionId);
  if (!u || u.partners.length !== 2) return null;
  const [pa, pb] = u.partners;
  if (!doc.people.has(pa) || !doc.people.has(pb)) return null;
  const a = personPos(doc, pa);
  const b = personPos(doc, pb);
  const busY = Math.max(a.y, b.y) + PERSON_SIZE / 2 + BUS_DROP;
  return { a, b, busY, midX: (a.x + b.x) / 2 };
}

const label = (x: number, y: number, text: string, anchor = "middle", fill = "black"): VNode =>
  h("text", { x, y, "text-anchor": anchor, "font-size": 12, fill, stroke: "none" }, [text]);

function yearsLabel(p: Person): string | null {
  if (p.birth != null && p.death != null) return `${p.birth}–${p.death}`;
  if (p.birth != null) return `b. ${p.birth}`;
  if (p.death != null) return `d. ${p.death}`;
  return null;
}

const STATUS_PREFIX: Record<string, string> = { married: "m.", divorced: "d.", separated: "s." };

function effectiveDecorations(p: Person): string[] {
  const names: string[] = [];
  if (p.index) names.push("index");
  if (p.death != null && !p.decorations.includes("deceased")) names.push("deceased");
  for (const d of p.decorations) if (!names.includes(d)) names.push(d);
  return names;
}

export function buildScene(doc: GenoDocument): SceneGraph {
  const diagnostics: Diagnostic[] = [];
  const warn = (message: string) => diagnostics.push({ severity: "warning", message, range: [0, 0] });
  const lines: SceneElement[] = [];
  const emos: SceneElement[] = [];
  const persons: SceneElement[] = [];
  const notes: SceneElement[] = [];
  const s = PERSON_SIZE;

  const absBox = (id: string): Box => {
    const p = personPos(doc, id);
    return { x: p.x - s / 2, y: p.y - s / 2, w: s, h: s };
  };

  for (const p of doc.people.values()) {
    const pos = personPos(doc, p.id);
    const shape = personShapes.get(p.sex) ?? personShapes.get("U")!;
    const box = shape.bounds(s);
    const under: VNode[] = [];
    const over: VNode[] = [];
    for (const name of effectiveDecorations(p)) {
      const deco = decorations.get(name);
      if (!deco) {
        warn(`unknown decoration \`${name}\` on \`${p.id}\``);
        over.push(label(box.x + box.w, box.y - 4, "⚠", "end", "#c60"));
        continue;
      }
      (deco.layer === "under" ? under : over).push(...deco.render(box, p));
    }
    const texts: VNode[] = [];
    if (p.name) texts.push(label(0, s / 2 + 16, p.name));
    const yrs = yearsLabel(p);
    if (yrs) texts.push(label(0, -s / 2 - 8, yrs));
    persons.push({
      id: p.id,
      kind: "person",
      selectable: true,
      draggable: true,
      layoutPos: doc.layout.get(p.id) ?? [0, 0],
      bounds: { x: pos.x + box.x, y: pos.y + box.y, w: box.w, h: box.h },
      vnodes: [h("g", { transform: `translate(${pos.x}, ${pos.y})` }, [...under, ...shape.render(s), ...over, ...texts])],
    });
  }

  for (const u of doc.unions.values()) {
    const g = unionGeometry(doc, u.id);
    if (!g) continue;
    let style = unionLines.get(u.status);
    if (!style) {
      warn(`unknown union status \`${u.status}\` on \`${u.id}\``);
      style = unionLines.get("married")!;
    }
    const path: Point[] = [
      { x: g.a.x, y: g.a.y + s / 2 },
      { x: g.a.x, y: g.busY },
      { x: g.b.x, y: g.busY },
      { x: g.b.x, y: g.b.y + s / 2 },
    ];
    const vnodes = [...style.renderLine(path), ...(style.renderAdornment?.({ x: g.midX, y: g.busY }) ?? [])];
    if (u.year != null) vnodes.push(label(g.midX, g.busY + 16, `${STATUS_PREFIX[u.status] ?? ""} ${u.year}`.trim(), "middle", "#444"));
    lines.push({
      id: u.id,
      kind: "union",
      selectable: true,
      draggable: false,
      bounds: { x: Math.min(g.a.x, g.b.x), y: g.busY - 8, w: Math.abs(g.b.x - g.a.x) || 20, h: 16 },
      vnodes,
    });
  }

  for (const p of doc.people.values()) {
    if (!p.parents) continue;
    const child = personPos(doc, p.id);
    const childTop = child.y - s / 2;
    let path: Point[] | null = null;
    const g = doc.unions.has(p.parents) ? unionGeometry(doc, p.parents) : null;
    if (g) {
      const lo = Math.min(g.a.x, g.b.x) + 10;
      const hi = Math.max(g.a.x, g.b.x) - 10;
      if (child.x >= lo && child.x <= hi) {
        path = [
          { x: child.x, y: g.busY },
          { x: child.x, y: childTop },
        ];
      } else {
        const my = (g.busY + childTop) / 2;
        path = [
          { x: g.midX, y: g.busY },
          { x: g.midX, y: my },
          { x: child.x, y: my },
          { x: child.x, y: childTop },
        ];
      }
    } else if (doc.people.has(p.parents)) {
      const par = personPos(doc, p.parents);
      const my = (par.y + s / 2 + childTop) / 2;
      path = [
        { x: par.x, y: par.y + s / 2 },
        { x: par.x, y: my },
        { x: child.x, y: my },
        { x: child.x, y: childTop },
      ];
    }
    if (!path) continue; // unresolved ref: validator already errored
    const xs = path.map((q) => q.x);
    const ys = path.map((q) => q.y);
    lines.push({
      id: `childlink-${p.id}`,
      kind: "child-link",
      selectable: false,
      draggable: false,
      bounds: { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) },
      vnodes: [h("polyline", { points: path.map((q) => `${q.x},${q.y}`).join(" "), fill: "none", stroke: "black", "stroke-width": 1.2 })],
    });
  }

  for (const e of doc.emotional.values()) {
    if (e.between.length !== 2 || !e.between.every((id) => doc.people.has(id))) continue;
    let style = emotionalLines.get(e.kind);
    if (!style) {
      warn(`unknown emotional kind \`${e.kind}\` on \`${e.id}\``);
      style = emotionalLines.get("close")!;
    }
    const ba = absBox(e.between[0]);
    const bb = absBox(e.between[1]);
    emos.push({
      id: e.id,
      kind: "emotional",
      selectable: true,
      draggable: false,
      bounds: expandBox(unionBoxes([ba, bb]), 6),
      vnodes: style.render(ba, bb),
    });
  }

  for (const a of doc.annotations.values()) {
    const raw = doc.layout.get(a.id) ?? [0, 0];
    const attached = a.attach != null && doc.people.has(a.attach);
    const base = attached ? personPos(doc, a.attach!) : { x: 0, y: 0 };
    const pos = attached ? { x: base.x + raw[0], y: base.y + raw[1] } : { x: raw[0], y: raw[1] };
    notes.push({
      id: a.id,
      kind: "annotation",
      selectable: true,
      draggable: true,
      layoutPos: raw,
      bounds: { x: pos.x, y: pos.y - 10, w: Math.max(20, 7 * a.text.length), h: 16 },
      vnodes: [label(pos.x, pos.y, a.text, "start", "#444")],
    });
  }

  const elements = [...lines, ...emos, ...persons, ...notes];
  const bbox = elements.length ? expandBox(unionBoxes(elements.map((e) => e.bounds)), 40) : { x: 0, y: 0, w: 200, h: 120 };
  return { elements, bbox, diagnostics };
}
