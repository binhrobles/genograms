import { h, type VNode } from "../vnode";
import { boxCenter, edgePoint, offsetParallel, zigzagPath, wavePath, type Box, type Point } from "../geom";
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
const BLUE = { stroke: "#2a7ab8" };

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

/** Two chevron legs anchored at `b`, pointing back along the a→b direction. */
function arrowLegs(a: Point, b: Point, attrs: Record<string, string | number>): VNode[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const leg = (sign: number): Point => {
    const cos = Math.cos(0.45);
    const sin = Math.sin(0.45) * sign;
    return { x: b.x + 12 * (-ux * cos - -uy * sin), y: b.y + 12 * (-ux * sin + -uy * cos) };
  };
  return [seg(b, leg(1), attrs), seg(b, leg(-1), attrs)];
}

/** Directional: between[0] is the caretaker, the arrow points at the person cared for. */
const caretaker: EmotionalLineStyle = {
  render: (f, t) => {
    const [a, b] = endpoints(f, t);
    return [seg(a, b, BLUE), ...arrowLegs(a, b, BLUE)];
  },
};

const PINK = { stroke: "#d6336c" };
const PURPLE = { stroke: "#6f42c1" };
const DARKRED = { stroke: "#8b1a1a" };
const OCHRE = { stroke: "#b8860b" };

/** Smooth wave — the calm counterpart to conflict's zigzag. */
const harmony: EmotionalLineStyle = {
  render: (f, t) => {
    const [a, b] = endpoints(f, t);
    return [h("path", { d: wavePath(a, b), fill: "none", "stroke-width": 1.5, ...GREEN })];
  },
};

/** Directional: between[0] is fixated ON between[1] — solid dot pinned at the target. */
const fixation: EmotionalLineStyle = {
  render: (f, t) => {
    const [a, b] = endpoints(f, t);
    return [seg(a, b, PURPLE), h("circle", { cx: b.x, cy: b.y, r: 4, fill: PURPLE.stroke, stroke: "none" })];
  },
};

/** Line with a heart at the midpoint. */
const love: EmotionalLineStyle = {
  render: (f, t) => {
    const [a, b] = endpoints(f, t);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    return [
      seg(a, b, PINK),
      h("text", { x: mid.x, y: mid.y + 4, "text-anchor": "middle", "font-size": 12, fill: PINK.stroke, stroke: "white", "stroke-width": 3, "paint-order": "stroke" }, ["♥"]),
    ];
  },
};

/** Directional: between[0] abuses between[1] — zigzag with an arrowhead at the victim. */
const abuse: EmotionalLineStyle = {
  render: (f, t) => {
    const [a, b] = endpoints(f, t);
    return [h("path", { d: zigzagPath(a, b), fill: "none", "stroke-width": 1.5, ...DARKRED }), ...arrowLegs(a, b, DARKRED)];
  },
};

/** Directional: between[0] distrusts between[1] — dashed line, arrow at the distrusted. */
const distrust: EmotionalLineStyle = {
  render: (f, t) => {
    const [a, b] = endpoints(f, t);
    return [seg(a, b, { ...OCHRE, "stroke-dasharray": "8 4" }), ...arrowLegs(a, b, OCHRE)];
  },
};
const indifferent: EmotionalLineStyle = { render: (f, t) => parallelLines(f, t, [0], { stroke: "#aaa", "stroke-dasharray": "2 8" }) };

emotionalLines.register("close", close);
emotionalLines.register("caretaker", caretaker);
emotionalLines.register("fused", fused);
emotionalLines.register("conflict", conflict);
emotionalLines.register("fused-conflict", fusedConflict);
emotionalLines.register("cutoff", cutoff);
emotionalLines.register("distant", distant);
emotionalLines.register("harmony", harmony);
emotionalLines.register("love", love);
emotionalLines.register("fixation", fixation);
emotionalLines.register("abuse", abuse);
emotionalLines.register("distrust", distrust);
emotionalLines.register("indifferent", indifferent);
