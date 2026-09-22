import { h, type VNode } from "../vnode";
import type { Point } from "../geom";
import { unionLines, type UnionLineStyle } from "../registry";

const pts = (path: Point[]) => path.map((p) => `${p.x},${p.y}`).join(" ");
const base = { fill: "none", stroke: "black", "stroke-width": 1.5 } as const;

const line =
  (dash?: string) =>
  (path: Point[]): VNode[] =>
    [h("polyline", { points: pts(path), ...base, ...(dash ? { "stroke-dasharray": dash } : {}) })];

/** A short slash crossing the bus line. */
const slash = (x: number, y: number): VNode => h("line", { x1: x - 5, y1: y + 9, x2: x + 5, y2: y - 9, stroke: "black", "stroke-width": 1.5 });

const married: UnionLineStyle = { renderLine: line() };
const cohabiting: UnionLineStyle = { renderLine: line("6 4") };
const dating: UnionLineStyle = { renderLine: line("2 4") };
const affair: UnionLineStyle = { renderLine: line("8 3 2 3") }; // dash-dot
const separated: UnionLineStyle = { renderLine: line(), renderAdornment: (m) => [slash(m.x, m.y)] };
const divorced: UnionLineStyle = { renderLine: line(), renderAdornment: (m) => [slash(m.x - 5, m.y), slash(m.x + 5, m.y)] };

unionLines.register("married", married);
unionLines.register("affair", affair);
unionLines.register("cohabiting", cohabiting);
unionLines.register("dating", dating);
unionLines.register("separated", separated);
unionLines.register("divorced", divorced);
