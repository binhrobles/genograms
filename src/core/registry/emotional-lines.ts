import { h, type VNode } from "../vnode";
import { boxCenter, edgePoint, offsetParallel, zigzagPath, type Box, type Point } from "../geom";
import { emotionalLines, type EmotionalLineStyle } from "../registry";

function endpoints(from: Box, to: Box): [Point, Point] {
  return [edgePoint(from, boxCenter(to)), edgePoint(to, boxCenter(from))];
}

const seg = (a: Point, b: Point, attrs: Record<string, string | number>): VNode =>
  h("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, fill: "none", "stroke-width": 1.5, ...attrs });

function parallelLines(from: Box, to: Box, offsets: number[], attrs: Record<string, string | number>): VNode[] {
  const [a, b] = endpoints(from, to);
  return offsets.map((o) => {
    const [oa, ob] = offsetParallel(a, b, o);
    return seg(oa, ob, attrs);
  });
}

const GREEN = { stroke: "#2e8b57" };
const RED = { stroke: "#c0392b" };
const GRAY = { stroke: "#888" };

const close: EmotionalLineStyle = { render: (f, t) => parallelLines(f, t, [-2, 2], GREEN) };
const fused: EmotionalLineStyle = { render: (f, t) => parallelLines(f, t, [-4, 0, 4], GREEN) };
const distant: EmotionalLineStyle = { render: (f, t) => parallelLines(f, t, [0], { ...GRAY, "stroke-dasharray": "6 5" }) };

const conflict: EmotionalLineStyle = {
  render: (f, t) => {
    const [a, b] = endpoints(f, t);
    return [h("path", { d: zigzagPath(a, b), fill: "none", "stroke-width": 1.5, ...RED })];
  },
};

const fusedConflict: EmotionalLineStyle = {
  render: (f, t) => {
    const [a, b] = endpoints(f, t);
    return [...parallelLines(f, t, [-5, 5], RED), h("path", { d: zigzagPath(a, b, 4, 12), fill: "none", "stroke-width": 1.5, ...RED })];
  },
};

const cutoff: EmotionalLineStyle = {
  render: (f, t) => {
    const [a, b] = endpoints(f, t);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    const bar = (c: Point): VNode => seg({ x: c.x + nx * 7, y: c.y + ny * 7 }, { x: c.x - nx * 7, y: c.y - ny * 7 }, { stroke: "black" });
    return [seg(a, b, { stroke: "black" }), bar({ x: mid.x - ux * 4, y: mid.y - uy * 4 }), bar({ x: mid.x + ux * 4, y: mid.y + uy * 4 })];
  },
};

emotionalLines.register("close", close);
emotionalLines.register("fused", fused);
emotionalLines.register("conflict", conflict);
emotionalLines.register("fused-conflict", fusedConflict);
emotionalLines.register("cutoff", cutoff);
emotionalLines.register("distant", distant);
