import { describe, it, expect } from "vitest";
import { personShapes, decorations, unionLines, emotionalLines, Registry } from "../src/core/registry";
import "../src/core/registry/builtins";
import type { Person } from "../src/core/model";
import type { Box } from "../src/core/geom";

const person = (over: Partial<Person> = {}): Person => ({ id: "p", sex: "M", index: false, decorations: [], ...over });

describe("Registry", () => {
  it("registers, overwrites, lists", () => {
    const r = new Registry<number>();
    r.register("a", 1);
    r.register("a", 2);
    expect(r.get("a")).toBe(2);
    expect(r.names()).toEqual(["a"]);
    expect(r.get("missing")).toBeUndefined();
  });
});

describe("person shapes", () => {
  it("has M, F, U with origin-centered bounds", () => {
    expect(personShapes.names().sort()).toEqual(["F", "M", "U"]);
    for (const n of ["M", "F", "U"]) {
      const b = personShapes.get(n)!.bounds(40);
      expect(b).toEqual({ x: -20, y: -20, w: 40, h: 40 });
      expect(personShapes.get(n)!.render(40).length).toBeGreaterThan(0);
    }
  });
  it("shapes carry inline presentation attrs", () => {
    const [rect] = personShapes.get("M")!.render(40);
    expect(rect.attrs.fill).toBe("white");
    expect(rect.attrs.stroke).toBe("black");
  });
});

describe("decorations", () => {
  const box: Box = personShapes.get("M")!.bounds(40);
  it("deceased draws an X over the box", () => {
    const d = decorations.get("deceased")!;
    expect(d.layer).toBe("over");
    const lines = d.render(box, person());
    expect(lines).toHaveLength(2);
    expect(lines.every((l) => l.tag === "line")).toBe(true);
  });
  it("index outlines the person's own shape, enlarged", () => {
    const vs = decorations.get("index")!.render(box, person({ sex: "F" }));
    expect(vs.some((v) => v.tag === "circle")).toBe(true);
  });
  it("substance-abuse clips a half fill to the shape", () => {
    const vs = decorations.get("substance-abuse")!.render(box, person());
    expect(JSON.stringify(vs)).toContain("clipPath");
  });
  it("registers the clinical fill set", () => {
    for (const n of ["alcoholism", "in-recovery", "mental-illness", "physical-illness"]) {
      expect(decorations.get(n), n).toBeDefined();
      expect(decorations.get(n)!.layer).toBe("under");
    }
    // in-recovery hatches instead of solid-filling
    expect(JSON.stringify(decorations.get("in-recovery")!.render(box, person())).match(/"line"/g)!.length).toBeGreaterThan(3);
  });
});

describe("line styles", () => {
  const path = [
    { x: 0, y: 20 },
    { x: 0, y: 50 },
    { x: 160, y: 50 },
    { x: 160, y: 20 },
  ];
  const boxA: Box = { x: -20, y: -20, w: 40, h: 40 };
  const boxB: Box = { x: 140, y: 80, w: 40, h: 40 };
  const flat = (v: unknown) => JSON.stringify(v);

  it("registers the six union statuses", () => {
    expect(unionLines.names().sort()).toEqual(["affair", "cohabiting", "dating", "divorced", "married", "separated"]);
  });
  it("married solid, cohabiting dashed, dating dotted", () => {
    expect(flat(unionLines.get("married")!.renderLine(path))).not.toContain("stroke-dasharray");
    expect(flat(unionLines.get("cohabiting")!.renderLine(path))).toContain("stroke-dasharray");
    expect(flat(unionLines.get("dating")!.renderLine(path))).toContain("stroke-dasharray");
  });
  it("separated has 1 slash, divorced 2", () => {
    expect(unionLines.get("separated")!.renderAdornment!({ x: 80, y: 50 })).toHaveLength(1);
    expect(unionLines.get("divorced")!.renderAdornment!({ x: 80, y: 50 })).toHaveLength(2);
  });
  it("registers the seven emotional kinds", () => {
    expect(emotionalLines.names().sort()).toEqual(["caretaker", "close", "conflict", "cutoff", "distant", "fused", "fused-conflict"]);
  });
  it("caretaker draws a line plus a 2-leg arrowhead at the recipient end", () => {
    const vs = emotionalLines.get("caretaker")!.render(boxA, boxB);
    expect(vs).toHaveLength(3);
    // both arrow legs anchor at the `to` endpoint
    const [, leg1, leg2] = vs;
    expect(leg1.attrs.x1).toBe(leg2.attrs.x1);
    expect(leg1.attrs.y1).toBe(leg2.attrs.y1);
  });
  it("close = 2 lines, fused = 3, cutoff = line + 2 bars, conflict zigzags, distant dashes", () => {
    expect(emotionalLines.get("close")!.render(boxA, boxB)).toHaveLength(2);
    expect(emotionalLines.get("fused")!.render(boxA, boxB)).toHaveLength(3);
    expect(emotionalLines.get("cutoff")!.render(boxA, boxB)).toHaveLength(3);
    expect(emotionalLines.get("conflict")!.render(boxA, boxB).some((v) => v.tag === "path")).toBe(true);
    expect(flat(emotionalLines.get("distant")!.render(boxA, boxB))).toContain("stroke-dasharray");
  });
});
