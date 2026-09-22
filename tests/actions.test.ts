import { describe, it, expect } from "vitest";
import { parseGenogram } from "../src/core/parse";
import { applyEdits } from "../src/core/surgeon";
import { addParent, type Ctx } from "../src/ui/actions";
import "../src/core/registry/builtins";

const ctx = (text: string): Ctx => {
  const r = parseGenogram(text);
  return { text, doc: r.doc!, map: r.map! };
};

const ORPHAN = `[people.kid]
name = "Kid"

[layout]
kid = [100, 300]
`;

describe("addParent", () => {
  it("first call creates a single parent north of the child", () => {
    const c = ctx(ORPHAN);
    const r = addParent(c, "kid", "Mom")!;
    expect(r.newId).toBe("mom");
    const out = applyEdits(c.text, r.edits);
    const doc = parseGenogram(out).doc!;
    expect(doc.people.get("kid")!.parents).toBe("mom");
    expect(doc.layout.get("mom")).toEqual([100, 300 - 120]); // CHILD_DY north
  });

  it("second call creates the other parent and upgrades to a union", () => {
    const c1 = ctx(ORPHAN);
    const step1 = applyEdits(c1.text, addParent(c1, "kid", "Mom")!.edits);
    const c2 = ctx(step1);
    const r = addParent(c2, "kid", "Dad")!;
    const out = applyEdits(c2.text, r.edits);
    const p = parseGenogram(out);
    expect(p.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    const doc = p.doc!;
    expect(doc.people.get("kid")!.parents).toBe("mom-dad");
    expect(doc.unions.get("mom-dad")!.partners).toEqual(["mom", "dad"]);
    expect(doc.layout.get("dad")).toEqual([100 + 160, 180]); // beside mom
  });

  it("anchors generated tables below the person they're linked to", () => {
    const c1 = ctx(ORPHAN);
    const step1 = applyEdits(c1.text, addParent(c1, "kid", "Mom")!.edits);
    // mom's table lands right below kid's, above [layout]
    expect(step1.indexOf("[people.mom]")).toBeGreaterThan(step1.indexOf("[people.kid]"));
    expect(step1.indexOf("[people.mom]")).toBeLessThan(step1.indexOf("[layout]"));
    const c2 = ctx(step1);
    const step2 = applyEdits(c2.text, addParent(c2, "kid", "Dad")!.edits);
    // dad + the new union land below mom (their anchor), in that order
    expect(step2.indexOf("[people.dad]")).toBeGreaterThan(step2.indexOf("[people.mom]"));
    expect(step2.indexOf("[unions.mom-dad]")).toBeGreaterThan(step2.indexOf("[people.dad]"));
    expect(step2.indexOf("[unions.mom-dad]")).toBeLessThan(step2.indexOf("[layout]"));
  });

  it("returns null when both parents already exist", () => {
    const c1 = ctx(ORPHAN);
    const step1 = applyEdits(c1.text, addParent(c1, "kid", "Mom")!.edits);
    const c2 = ctx(step1);
    const step2 = applyEdits(c2.text, addParent(c2, "kid", "Dad")!.edits);
    expect(addParent(ctx(step2), "kid", "Extra")).toBeNull();
  });
});
