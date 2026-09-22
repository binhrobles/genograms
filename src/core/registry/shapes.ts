import { h } from "../vnode";
import type { Box } from "../geom";
import { personShapes, type PersonShape } from "../registry";

const STROKE = { fill: "white", stroke: "black", "stroke-width": 1.5 } as const;
const bounds = (s: number): Box => ({ x: -s / 2, y: -s / 2, w: s, h: s });

const square: PersonShape = {
  render: (s) => [h("rect", { x: -s / 2, y: -s / 2, width: s, height: s, ...STROKE })],
  bounds,
};

const circle: PersonShape = {
  render: (s) => [h("circle", { cx: 0, cy: 0, r: s / 2, ...STROKE })],
  bounds,
};

const diamond: PersonShape = {
  render: (s) => [
    h("path", { d: `M 0 ${-s / 2} L ${s / 2} 0 L 0 ${s / 2} L ${-s / 2} 0 Z`, ...STROKE }),
    h("text", { x: 0, y: 5, "text-anchor": "middle", "font-size": 14, fill: "black", stroke: "none" }, ["?"]),
  ],
  bounds,
};

personShapes.register("M", square);
personShapes.register("F", circle);
personShapes.register("U", diamond);
