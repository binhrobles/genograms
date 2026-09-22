import { describe, it, expect } from "vitest";
import { parseGenogram } from "../src/core/parse";
import { buildScene, unionGeometry, PERSON_SIZE } from "../src/core/scene";
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

  it("computes union geometry: horizontal connector between level partners", () => {
    const doc = parseGenogram(FAMILY).doc!;
    const g = unionGeometry(doc, "binh-mai")!;
    expect(g.sameRow).toBe(true);
    expect(g.busY).toBe(12); // UNION_DROP below shape centers
    expect(g.midX).toBe(80);
    const u = buildScene(doc).elements.find((e) => e.id === "binh-mai")!;
    // the line runs side-to-side just below center: binh's right edge to mai's left edge
    expect(JSON.stringify(u.vnodes)).toContain(`"points":"20,12 140,12"`);
  });

  it("elbows the union line when partners sit at different heights", () => {
    const t = `[people.a]\n[people.b]\n[unions.u]\npartners = ["a","b"]\n[layout]\na = [0, 0]\nb = [200, 60]`;
    const u = scene(t).elements.find((e) => e.id === "u")!;
    expect(JSON.stringify(u.vnodes)).toContain(`"points":"20,12 100,12 100,72 180,72"`);
  });

  it("keeps a partnered pair's emotional line touching the shapes, above the dropped union", () => {
    const t = `[people.a]\n[people.b]\n[unions.u]\npartners = ["a","b"]\n[emotional.e]\nbetween = ["a","b"]\nkind = "cutoff"\n[layout]\na = [0,0]\nb = [200,0]`;
    const s = scene(t);
    const e = s.elements.find((el) => el.id === "e")!;
    expect(e.hitLine![0]).toEqual({ x: 20, y: 0 }); // on a's right edge, center height
    const u = s.elements.find((el) => el.id === "u")!;
    expect(u.bounds.y).toBe(12 - 8); // union line 12px lower
  });

  it("gives 3+ children a shared stem and sibling bus", () => {
    const t = `[people.a]\n[people.b]\n[unions.u]\npartners = ["a","b"]
[people.c1]\nparents = "u"\n[people.c2]\nparents = "u"\n[people.c3]\nparents = "u"
[layout]\na = [0,0]\nb = [200,0]\nc1 = [-40,150]\nc2 = [100,150]\nc3 = [240,150]`;
    const s = scene(t);
    const links = s.elements.filter((e) => e.kind === "child-link");
    expect(links).toHaveLength(1); // one grouped element, not three drops
    expect(links[0].id).toBe("childlink-u");
    const flat = JSON.stringify(links[0].vnodes);
    // stem from the union line (y=12) down to the sibling bus at min(childTop) - 30 = 100
    expect(flat).toContain('"points":"100,12 100,100"');
    // sibling bus spans the children
    expect(flat).toContain('"points":"-40,100 240,100"');
    // and each child hangs off it
    expect(flat).toContain('"points":"-40,100 -40,130"');
  });

  it("renders a miscarriage as a small dot with the drop line reaching it", () => {
    const t = `[people.a]\n[people.b]\n[unions.u]\npartners = ["a","b"]
[people.m1]\nshape = "miscarriage"\nparents = "u"
[layout]\na = [0,0]\nb = [200,0]\nm1 = [100,150]`;
    const s = scene(t);
    const m1 = s.elements.find((e) => e.id === "m1")!;
    expect(m1.bounds.w).toBeLessThan(20); // small dot bounds, not the full person box
    const link = s.elements.find((e) => e.id === "childlink-m1")!;
    // drop ends at the dot's top (150 - 6.4), not the default person top (130)
    expect(JSON.stringify(link.vnodes)).toContain("100,143.6");
  });

  it("warns on unknown shape and falls back to the sex shape", () => {
    const t = `[people.a]\nsex = "F"\nshape = "wat"\n[layout]\na = [0,0]`;
    const s = scene(t);
    expect(s.diagnostics.map((d) => d.message).join()).toMatch(/unknown shape/);
    expect(JSON.stringify(s.elements.find((e) => e.id === "a")!.vnodes)).toContain('"circle"');
  });

  it("keeps individual drops for 1–2 children", () => {
    const t = `[people.a]\n[people.b]\n[unions.u]\npartners = ["a","b"]
[people.c1]\nparents = "u"\n[people.c2]\nparents = "u"
[layout]\na = [0,0]\nb = [200,0]\nc1 = [60,150]\nc2 = [140,150]`;
    const links = scene(t).elements.filter((e) => e.kind === "child-link");
    expect(links.map((l) => l.id).sort()).toEqual(["childlink-c1", "childlink-c2"]);
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

  it("renders the name in a badge pill", () => {
    const binh = scene(FAMILY).elements.find((e) => e.id === "binh")!;
    const flat = JSON.stringify(binh.vnodes);
    expect(flat).toContain('"rx":8.5');
  });

  it("applies person color/fill/badge overrides", () => {
    const t = `[people.a]\nname = "A"\ncolor = "#123456"\nfill = "#eeffee"\nbadge = "#ffeecc"\n[layout]\na = [0,0]`;
    const flat = JSON.stringify(scene(t).elements.find((e) => e.id === "a")!.vnodes);
    expect(flat).toContain("#123456");
    expect(flat).toContain("#eeffee");
    expect(flat).toContain("#ffeecc");
  });

  it("recolors union and emotional lines via color field", () => {
    const t = `[people.a]\n[people.b]\n[unions.u]\npartners = ["a","b"]\ncolor = "#0000ff"\n[emotional.e]\nbetween = ["a","b"]\nkind = "conflict"\ncolor = "#00ff00"\n[layout]\na=[0,0]\nb=[160,0]`;
    const s = scene(t);
    expect(JSON.stringify(s.elements.find((e) => e.id === "u")!.vnodes)).toContain("#0000ff");
    const emo = JSON.stringify(s.elements.find((e) => e.id === "e")!.vnodes);
    expect(emo).toContain("#00ff00");
    expect(emo).not.toContain("#c0392b"); // conflict's default red is fully replaced
  });

  it("renders multiline annotations as tspans", () => {
    const t = `[annotations.n]\ntext = """line one\nline two\nline three"""\n[layout]\nn = [0,0]`;
    const n = scene(t).elements.find((e) => e.id === "n")!;
    const flat = JSON.stringify(n.vnodes);
    expect(flat.match(/tspan/g)?.length).toBe(3);
    expect(n.bounds.h).toBe(6 + 14 * 3);
  });
});
