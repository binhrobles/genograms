import { describe, it, expect } from "vitest";
import { parseGenogram } from "../src/core/parse";
import { FAMILY } from "./fixtures";

describe("parseGenogram", () => {
  it("builds the document model", () => {
    const r = parseGenogram(FAMILY);
    expect(r.ok).toBe(true);
    const doc = r.doc!;
    expect(doc.title).toBe("Robles Family");
    expect([...doc.people.keys()]).toEqual(["binh", "mai", "kai"]);
    const binh = doc.people.get("binh")!;
    expect(binh).toMatchObject({ name: "Binh", sex: "M", birth: 1994, index: true, decorations: ["substance-abuse"] });
    expect(doc.people.get("kai")!.parents).toBe("binh-mai");
    expect(doc.people.get("mai")!.index).toBe(false);
    expect(doc.people.get("mai")!.decorations).toEqual([]);
    expect(doc.unions.get("binh-mai")).toMatchObject({ partners: ["binh", "mai"], status: "married", year: 2020 });
    expect(doc.emotional.get("kai-binh")!.kind).toBe("close");
    expect(doc.annotations.get("note1")).toMatchObject({ text: "moved to NYC 2018", attach: "binh" });
    expect(doc.layout.get("mai")).toEqual([160, 0]);
  });

  it("defaults sex to U and status to married", () => {
    const r = parseGenogram(`[people.x]\n[unions.u]\npartners = ["x", "y"]\n[people.y]\n`);
    expect(r.doc!.people.get("x")!.sex).toBe("U");
    expect(r.doc!.unions.get("u")!.status).toBe("married");
  });

  it("builds a SourceMap with faithful ranges", () => {
    const { map } = parseGenogram(FAMILY);
    const binh = map!.elements.get("binh")!;
    expect(binh.kind).toBe("people");
    expect(FAMILY.slice(...binh.header)).toBe("people.binh");
    expect(FAMILY.slice(...binh.table)).toContain('sex = "M"');
    const sex = binh.fields.get("sex")!;
    expect(FAMILY.slice(...sex.value)).toBe('"M"');
    expect(FAMILY.slice(...sex.kv)).toBe('sex = "M"');
    const lay = map!.layout!;
    expect(FAMILY.slice(...lay.entries.get("kai")!.value)).toBe("[80, 140]");
  });

  it("reports syntax errors as diagnostics with ok=false", () => {
    const r = parseGenogram("[people.x\nname=");
    expect(r.ok).toBe(false);
    expect(r.doc).toBeNull();
    expect(r.diagnostics.length).toBeGreaterThanOrEqual(1);
    expect(r.diagnostics[0].severity).toBe("error");
  });

  it("union children shorthand resolves onto each child's parents", () => {
    const t = `[people.mom]\n[people.dad]\n[people.kid1]\n[people.kid2]
[unions.u]\npartners = ["mom", "dad"]\nchildren = ["kid1", "kid2"]
[layout]\nmom=[0,0]\ndad=[160,0]\nkid1=[40,150]\nkid2=[120,150]`;
    const r = parseGenogram(t);
    expect(r.doc!.people.get("kid1")!.parents).toBe("u");
    expect(r.doc!.people.get("kid2")!.parents).toBe("u");
    expect(r.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  });

  it("flags conflicting children claims", () => {
    const t = `[people.a]\n[people.b]\n[people.kid]\nparents = "a"
[unions.u]\npartners = ["a", "b"]\nchildren = ["kid", "ghost"]
[layout]\na=[0,0]\nb=[160,0]\nkid=[80,150]`;
    const msgs = parseGenogram(t).diagnostics.map((d) => `${d.severity}:${d.message}`).join("\n");
    expect(msgs).toMatch(/error:.*already has parents/);
    expect(msgs).toMatch(/error:.*unknown child.*ghost/);
  });

  it("life ranges derive birth and death; explicit fields win; full dates stay intact", () => {
    const t = `[people.a]\nlife = "~1934-2025"
[people.b]\nlife = "1962–1962"
[people.c]\nlife = "1990-05-12"
[people.d]\nlife = "1940-2000"\nbirth = 1941
[layout]\na=[0,0]\nb=[100,0]\nc=[200,0]\nd=[300,0]`;
    const doc = parseGenogram(t).doc!;
    expect(doc.people.get("a")).toMatchObject({ birth: "~1934", death: "2025" });
    expect(doc.people.get("b")).toMatchObject({ birth: "1962", death: "1962" });
    expect(doc.people.get("c")!.birth).toBe("1990-05-12");
    expect(doc.people.get("c")!.death).toBeUndefined();
    expect(doc.people.get("d")!.birth).toBe(1941); // explicit beats derived
    expect(doc.people.get("d")!.death).toBe("2000");
  });

  it("parses compact emotional edges with per-item source ranges", () => {
    const t = `[people.a]\n[people.b]\n[people.c]
[emotional]
edges = ["a abuse b", "b close c", "broken edge"]
[layout]\na=[0,0]\nb=[100,0]\nc=[200,0]`;
    const r = parseGenogram(t);
    const e1 = r.doc!.emotional.get("a-abuse-b")!;
    expect(e1).toMatchObject({ between: ["a", "b"], kind: "abuse" });
    expect(r.doc!.emotional.get("b-close-c")).toBeDefined();
    expect(r.doc!.emotional.size).toBe(2); // the malformed one is skipped
    expect(r.diagnostics.map((d) => d.message).join()).toMatch(/must be exactly/);
    const loc = r.map!.elements.get("a-abuse-b")!;
    expect(loc.inline).toBe(true);
    expect(t.slice(...loc.table)).toBe('"a abuse b"');
  });

  it("flags wrong field types", () => {
    const r = parseGenogram(`[people.x]\nname = 5\ndecorations = "nope"\n[layout]\nx = [0,0]\n`);
    expect(r.ok).toBe(true);
    const msgs = r.diagnostics.map((d) => d.message).join("\n");
    expect(msgs).toMatch(/name.*string/i);
    expect(msgs).toMatch(/decorations.*array/i);
  });
});
