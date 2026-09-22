import { parseGenogram, type ParseResult, type SourceMap } from "../core/parse";
import { buildScene, type SceneGraph, type SceneOptions } from "../core/scene";
import type { GenoDocument, Diagnostic } from "../core/model";

export const LS_KEY = "genogram.doc";
const LS_LAYERS = "genogram.layers";

export type Layers = Required<SceneOptions>;
const DEFAULT_LAYERS: Layers = { names: true, years: true, decorations: true, emotional: true, annotations: true };

function loadLayers(): Layers {
  try {
    return { ...DEFAULT_LAYERS, ...JSON.parse(localStorage.getItem(LS_LAYERS) ?? "{}") };
  } catch {
    return { ...DEFAULT_LAYERS };
  }
}

export const DEFAULT_DOC = `# Welcome to Genogram — this TOML *is* the document.
# Edit it directly, or click a person on the canvas for actions.

[meta]
title = "Ví dụ / Ejemplo"

# ── Vietnamese side ─────────────────────
[people.bao]
name = "Bảo"
sex = "M"
birth = 1938
death = 2011

[people.lan]
name = "Lan"
sex = "F"
birth = "~1941" # approximate years are fine

[unions.bao-lan]
partners = ["bao", "lan"]
status = "married"
year = 1963

[people.minh]
name = "Minh"
sex = "M"
birth = 1965
parents = "bao-lan"

# ── Mexican side ────────────────────────
[people.ernesto]
name = "Ernesto"
sex = "M"
birth = 1935
death = 2020

[people.rosa-maria]
name = "Rosa María"
sex = "F"
birth = 1940

[unions.ernesto-rosa]
partners = ["ernesto", "rosa-maria"]
status = "married"
year = 1960

[people.lupe]
name = "Guadalupe"
sex = "F"
birth = 1968
parents = "ernesto-rosa"

# ── The parents & index person ──────────
[unions.minh-lupe]
partners = ["minh", "lupe"]
status = "divorced"
year = 1995

[people.an]
name = "An Sofía"
sex = "F"
birth = 1992
index = true
parents = "minh-lupe"

[emotional.an-minh]
between = ["an", "minh"]
kind = "conflict"

[emotional.an-lan]
between = ["an", "lan"]
kind = "close"

[annotations.note-lupe]
text = "remarried, back in Guadalajara"
attach = "lupe"

[layout]
bao = [80, 0]
lan = [240, 0]
minh = [160, 140]
ernesto = [480, 0]
rosa-maria = [640, 0]
lupe = [560, 140]
an = [360, 280]
note-lupe = [-30, 52]
`;

class AppState {
  result = $state.raw<ParseResult | null>(null);
  scene = $state.raw<SceneGraph | null>(null); // last good scene (kept through syntax errors)
  stale = $state(false);
  diagnostics = $state.raw<Diagnostic[]>([]);
  selection = $state.raw<string[]>([]);
  highlightedId = $state<string | null>(null);
  linkPick = $state.raw<{ kind: string; from: string; union: boolean } | null>(null);
  editorCollapsed = $state(false);
  canvasCollapsed = $state(false);
  libraryOpen = $state(false);
  splitPct = $state(42);
  layers = $state<Layers>(loadLayers());

  get doc(): GenoDocument | null {
    return this.result?.doc ?? null;
  }
  get map(): SourceMap | null {
    return this.result?.map ?? null;
  }

  reparse(text: string) {
    const r = parseGenogram(text);
    const diags = [...r.diagnostics];
    this.result = r;
    if (r.doc) {
      const s = buildScene(r.doc, { ...this.layers });
      diags.push(...s.diagnostics);
      this.scene = s;
      this.stale = false;
      const ids = new Set(s.elements.map((e) => e.id));
      this.selection = this.selection.filter((id) => ids.has(id));
    } else {
      this.stale = true;
    }
    this.diagnostics = diags;
    try {
      localStorage.setItem(LS_KEY, text);
    } catch {
      /* private mode etc. */
    }
  }

  toggleLayer(name: keyof Layers) {
    this.layers = { ...this.layers, [name]: !this.layers[name] };
    try {
      localStorage.setItem(LS_LAYERS, JSON.stringify(this.layers));
    } catch {
      /* ignore */
    }
    const doc = this.result?.doc;
    if (doc) {
      const s = buildScene(doc, { ...this.layers });
      this.scene = s;
      this.diagnostics = [...(this.result?.diagnostics ?? []), ...s.diagnostics];
      const ids = new Set(s.elements.map((e) => e.id));
      this.selection = this.selection.filter((id) => ids.has(id));
    }
  }
}

export const app = new AppState();

/** Imperative hooks the canvas registers so the toolbar can drive it. */
export const canvasApi: { zoomIn?: () => void; zoomOut?: () => void; zoomFit?: () => void } = {};
