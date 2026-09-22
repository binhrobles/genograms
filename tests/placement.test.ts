import { describe, it, expect } from "vitest";
import { parseGenogram } from "../src/core/parse";
import { placePartner, placeChild, placeSibling, approxYear, PARTNER_DX, SIBLING_DX, CHILD_DY } from "../src/core/placement";
import { unionGeometry } from "../src/core/scene";
import { FAMILY } from "./fixtures";

const doc = () => parseGenogram(FAMILY).doc!;

describe("placement", () => {
  it("places a partner to the right, skipping occupied slots", () => {
    // binh is at [0,0]; mai already occupies [160,0], so the next slot is used
    expect(placePartner(doc(), "binh")).toEqual([2 * PARTNER_DX, 0]);
    expect(placePartner(doc(), "kai")).toEqual([80 + PARTNER_DX, 140]);
  });

  it("places the first child under the union midpoint", () => {
    const d = doc();
    d.people.get("kai")!.parents = undefined; // pretend no children yet
    const g = unionGeometry(d, "binh-mai")!;
    expect(placeChild(d, "binh-mai")).toEqual([g.midX, g.busY + CHILD_DY]);
  });

  it("places later children to the right of siblings", () => {
    const d = doc();
    const g = unionGeometry(d, "binh-mai")!;
    expect(placeChild(d, "binh-mai")).toEqual([80 + SIBLING_DX, g.busY + CHILD_DY]);
  });

  it("slots by birth year when known", () => {
    const d = doc(); // kai b.2021 at x=80
    const [x] = placeChild(d, "binh-mai", 2019); // older -> left of kai
    expect(x).toBe(80 - SIBLING_DX);
  });

  it("places a sibling right of the rightmost sibling", () => {
    expect(placeSibling(doc(), "kai")).toEqual([80 + SIBLING_DX, 140]);
  });

  it("understands approximate and partial years", () => {
    expect(approxYear(1930)).toBe(1930);
    expect(approxYear("~1930")).toBe(1930);
    expect(approxYear("c. 1930")).toBe(1930);
    expect(approxYear("192?")).toBe(1925);
    expect(approxYear("1930-05-12")).toBe(1930);
    expect(approxYear("unknown")).toBeUndefined();
    expect(approxYear(undefined)).toBeUndefined();
  });

  it("slots by approximate birth strings", () => {
    const d = doc(); // kai b.2021 at x=80
    d.people.get("kai")!.birth = "~2021";
    const [x] = placeChild(d, "binh-mai", 2019);
    expect(x).toBe(80 - SIBLING_DX); // still recognized as later than 2019
  });
});
