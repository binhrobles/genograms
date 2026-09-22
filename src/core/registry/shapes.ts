import { h } from "../vnode";
import type { Box } from "../geom";
import { personShapes, type PersonShape, type ShapeStyle } from "../registry";

const attrs = (style?: ShapeStyle) => ({
  fill: style?.fill ?? "white",
  stroke: style?.stroke ?? "black",
  "stroke-width": 1.5,
});
const bounds = (s: number): Box => ({ x: -s / 2, y: -s / 2, w: s, h: s });

const square: PersonShape = {
  render: (s, style) => [h("rect", { x: -s / 2, y: -s / 2, width: s, height: s, ...attrs(style) })],
  bounds,
};

const circle: PersonShape = {
  render: (s, style) => [h("circle", { cx: 0, cy: 0, r: s / 2, ...attrs(style) })],
  bounds,
};

const diamond: PersonShape = {
  render: (s, style) => [
    h("path", { d: `M 0 ${-s / 2} L ${s / 2} 0 L 0 ${s / 2} L ${-s / 2} 0 Z`, ...attrs(style) }),
    h("text", { x: 0, y: 5, "text-anchor": "middle", "font-size": 14, fill: style?.stroke ?? "black", stroke: "none" }, ["?"]),
  ],
  bounds,
};

// ── reproductive-event shapes (used via `shape = "..."`, hung off unions like children) ──

/** Pregnancy: open triangle. */
const pregnancy: PersonShape = {
  render: (s, style) => {
    const r = s * 0.35;
    return [h("path", { d: `M 0 ${-r} L ${r} ${r * 0.8} L ${-r} ${r * 0.8} Z`, ...attrs(style) })];
  },
  bounds: (s) => {
    const r = s * 0.35;
    return { x: -r, y: -r, w: 2 * r, h: 2 * r };
  },
};

/** Miscarriage: small solid dot. */
const miscarriage: PersonShape = {
  render: (s, style) => [h("circle", { cx: 0, cy: 0, r: s * 0.16, fill: style?.stroke ?? "black", stroke: "none" })],
  bounds: (s) => {
    const r = s * 0.16;
    return { x: -r, y: -r, w: 2 * r, h: 2 * r };
  },
};

/** Induced abortion: small ✗. */
const abortion: PersonShape = {
  render: (s, style) => {
    const r = s * 0.2;
    const stroke = { stroke: style?.stroke ?? "black", "stroke-width": 1.5 };
    return [h("line", { x1: -r, y1: -r, x2: r, y2: r, ...stroke }), h("line", { x1: -r, y1: r, x2: r, y2: -r, ...stroke })];
  },
  bounds: (s) => {
    const r = s * 0.2;
    return { x: -r, y: -r, w: 2 * r, h: 2 * r };
  },
};

personShapes.register("M", square);
personShapes.register("F", circle);
personShapes.register("U", diamond);
personShapes.register("pregnancy", pregnancy);
personShapes.register("miscarriage", miscarriage);
personShapes.register("abortion", abortion);
