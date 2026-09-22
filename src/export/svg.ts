import type { VNode } from "../core/vnode";
import type { SceneGraph } from "../core/scene";

const escAttr = (s: string | number) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const escText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function vnodeToString(v: VNode | string): string {
  if (typeof v === "string") return escText(v);
  const attrs = Object.entries(v.attrs)
    .map(([k, val]) => ` ${k}="${escAttr(val)}"`)
    .join("");
  if (!v.children || v.children.length === 0) return `<${v.tag}${attrs}/>`;
  return `<${v.tag}${attrs}>${v.children.map(vnodeToString).join("")}</${v.tag}>`;
}

export function sceneToSVG(scene: SceneGraph): string {
  const b = scene.bbox;
  const inner = scene.elements.map((e) => e.vnodes.map(vnodeToString).join("")).join("\n");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.x} ${b.y} ${b.w} ${b.h}" width="${b.w}" height="${b.h}" font-family="system-ui, sans-serif">` +
    `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="white"/>\n${inner}\n</svg>`
  );
}
