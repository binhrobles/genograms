import { h, type VNode } from "../vnode";
import type { Box } from "../geom";
import { decorations, personShapes, type Decoration } from "../registry";
import "./shapes"; // shapes must be registered before decorations look them up

/** Double border: the person's own shape, enlarged and unfilled. */
const index: Decoration = {
  layer: "over",
  render: (box, person) => {
    const shape = personShapes.get(person.sex) ?? personShapes.get("U")!;
    return shape.render(box.w + 8, { fill: "none", stroke: person.color ?? "black" }).filter((v) => v.tag !== "text");
  },
};

/** X drawn across (and slightly past) the shape. */
const deceased: Decoration = {
  layer: "over",
  render: (box, person) => {
    const p = 4;
    const stroke = { stroke: person.color ?? "black", "stroke-width": 1.5 };
    return [
      h("line", { x1: box.x - p, y1: box.y - p, x2: box.x + box.w + p, y2: box.y + box.h + p, ...stroke }),
      h("line", { x1: box.x - p, y1: box.y + box.h + p, x2: box.x + box.w + p, y2: box.y - p, ...stroke }),
    ];
  },
};

type Region = "bottom" | "left" | "right" | "top";

function regionRect(box: Box, region: Region): Box {
  switch (region) {
    case "bottom":
      return { x: box.x, y: box.y + box.h / 2, w: box.w, h: box.h / 2 };
    case "top":
      return { x: box.x, y: box.y, w: box.w, h: box.h / 2 };
    case "left":
      return { x: box.x, y: box.y, w: box.w / 2, h: box.h };
    case "right":
      return { x: box.x + box.w / 2, y: box.y, w: box.w / 2, h: box.h };
  }
}

/** Standard clinical fills: a region of the shape filled solid, or diagonally hatched
 *  ("in recovery"). Clipped to the person's own shape so it works on any registered shape. */
function fillDecoration(name: string, region: Region, hatch = false): Decoration {
  return {
    layer: "under",
    render: (box, person) => {
      const shape = personShapes.get(person.sex) ?? personShapes.get("U")!;
      const clipId = `clip-${name}-${person.id}`;
      const shapeVs: VNode[] = shape.render(box.w).filter((v) => v.tag !== "text");
      const r = regionRect(box, region);
      const ink = person.color ?? "#555";
      const content: VNode[] = hatch
        ? Array.from({ length: Math.ceil((r.w + r.h) / 5) }, (_, i) => {
            const x = r.x - r.h + i * 5;
            return h("line", { x1: x, y1: r.y + r.h, x2: x + r.h, y2: r.y, stroke: ink, "stroke-width": 1.2 });
          })
        : [h("rect", { x: r.x, y: r.y, width: r.w, height: r.h, fill: ink })];
      return [
        h("defs", {}, [h("clipPath", { id: clipId }, shapeVs)]),
        h("g", { "clip-path": `url(#${clipId})` }, hatch ? [h("rect", { x: r.x, y: r.y, width: r.w, height: r.h, fill: "none" }), ...content] : content),
      ];
    },
  };
}

decorations.register("index", index);
decorations.register("deceased", deceased);
decorations.register("alcoholism", fillDecoration("alcoholism", "bottom"));
decorations.register("substance-abuse", fillDecoration("substance-abuse", "bottom"));
decorations.register("in-recovery", fillDecoration("in-recovery", "bottom", true));
decorations.register("mental-illness", fillDecoration("mental-illness", "left"));
decorations.register("physical-illness", fillDecoration("physical-illness", "right"));
