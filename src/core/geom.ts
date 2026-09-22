export interface Point {
  x: number;
  y: number;
}

export interface Box {
  x: number; // top-left
  y: number;
  w: number;
  h: number;
}

export const boxCenter = (b: Box): Point => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

export const expandBox = (b: Box, pad: number): Box => ({ x: b.x - pad, y: b.y - pad, w: b.w + 2 * pad, h: b.h + 2 * pad });

export function unionBoxes(boxes: Box[]): Box {
  if (boxes.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  const x1 = Math.min(...boxes.map((b) => b.x));
  const y1 = Math.min(...boxes.map((b) => b.y));
  const x2 = Math.max(...boxes.map((b) => b.x + b.w));
  const y2 = Math.max(...boxes.map((b) => b.y + b.h));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export function boxesIntersect(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Point on the border of `b` along the segment from its center toward `toward`. */
export function edgePoint(b: Box, toward: Point): Point {
  const c = boxCenter(b);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const tx = dx !== 0 ? b.w / 2 / Math.abs(dx) : Infinity;
  const ty = dy !== 0 ? b.h / 2 / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty);
  return { x: c.x + dx * t, y: c.y + dy * t };
}

export function offsetParallel(a: Point, b: Point, offset: number): [Point, Point] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * offset;
  const ny = (dx / len) * offset;
  return [
    { x: a.x + nx, y: a.y + ny },
    { x: b.x + nx, y: b.y + ny },
  ];
}

export function zigzagPath(a: Point, b: Point, amp = 6, wavelen = 14): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const n = Math.max(2, Math.round(len / wavelen));
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  let d = `M ${a.x} ${a.y}`;
  for (let i = 1; i < n; i++) {
    const t = (len * i) / n;
    const s = i % 2 === 1 ? amp : -amp;
    d += ` L ${round(a.x + ux * t + nx * s)} ${round(a.y + uy * t + ny * s)}`;
  }
  return d + ` L ${b.x} ${b.y}`;
}

const round = (n: number) => Math.round(n * 100) / 100;
