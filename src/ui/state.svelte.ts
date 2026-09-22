import { parseGenogram, type ParseResult, type SourceMap } from "../core/parse";
import { buildScene, type SceneGraph } from "../core/scene";
import type { GenoDocument, Diagnostic } from "../core/model";

export const LS_KEY = "genogram.doc";

export const DEFAULT_DOC = `# Welcome to Genogram — this TOML *is* the document.
# Edit it directly, or click a person on the canvas for actions.

[meta]
title = "Example Family"

[people.george]
name = "George"
sex = "M"
birth = 1938
death = 2011

[people.rose]
name = "Rose"
sex = "F"
birth = 1941

[unions.george-rose]
partners = ["george", "rose"]
status = "married"
year = 1963

[people.frank]
name = "Frank"
sex = "M"
birth = 1965
parents = "george-rose"

[people.dana]
name = "Dana"
sex = "F"
birth = 1968

[unions.frank-dana]
partners = ["frank", "dana"]
status = "divorced"
year = 1990

[people.alex]
name = "Alex"
sex = "M"
birth = 1992
index = true
parents = "frank-dana"

[emotional.alex-frank]
between = ["alex", "frank"]
kind = "conflict"

[emotional.alex-rose]
between = ["alex", "rose"]
kind = "close"

[annotations.note-dana]
text = "remarried, lives in Ohio"
attach = "dana"

[layout]
george = [0, 0]
rose = [160, 0]
frank = [80, 140]
dana = [240, 140]
alex = [160, 280]
note-dana = [-24, 48]
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
      const s = buildScene(r.doc);
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
}

export const app = new AppState();

/** Imperative hooks the canvas registers so the toolbar can drive it. */
export const canvasApi: { zoomIn?: () => void; zoomOut?: () => void; zoomFit?: () => void } = {};
