import { describe, it, expect } from "vitest";
import { parseGenogram } from "../src/core/parse";
import {
  applyEdits,
  setLayoutEntry,
  setField,
  removeField,
  appendToArray,
  addTable,
  removeElement,
  renameId,
  serializeValue,
} from "../src/core/surgeon";
import { FAMILY } from "./fixtures";

const ctx = (text: string) => {
  const r = parseGenogram(text);
  return { text, map: r.map!, doc: r.doc! };
};

/** Comments and formatting outside the touched region must survive every edit. */
const expectCommentsSurvive = (out: string) => {
  expect(out).toContain("# my family        <- top comment must survive edits");
  expect(out).toContain('name = "Mai" # inline comment');
};

describe("surgeon", () => {
  it("serializes values as TOML", () => {
    expect(serializeValue("a \"b\"")).toBe('"a \\"b\\""');
    expect(serializeValue(5)).toBe("5");
    expect(serializeValue(true)).toBe("true");
    expect(serializeValue(["a", "b"])).toBe('["a", "b"]');
  });

  it("applyEdits keeps same-position insert order and rejects overlaps", () => {
    expect(applyEdits("ab", [{ from: 1, to: 1, insert: "X" }, { from: 1, to: 1, insert: "Y" }])).toBe("aXYb");
    expect(() => applyEdits("abcdef", [{ from: 0, to: 3, insert: "" }, { from: 2, to: 5, insert: "" }])).toThrow(/overlap/);
  });

  it("setLayoutEntry replaces an existing value in place", () => {
    const c = ctx(FAMILY);
    const out = applyEdits(c.text, setLayoutEntry(c.text, c.map, "mai", [200, 10]));
    expect(out).toContain("mai = [200, 10]");
    expectCommentsSurvive(out);
    expect(parseGenogram(out).doc!.layout.get("mai")).toEqual([200, 10]);
  });

  it("setLayoutEntry appends a new entry / creates the table", () => {
    const c = ctx(FAMILY);
    const out = applyEdits(c.text, setLayoutEntry(c.text, c.map, "newbie", [5, 6]));
    expect(parseGenogram(out).doc!.layout.get("newbie")).toEqual([5, 6]);

    const bare = ctx(`[people.a]\nname = "A"`);
    const out2 = applyEdits(bare.text, setLayoutEntry(bare.text, bare.map, "a", [1, 2]));
    expect(parseGenogram(out2).doc!.layout.get("a")).toEqual([1, 2]);
  });

  it("setField replaces or inserts", () => {
    const c = ctx(FAMILY);
    let out = applyEdits(c.text, setField(c.text, c.map, "binh-mai", "status", "divorced"));
    expect(out).toContain('status = "divorced"');
    expectCommentsSurvive(out);

    out = applyEdits(c.text, setField(c.text, c.map, "mai", "death", 2080));
    const r = parseGenogram(out);
    expect(r.doc!.people.get("mai")!.death).toBe(2080);
    expect(r.ok).toBe(true);
  });

  it("removeField removes the whole line", () => {
    const c = ctx(FAMILY);
    const out = applyEdits(c.text, removeField(c.text, c.map, "binh", "index"));
    expect(out).not.toContain("index = true");
    expect(parseGenogram(out).doc!.people.get("binh")!.index).toBe(false);
    expectCommentsSurvive(out);
  });

  it("appendToArray extends or creates the array", () => {
    const c = ctx(FAMILY);
    let out = applyEdits(c.text, appendToArray(c.text, c.map, "binh", "decorations", "deceased"));
    expect(parseGenogram(out).doc!.people.get("binh")!.decorations).toEqual(["substance-abuse", "deceased"]);

    out = applyEdits(c.text, appendToArray(c.text, c.map, "mai", "decorations", "deceased"));
    expect(parseGenogram(out).doc!.people.get("mai")!.decorations).toEqual(["deceased"]);
    expectCommentsSurvive(out);
  });

  it("addTable inserts above [layout] and parses clean", () => {
    const c = ctx(FAMILY);
    const out = applyEdits(c.text, addTable(c.text, c.map, "people", "zoe", { name: "Zoe", sex: "F", parents: "binh-mai" }));
    const r = parseGenogram(out);
    expect(r.ok).toBe(true);
    expect(r.doc!.people.get("zoe")).toMatchObject({ name: "Zoe", sex: "F", parents: "binh-mai" });
    expect(out.indexOf("[people.zoe]")).toBeLessThan(out.indexOf("[layout]"));
    expectCommentsSurvive(out);
  });

  it("removeElement cascades: person -> union -> children's parents refs", () => {
    const c = ctx(FAMILY);
    const out = applyEdits(c.text, removeElement(c.text, c.map, c.doc, "mai"));
    const r = parseGenogram(out);
    expect(r.ok).toBe(true);
    expect(r.doc!.people.has("mai")).toBe(false);
    expect(r.doc!.unions.has("binh-mai")).toBe(false);
    expect(r.doc!.people.get("kai")!.parents).toBeUndefined();
    expect(r.doc!.layout.has("mai")).toBe(false);
    expect(r.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    // mai's own inline comment is gone with her table; unrelated comments survive
    expect(out).toContain("# my family        <- top comment must survive edits");
  });

  it("removeElement on a person also removes their emotional links and detaches notes", () => {
    const c = ctx(FAMILY);
    const out = applyEdits(c.text, removeElement(c.text, c.map, c.doc, "binh"));
    const r = parseGenogram(out);
    expect(r.doc!.emotional.has("kai-binh")).toBe(false);
    expect(r.doc!.annotations.get("note1")!.attach).toBeUndefined();
    expect(r.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  });

  it("removes just one inline edge, and cascades person deletion into the edges array", () => {
    const t = `[people.a]\n[people.b]\n[people.c]
[emotional]
edges = ["a abuse b", "b close c"]
[layout]\na=[0,0]\nb=[100,0]\nc=[200,0]\n`;
    const c1 = ctx(t);
    // delete a single edge
    let out = applyEdits(c1.text, removeElement(c1.text, c1.map, c1.doc, "a-abuse-b"));
    let r = parseGenogram(out);
    expect(r.ok).toBe(true);
    expect(r.doc!.emotional.size).toBe(1);
    expect(out).toContain('edges = ["b close c"]');
    // deleting person c cascades into the array
    const c2 = ctx(out);
    out = applyEdits(c2.text, removeElement(c2.text, c2.map, c2.doc, "c"));
    r = parseGenogram(out);
    expect(r.ok).toBe(true);
    expect(r.doc!.emotional.size).toBe(0);
    expect(r.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  });

  it("renameId rewrites inline edges", () => {
    const t = `[people.a]\n[people.b]
[emotional]
edges = ["a close b"]
[layout]\na=[0,0]\nb=[100,0]\n`;
    const c = ctx(t);
    const out = applyEdits(c.text, renameId(c.text, c.map, c.doc, "a", "alice"));
    const r = parseGenogram(out);
    expect(r.doc!.emotional.values().next().value!.between).toEqual(["alice", "b"]);
    expect(r.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  });

  it("renameId updates header, layout key, and all references", () => {
    const c = ctx(FAMILY);
    const out = applyEdits(c.text, renameId(c.text, c.map, c.doc, "binh", "papa"));
    const r = parseGenogram(out);
    expect(r.ok).toBe(true);
    expect(r.doc!.people.has("papa")).toBe(true);
    expect(r.doc!.people.has("binh")).toBe(false);
    expect(r.doc!.unions.get("binh-mai")!.partners).toEqual(["papa", "mai"]);
    expect(r.doc!.emotional.get("kai-binh")!.between).toEqual(["kai", "papa"]);
    expect(r.doc!.annotations.get("note1")!.attach).toBe("papa");
    expect(r.doc!.layout.get("papa")).toEqual([0, 0]);
    expect(r.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    expectCommentsSurvive(out);
  });
});
