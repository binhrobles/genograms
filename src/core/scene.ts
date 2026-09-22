import type { Diagnostic, GenoDocument, Person } from "./model";
import { h, type VNode } from "./vnode";
import { unionBoxes, expandBox, edgePoint, boxCenter, type Box, type Point } from "./geom";
import { personShapes, decorations, unionLines, emotionalLines, childLinks } from "./registry";

export const PERSON_SIZE = 40;
export const BUS_DROP = 30;
/** Union lines attach slightly below shape center, leaving the center band free for
 *  emotional links between the same pair. */
export const UNION_DROP = 12;

export interface SceneElement {
  id: string;
  kind: "person" | "union" | "child-link" | "emotional" | "annotation";
  bounds: Box; // absolute; hit-test/marquee target
  vnodes: VNode[]; // fully positioned
  selectable: boolean;
  draggable: boolean;
  layoutPos?: [number, number]; // current layout value to write back on drag (attached annotation = offset)
  hitLine?: [Point, Point]; // when set, hit-test along this segment instead of `bounds` (emotional arcs)
}

export interface SceneGraph {
  elements: SceneElement[];
  bbox: Box;
  diagnostics: Diagnostic[];
}

/** View-layer toggles — pure render filters, never part of the document. All default on. */
export interface SceneOptions {
  names?: boolean;
  years?: boolean;
  decorations?: boolean;
  emotional?: boolean;
  annotations?: boolean;
}

export function personPos(doc: GenoDocument, id: string): Point {
  const [x, y] = doc.layout.get(id) ?? [0, 0];
  return { x, y };
}

export interface UnionGeometry {
  a: Point;
  b: Point;
  l: Point; // leftmost partner
  r: Point; // rightmost partner
  sameRow: boolean;
  busY: number; // y where child links attach
  midX: number;
}

/** Union lines connect partners side-to-side on the horizontal plane; when the two sit at
 *  different heights the line elbows through the vertical at midX. Children attach at
 *  (midX-ish, busY) — the horizontal itself when level, the bottom of the elbow otherwise. */
export function unionGeometry(doc: GenoDocument, unionId: string): UnionGeometry | null {
  const u = doc.unions.get(unionId);
  if (!u || u.partners.length !== 2) return null;
  const [pa, pb] = u.partners;
  if (!doc.people.has(pa) || !doc.people.has(pb)) return null;
  const a = personPos(doc, pa);
  const b = personPos(doc, pb);
  const [l, r] = a.x <= b.x ? [a, b] : [b, a];
  const sameRow = Math.abs(a.y - b.y) < 1;
  return { a, b, l, r, sameRow, busY: (sameRow ? a.y : Math.max(a.y, b.y)) + UNION_DROP, midX: (a.x + b.x) / 2 };
}

const label = (x: number, y: number, text: string, anchor = "middle", fill = "black"): VNode =>
  h("text", { x, y, "text-anchor": anchor, "font-size": 12, fill, stroke: "none" }, [text]);

/** Text with a white halo so crossing lines stay legible behind it. */
const haloLabel = (x: number, y: number, text: string, fill = "black"): VNode =>
  h("text", { x, y, "text-anchor": "middle", "font-size": 12, fill, stroke: "white", "stroke-width": 3, "paint-order": "stroke" }, [text]);

/** Override every stroke in a vnode tree (color customization for line styles). */
function recolor(vs: VNode[], color: string): VNode[] {
  return vs.map((v) => ({
    ...v,
    attrs: v.attrs.stroke && v.attrs.stroke !== "none" ? { ...v.attrs, stroke: color } : v.attrs,
    children: v.children?.map((c) => (typeof c === "string" ? c : recolor([c], color)[0])),
  }));
}

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

