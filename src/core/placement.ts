import type { GenoDocument, Person } from "./model";
import { personPos, unionGeometry, PERSON_SIZE, BUS_DROP } from "./scene";

export const PARTNER_DX = 160;
export const SIBLING_DX = 90;
export const CHILD_DY = 90;

function occupied(doc: GenoDocument, x: number, y: number): boolean {
  for (const id of doc.people.keys()) {
    const p = personPos(doc, id);
    if (Math.abs(p.x - x) < 60 && Math.abs(p.y - y) < 60) return true;
  }
  return false;
}

export function childrenOf(doc: GenoDocument, parentRef: string): Person[] {
  return [...doc.people.values()].filter((p) => p.parents === parentRef);
}

/** Comparable year from exact (1930), approximate ("~1930", "c. 1930"), or partial ("192?") values.
 *  A 3-digit prefix like "192?" reads as mid-decade (1925). Returns undefined when no year is found. */
export function approxYear(v: number | string | undefined): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return undefined;
  const four = v.match(/\d{4}/);
  if (four) return Number(four[0]);
  const three = v.match(/\d{3}/);
  if (three) return Number(three[0]) * 10 + 5;
  return undefined;
}

/** Beside the person (right, standard side), skipping occupied slots. */
export function placePartner(doc: GenoDocument, personId: string): [number, number] {
  const p = personPos(doc, personId);
  let x = p.x + PARTNER_DX;
  while (occupied(doc, x, p.y)) x += PARTNER_DX;
  return [x, p.y];
}

/** South of the union bus (or the single parent), slotted among siblings by birth. */
export function placeChild(doc: GenoDocument, parentRef: string, birth?: number): [number, number] {
  const g = doc.unions.has(parentRef) ? unionGeometry(doc, parentRef) : null;
  const baseX = g ? g.midX : personPos(doc, parentRef).x;
  const busY = g ? g.busY : personPos(doc, parentRef).y + PERSON_SIZE / 2 + BUS_DROP;
  const y = busY + CHILD_DY;

  const sibs = childrenOf(doc, parentRef)
    .map((c) => ({ c, x: personPos(doc, c.id).x }))
    .sort((a, b) => a.x - b.x);
  if (sibs.length === 0) return [baseX, y];

  if (birth != null) {
    // insert before the first sibling born later (birth order runs left -> right)
    const idx = sibs.findIndex(({ c }) => {
      const y = approxYear(c.birth);
      return y != null && y > birth;
    });
    if (idx === 0) return [sibs[0].x - SIBLING_DX, y];
    if (idx > 0) return [(sibs[idx - 1].x + sibs[idx].x) / 2, y];
  }
  return [sibs[sibs.length - 1].x + SIBLING_DX, y];
}

/** To the right of the person's rightmost sibling (or of the person, if no parents). */
export function placeSibling(doc: GenoDocument, personId: string): [number, number] {
  const person = doc.people.get(personId);
  const pos = personPos(doc, personId);
  if (person?.parents) {
    const sibs = childrenOf(doc, person.parents).map((c) => personPos(doc, c.id));
    const rightmost = Math.max(...sibs.map((q) => q.x), pos.x);
    return [rightmost + SIBLING_DX, pos.y];
  }
  return [pos.x + SIBLING_DX, pos.y];
}
