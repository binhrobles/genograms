import { describe, it, expect } from "vitest";
import { parseGenogram } from "../src/core/parse";
import { buildScene } from "../src/core/scene";
import { vnodeToString, sceneToSVG } from "../src/export/svg";
import { FAMILY } from "./fixtures";
import "../src/core/registry/builtins";

describe("svg export", () => {
  it("serializes vnodes with escaping", () => {
    expect(vnodeToString({ tag: "rect", attrs: { x: 1, fill: 'a"b' } })).toBe('<rect x="1" fill="a&quot;b"/>');
    expect(vnodeToString({ tag: "text", attrs: {}, children: ["a < b & c"] })).toBe("<text>a &lt; b &amp; c</text>");
  });

  it("produces a standalone svg for the family", () => {
    const svg = sceneToSVG(buildScene(parseGenogram(FAMILY).doc!));
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg).toContain("viewBox=");
    expect(svg).toContain("Binh");
    expect(svg).toContain("polyline"); // union bus / child link
    expect(svg).toContain('font-family="system-ui, sans-serif"');
  });
});
