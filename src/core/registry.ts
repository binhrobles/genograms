import type { VNode } from "./vnode";
import type { Point, Box } from "./geom";
import type { Person } from "./model";

export class Registry<T> {
  private items = new Map<string, T>();
  register(name: string, impl: T): void {
    this.items.set(name, impl); // overwrite silently (HMR-friendly)
  }
  get(name: string): T | undefined {
    return this.items.get(name);
  }
  names(): string[] {
    return [...this.items.keys()];
  }
  entries(): Array<[string, T]> {
    return [...this.items.entries()];
  }
}

/** Base shape per sex, drawn centered on the origin. */
export interface PersonShape {
  render(size: number): VNode[];
  bounds(size: number): Box;
}

/** Combinable overlay drawn on/around a person's shape (box is the shape's local bounds). */
export interface Decoration {
  layer: "under" | "over";
  render(box: Box, person: Person): VNode[];
}

/** Family/partnership line style, keyed by union status. */
export interface UnionLineStyle {
  renderLine(path: Point[]): VNode[];
  renderAdornment?(mid: Point): VNode[];
}

/** Emotional relationship line style, keyed by kind. Boxes are absolute person bounds. */
export interface EmotionalLineStyle {
  render(from: Box, to: Box): VNode[];
}

export const personShapes = new Registry<PersonShape>();
export const decorations = new Registry<Decoration>();
export const unionLines = new Registry<UnionLineStyle>();
export const emotionalLines = new Registry<EmotionalLineStyle>();
