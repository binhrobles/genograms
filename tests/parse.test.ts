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

  it("flags wrong field types", () => {
    const r = parseGenogram(`[people.x]\nname = 5\ndecorations = "nope"\n[layout]\nx = [0,0]\n`);
    expect(r.ok).toBe(true);
    const msgs = r.diagnostics.map((d) => d.message).join("\n");
    expect(msgs).toMatch(/name.*string/i);
    expect(msgs).toMatch(/decorations.*array/i);
  });
});
