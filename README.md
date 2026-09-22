# Genogram

A local-first, text-first [genogram](https://en.wikipedia.org/wiki/Genogram) editor. The document is a TOML file, edited in a CodeMirror pane and rendered live on an interactive SVG canvas beside it — Mermaid-live-editor style. UI actions (add child, drag to move, toggle deceased, …) write **surgical text edits** back into the TOML, so your comments and formatting are never touched.

## Run

```sh
npm install
npm run dev     # local dev server
npm test        # core engine tests (vitest)
npm run build   # static build in dist/
```

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml` (enable Pages → "GitHub Actions" in repo settings).

## Document format

```toml
[meta]
title = "My Family"

[people.ada]
name = "Ada"
sex = "F"              # "M" square | "F" circle | "U" diamond
birth = 1990
death = 2085           # presence adds the deceased ✗
index = true           # double border (the "self" of the genogram)
decorations = ["substance-abuse"]   # combinable, extensible
parents = "mom-dad"    # union id, or a person id for single-parent

[unions.mom-dad]
partners = ["mom", "dad"]
status = "divorced"    # married | divorced | separated | cohabiting | dating
year = 1988

[emotional.ada-mom]
between = ["ada", "mom"]
kind = "close"         # close | fused | conflict | fused-conflict | cutoff | distant

[annotations.n1]
text = "moved to NYC"
attach = "ada"         # optional; attached notes move with the person

[layout]               # machine-managed positions; drag on the canvas to update
ada = [0, 0]
```

The **Library** panel (toolbar → library) lists every registered shape, decoration, union status, and emotional kind with a live swatch, its TOML snippet, and an apply-to-selection button. The same registry feeds editor autocomplete inside `status = "…"`, `kind = "…"`, `sex = "…"`, and `decorations = […]`.

## Architecture

One-way loop: the editor text is the only mutable state.

```
TOML text ─parse→ Document + SourceMap + Diagnostics ─resolve→ SceneGraph ─→ SVG canvas / export
   ↑                                                                              │
   └────────────── surgeon (targeted text edits) ←──────────── UI actions & drags ┘
```

- `src/core/` — framework-agnostic engine: parser (`toml-eslint-parser`), validator, visual registries, scene builder, placement heuristics, and the TOML surgeon. Fully unit-tested in Node.
- `src/ui/` — Svelte 5 shell: CodeMirror pane, SVG canvas (pan/zoom/select/drag/marquee), contextual action bar, library panel.
- `src/export/` — SceneGraph → standalone SVG string; PNG via canvas rasterization.

Undo/redo is just CodeMirror history — a drag, an action-bar click, and hand-typing are all the same kind of edit.

### Adding a new symbol

Write a module in `src/core/registry/` that implements `PersonShape`, `Decoration`, `UnionLineStyle`, or `EmotionalLineStyle`, register it, and import it from `builtins.ts`. It automatically appears in the library panel, in autocomplete, and renders anywhere the TOML references it. Unknown names never crash — they render a fallback with a warning diagnostic.