export function buildScene(doc: GenoDocument, opts: SceneOptions = {}): SceneGraph {
  const show = { names: true, years: true, decorations: true, emotional: true, annotations: true, ...opts };
  const diagnostics: Diagnostic[] = [];
  const warn = (message: string) => diagnostics.push({ severity: "warning", message, range: [0, 0] });
  const lines: SceneElement[] = [];
  const emos: SceneElement[] = [];
  const persons: SceneElement[] = [];
  const notes: SceneElement[] = [];
  const s = PERSON_SIZE;

  const shapeFor = (p: Person) => personShapes.get(p.shape ?? p.sex) ?? personShapes.get(p.sex) ?? personShapes.get("U")!;
  const topOf = (p: Person): number => personPos(doc, p.id).y + shapeFor(p).bounds(s).y;
  const absBox = (id: string): Box => {
    const person = doc.people.get(id)!;
    const b = shapeFor(person).bounds(s);
    const pos = personPos(doc, id);
    return { x: pos.x + b.x, y: pos.y + b.y, w: b.w, h: b.h };
  };

  for (const p of doc.people.values()) {
    const pos = personPos(doc, p.id);
    if (p.shape && !personShapes.get(p.shape)) warn(`unknown shape \`${p.shape}\` on \`${p.id}\``);
    const shape = shapeFor(p);
    const box = shape.bounds(s);
    const under: VNode[] = [];
    const over: VNode[] = [];
    for (const name of show.decorations ? effectiveDecorations(p) : []) {
      const deco = decorations.get(name);
      if (!deco) {
        warn(`unknown decoration \`${name}\` on \`${p.id}\``);
        over.push(label(box.x + box.w, box.y - 4, "⚠", "end", "#c60"));
        continue;
      }
      (deco.layer === "under" ? under : over).push(...deco.render(box, p));
    }
    const texts: VNode[] = [];
    if (p.name && show.names) {
      // name badge: rounded pill under the shape, drawn over any lines passing beneath
      const bw = Math.max(26, p.name.length * 6.8 + 14);
      texts.push(
        h("rect", { x: -bw / 2, y: box.y + box.h + 6, width: bw, height: 17, rx: 8.5, fill: p.badge ?? "white", stroke: p.color ?? "#bbb", "stroke-width": 1 }),
        label(0, box.y + box.h + 18.5, p.name),
      );
    }
    const yrs = show.years ? yearsLabel(p) : null;
    if (yrs) texts.push(haloLabel(0, box.y - 8, yrs));
    persons.push({
      id: p.id,
      kind: "person",
      selectable: true,
      draggable: true,
      layoutPos: doc.layout.get(p.id) ?? [0, 0],
      bounds: { x: pos.x + box.x, y: pos.y + box.y, w: box.w, h: box.h },
      // shape first, then "under" decorations (fills — above the shape's fill,
      // below the "over" marks like ✗ and the index border), then labels
      vnodes: [
        h("g", { transform: `translate(${pos.x}, ${pos.y})` }, [
          ...shape.render(s, { fill: p.fill ?? "white", stroke: p.color ?? "black" }),
          ...under,
          ...over,
          ...texts,
        ]),
      ],
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
    const half = s / 2;
    const ly = g.l.y + UNION_DROP;
    const ry = g.r.y + UNION_DROP;
    const path: Point[] = g.sameRow
      ? [
          { x: g.l.x + half, y: ly },
          { x: g.r.x - half, y: ry },
        ]
      : [
          { x: g.l.x + half, y: ly },
          { x: g.midX, y: ly },
          { x: g.midX, y: ry },
          { x: g.r.x - half, y: ry },
        ];
    const mid: Point = { x: g.midX, y: g.sameRow ? g.busY : (ly + ry) / 2 };
    let vnodes = [...style.renderLine(path), ...(style.renderAdornment?.(mid) ?? [])];
    if (u.color) vnodes = recolor(vnodes, u.color);
    if (u.year != null) vnodes.push(haloLabel(mid.x, mid.y + 16, `${STATUS_PREFIX[u.status] ?? ""} ${u.year}`.trim(), u.color ?? "#444"));
    lines.push({
      id: u.id,
      kind: "union",
      selectable: true,
      draggable: false,
      bounds: g.sameRow
        ? { x: g.l.x + half, y: g.busY - 8, w: Math.max(12, g.r.x - g.l.x - s), h: 16 }
        : { x: g.midX - 8, y: Math.min(ly, ry), w: 16, h: Math.max(12, Math.abs(ry - ly)) },
      vnodes,
    });
  }

  const CHILD_STROKE = { fill: "none", stroke: "black", "stroke-width": 1.2 } as const;
  const polyline = (pts: Point[], extra: Record<string, string | number> = {}): VNode =>
    h("polyline", { points: pts.map((q) => `${q.x},${q.y}`).join(" "), ...CHILD_STROKE, ...extra });
  const linkAttrs = (p: Person): Record<string, string | number> => {
    if (!p.relation) return {};
    const style = childLinks.get(p.relation);
    if (!style) {
      warn(`unknown relation \`${p.relation}\` on \`${p.id}\``);
      return {};
    }
    return style.dash ? { "stroke-dasharray": style.dash } : {};
  };
  const pathElement = (id: string, vnodes: VNode[], pts: Point[]): SceneElement => {
    const xs = pts.map((q) => q.x);
    const ys = pts.map((q) => q.y);
    return {
      id,
      kind: "child-link",
      selectable: false,
      draggable: false,
      bounds: { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) },
      vnodes,
    };
  };

  // group children by parents ref: 1–2 kids get individual drops; 3+ share a
  // single stem out of the union plus a sibling bus that branches to each child
  const byParent = new Map<string, Person[]>();
  for (const p of doc.people.values()) if (p.parents) byParent.set(p.parents, [...(byParent.get(p.parents) ?? []), p]);

  for (const [ref, kids] of byParent) {
    const g = doc.unions.has(ref) ? unionGeometry(doc, ref) : null;
    const par = !g && doc.people.has(ref) ? personPos(doc, ref) : null;
    if (!g && !par) continue; // unresolved ref: validator already errored
    const stem: Point = g ? { x: g.midX, y: g.busY } : { x: par!.x, y: par!.y + s / 2 };

    // twin groups (same `twin` key under the same parents) drop from a shared apex
    const twinGroups = new Map<string, Person[]>();
    const singles: Person[] = [];
    for (const k of kids) {
      if (k.twin) twinGroups.set(k.twin, [...(twinGroups.get(k.twin) ?? []), k]);
      else singles.push(k);
    }
    for (const [key, members] of [...twinGroups]) {
      if (members.length < 2) {
        singles.push(...members);
        twinGroups.delete(key);
      }
    }

    /** Legs from a shared apex to each twin, plus the identical-twin bar. */
    const twinVNodes = (members: Person[], apex: Point): { vnodes: VNode[]; pts: Point[] } => {
      const tips = members.map((m) => ({ p: m, x: personPos(doc, m.id).x, top: topOf(m) }));
      tips.sort((a, b) => a.x - b.x);
      const vnodes = tips.map((t) => polyline([apex, { x: t.x, y: t.top }], linkAttrs(t.p)));
      if (members.every((m) => m.identical)) {
        const mids = tips.map((t) => ({ x: (apex.x + t.x) / 2, y: (apex.y + t.top) / 2 }));
        vnodes.push(polyline([mids[0], mids[mids.length - 1]]));
      }
      return { vnodes, pts: [apex, ...tips.map((t) => ({ x: t.x, y: t.top }))] };
    };

    if (kids.length >= 3) {
      const allTops = kids.map((k) => topOf(k));
      const sibY = Math.min(...allTops) - 30;
      const attach = [
        ...singles.map((k) => personPos(doc, k.id).x),
        ...[...twinGroups.values()].map((ms) => ms.reduce((sum, m) => sum + personPos(doc, m.id).x, 0) / ms.length),
        stem.x,
      ];
      const minX = Math.min(...attach);
      const maxX = Math.max(...attach);
      const vnodes: VNode[] = [
        polyline([stem, { x: stem.x, y: sibY }]),
        polyline([
          { x: minX, y: sibY },
          { x: maxX, y: sibY },
        ]),
      ];
      const pts: Point[] = [stem, { x: minX, y: sibY }, { x: maxX, y: sibY }];
      for (const k of singles) {
        const x = personPos(doc, k.id).x;
        const top = topOf(k);
        vnodes.push(polyline([{ x, y: sibY }, { x, y: top }], linkAttrs(k)));
        pts.push({ x, y: top });
      }
      for (const members of twinGroups.values()) {
        const meanX = members.reduce((sum, m) => sum + personPos(doc, m.id).x, 0) / members.length;
        const tw = twinVNodes(members, { x: meanX, y: sibY });
        vnodes.push(...tw.vnodes);
        pts.push(...tw.pts);
      }
      lines.push(pathElement(`childlink-${ref}`, vnodes, pts));
      continue;
    }

    // fewer than 3 children: a lone twin pair hangs V-style straight off the stem
    if (twinGroups.size === 1 && singles.length === 0) {
      const members = [...twinGroups.values()][0];
      const apexY = Math.min(...members.map((m) => topOf(m))) - 26;
      const apex = { x: stem.x, y: apexY };
      const tw = twinVNodes(members, apex);
      lines.push(pathElement(`childlink-${ref}`, [polyline([stem, apex]), ...tw.vnodes], [stem, ...tw.pts]));
      continue;
    }

    for (const p of singles) {
      const child = personPos(doc, p.id);
      const childTop = topOf(p);
      let path: Point[];
      if (g && g.sameRow && child.x >= g.l.x + s / 2 + 6 && child.x <= g.r.x - s / 2 - 6) {
        path = [
          { x: child.x, y: g.busY },
          { x: child.x, y: childTop },
        ];
      } else {
        const my = (stem.y + childTop) / 2;
        path = [stem, { x: stem.x, y: my }, { x: child.x, y: my }, { x: child.x, y: childTop }];
      }
      lines.push(pathElement(`childlink-${p.id}`, [polyline(path, linkAttrs(p))], path));
    }
  }

  for (const e of show.emotional ? doc.emotional.values() : []) {
    if (e.between.length !== 2 || !e.between.every((id) => doc.people.has(id))) continue;
    let style = emotionalLines.get(e.kind);
    if (!style) {
      warn(`unknown emotional kind \`${e.kind}\` on \`${e.id}\``);
      style = emotionalLines.get("close")!;
    }
    // emotional links connect shape edges at center height; a shared union line sits
    // just below (UNION_DROP), so a married-and-cut-off pair reads as two close connectors
    const ba = absBox(e.between[0]);
    const bb = absBox(e.between[1]);
    let vs = style.render(ba, bb);
    if (e.color) vs = recolor(vs, e.color);
    emos.push({
      id: e.id,
      kind: "emotional",
      selectable: true,
      draggable: false,
      bounds: expandBox(unionBoxes([ba, bb]), 6),
      hitLine: [edgePoint(ba, boxCenter(bb)), edgePoint(bb, boxCenter(ba))],
      vnodes: vs,
    });
  }

  for (const a of show.annotations ? doc.annotations.values() : []) {
    const raw = doc.layout.get(a.id) ?? [0, 0];
    const attached = a.attach != null && doc.people.has(a.attach);
    const base = attached ? personPos(doc, a.attach!) : { x: 0, y: 0 };
    const pos = attached ? { x: base.x + raw[0], y: base.y + raw[1] } : { x: raw[0], y: raw[1] };
    const textLines = a.text.split("\n");
    notes.push({
      id: a.id,
      kind: "annotation",
      selectable: true,
      draggable: true,
      layoutPos: raw,
      bounds: {
        x: pos.x,
        y: pos.y - 10,
        w: Math.max(20, 7 * Math.max(...textLines.map((l) => l.length))),
        h: 6 + 14 * textLines.length,
      },
      vnodes: [
        h(
          "text",
          { x: pos.x, y: pos.y, "text-anchor": "start", "font-size": 12, fill: a.color ?? "#444", stroke: "none" },
          textLines.map((ln, i) => h("tspan", { x: pos.x, dy: i === 0 ? 0 : 14 }, [ln])),
        ),
      ],
    });
  }

  const elements = [...lines, ...emos, ...persons, ...notes];
  const bbox = elements.length ? expandBox(unionBoxes(elements.map((e) => e.bounds)), 40) : { x: 0, y: 0, w: 200, h: 120 };
  return { elements, bbox, diagnostics };
}
