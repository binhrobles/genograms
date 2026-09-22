import { describe, it, expect } from "vitest";
import { parseGenogram } from "../src/core/parse";
import { FAMILY } from "./fixtures";

const msgs = (t: string) =>
  parseGenogram(t)
    .diagnostics.map((d) => `${d.severity}:${d.message}`)
    .join("\n");

describe("validate", () => {
  it("clean fixture has no errors", () => {
    const diags = parseGenogram(FAMILY).diagnostics;
    expect(diags.filter((d) => d.severity === "error")).toEqual([]);
  });

  it("flags bad partner arity and self-partnering", () => {
    expect(msgs(`[unions.u]\npartners = ["a"]\n[people.a]\n[layout]\na = [0,0]`)).toMatch(/error:.*exactly 2/);
    expect(msgs(`[unions.u]\npartners = ["a", "a"]\n[people.a]\n[layout]\na = [0,0]`)).toMatch(/error:.*distinct/);
  });

  it("flags unresolved references", () => {
    expect(msgs(`[people.a]\nparents = "ghost"\n[layout]\na=[0,0]`)).toMatch(/error:.*ghost/);
    expect(msgs(`[emotional.e]\nbetween = ["a", "ghost"]\n[people.a]\n[layout]\na=[0,0]`)).toMatch(/error:.*ghost/);
    expect(msgs(`[annotations.n]\ntext = "x"\nattach = "ghost"\n[layout]\nn=[0,0]`)).toMatch(/error:.*ghost/);
  });

  it("flags duplicate ids across kinds", () => {
    expect(msgs(`[people.x]\n[annotations.x]\ntext = "t"\n[layout]\nx=[0,0]`)).toMatch(/error:.*duplicate/i);
  });

  it("flags parent cycles", () => {
    const t = `[people.a]\nparents = "b"\n[people.b]\nparents = "a"\n[layout]\na=[0,0]\nb=[0,50]`;
    expect(msgs(t)).toMatch(/error:.*cycle/i);
  });

  it("warns on layout for unknown id and missing layout", () => {
    const t = `[people.a]\n[layout]\nghost = [1,2]`;
    const m = msgs(t);
    expect(m).toMatch(/warning:.*ghost/);
    expect(m).toMatch(/warning:.*no layout/i);
  });
});
