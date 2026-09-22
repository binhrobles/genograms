import { describe, it, expect } from "vitest";
import { parseGenogram } from "../src/core/parse";
import { buildScene, unionGeometry, PERSON_SIZE, BUS_DROP } from "../src/core/scene";
import { FAMILY } from "./fixtures";
import "../src/core/registry/builtins";

const scene = (t: string) => buildScene(parseGenogram(t).doc!);

describe("buildScene", () => {
  it("emits one element per person/union/child/emotional/annotation", () => {
    const kinds = scene(FAMILY).elements.map((e) => e.kind);
    expect(kinds.filter((k) => k === "person")).toHaveLength(3);
    expect(kinds.filter((k) => k === "union")).toHaveLength(1);
    expect(kinds.filter((k) => k === "child-link")).toHaveLength(1);
    expect(kinds.filter((k) => k === "emotional")).toHaveLength(1);
    expect(kinds.filter((k) => k === "annotation")).toHaveLength(1);
  });

  it("orders lines under people", () => {
    const kinds = scene(FAMILY).elements.map((e) => e.kind);
    expect(kinds.indexOf("union")).toBeLessThan(kinds.indexOf("person"));
    expect(kinds.indexOf("emotional")).toBeLessThan(kinds.indexOf("person"));
  });

  it("positions people from layout with absolute bounds", () => {
    const mai = scene(FAMILY).elements.find((e) => e.id === "mai")!;
    expect(mai.bounds).toEqual({ x: 160 - PERSON_SIZE / 2, y: -PERSON_SIZE / 2, w: PERSON_SIZE, h: PERSON_SIZE });
    expect(mai.draggable).toBe(true);
    expect(mai.layoutPos).toEqual([160, 0]);
  });

  it("computes union bus geometry", () => {
    const doc = parseGenogram(FAMILY).doc!;
    const g = unionGeometry(doc, "binh-mai")!;
    expect(g.busY).toBe(PERSON_SIZE / 2 + BUS_DROP);
    expect(g.midX).toBe(80);
  });

  it("renders deceased X when death is set", () => {
    const t = `[people.a]\nsex = "M"\ndeath = 2020\n[layout]\na = [0,0]`;
    const a = scene(t).elements.find((e) => e.id === "a")!;
    expect(JSON.stringify(a.vnodes)).toContain('"line"');
  });

  it("falls back with a warning on unknown decoration / status / kind", () => {
    const t = `[people.a]\ndecorations = ["wat"]\n[people.b]\n[unions.u]\npartners = ["a","b"]\nstatus = "wat"\n[emotional.e]\nbetween = ["a","b"]\nkind = "wat"\n[layout]\na=[0,0]\nb=[160,0]`;
    const s = scene(t);
    const warnings = s.diagnostics.map((d) => d.message).join("\n");
    expect(warnings).toMatch(/unknown decoration/);
    expect(warnings).toMatch(/unknown union status/);
    expect(warnings).toMatch(/unknown emotional kind/);
    expect(s.elements.find((e) => e.id === "u")).toBeDefined();
    expect(s.elements.find((e) => e.id === "e")).toBeDefined();
  });

  it("attached annotations offset from their person; layoutPos stays the offset", () => {
    const n = scene(FAMILY).elements.find((e) => e.id === "note1")!;
    expect(n.bounds.x).toBe(0);
    expect(n.layoutPos).toEqual([0, 40]);
    expect(n.draggable).toBe(true);
  });

  it("skips unions with missing partners without crashing", () => {
    const t = `[unions.u]\npartners = ["ghost", "ghost2"]`;
    expect(scene(t).elements.find((e) => e.id === "u")).toBeUndefined();
  });
});
