import { h, type VNode } from "../vnode";
import { decorations, personShapes, type Decoration } from "../registry";
import "./shapes"; // shapes must be registered before index/substance-abuse look them up

/** Double border: the person's own shape, enlarged and unfilled. */
const index: Decoration = {
  layer: "over",
  render: (box, person) => {
    const shape = personShapes.get(person.sex) ?? personShapes.get("U")!;
    return shape
      .render(box.w + 8)
      .filter((v) => v.tag !== "text")
      .map((v) => ({ ...v, attrs: { ...v.attrs, fill: "none" } }));
  },
};

/** X drawn across (and slightly past) the shape. */
const deceased: Decoration = {
  layer: "over",
  render: (box) => {
    const p = 4;
    const stroke = { stroke: "black", "stroke-width": 1.5 };
    return [
      h("line", { x1: box.x - p, y1: box.y - p, x2: box.x + box.w + p, y2: box.y + box.h + p, ...stroke }),
      h("line", { x1: box.x - p, y1: box.y + box.h + p, x2: box.x + box.w + p, y2: box.y - p, ...stroke }),
    ];
  },
};

/** Lower-half fill, clipped to the person's own shape. */
const substanceAbuse: Decoration = {
  layer: "under",
  render: (box, person) => {
    const shape = personShapes.get(person.sex) ?? personShapes.get("U")!;
    const clipId = `clip-${person.id}`;
    const shapeVs: VNode[] = shape.render(box.w).filter((v) => v.tag !== "text");
    return [
      h("defs", {}, [h("clipPath", { id: clipId }, shapeVs)]),
      h("rect", { x: box.x, y: box.y + box.h / 2, width: box.w, height: box.h / 2, fill: "#555", "clip-path": `url(#${clipId})` }),
    ];
  },
};

decorations.register("index", index);
decorations.register("deceased", deceased);
decorations.register("substance-abuse", substanceAbuse);
