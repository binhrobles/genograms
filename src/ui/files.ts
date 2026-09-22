import { app } from "./state.svelte";
import { editorText, replaceAll } from "./editor";
import { sceneToSVG } from "../export/svg";

function download(filename: string, content: Blob) {
  const url = URL.createObjectURL(content);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const docSlug = () => (app.doc?.title ?? "genogram").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "genogram";

export function saveTOML() {
  download(`${docSlug()}.toml`, new Blob([editorText()], { type: "application/toml" }));
}

export async function openTOMLFile(file: File) {
  replaceAll(await file.text());
}

export function exportSVG() {
  if (!app.scene) return;
  download(`${docSlug()}.svg`, new Blob([sceneToSVG(app.scene)], { type: "image/svg+xml" }));
}

export async function exportPNG(scale = 2) {
  if (!app.scene) return;
  const svg = sceneToSVG(app.scene);
  const { bbox } = app.scene;
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("SVG rasterization failed"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bbox.w * scale));
    canvas.height = Math.max(1, Math.round(bbox.h * scale));
    const g = canvas.getContext("2d")!;
    g.fillStyle = "white";
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (blob) download(`${docSlug()}.png`, blob);
  } finally {
    URL.revokeObjectURL(url);
  }
}
