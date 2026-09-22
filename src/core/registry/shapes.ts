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

personShapes.register("M", square);
personShapes.register("F", circle);
personShapes.register("U", diamond);
