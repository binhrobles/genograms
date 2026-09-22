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
birth = 1990           # numbers or strings: "~1930", "192?", "c. 1930", "1990-03-02"
death = 2085           # presence adds the deceased ✗; strings render verbatim
index = true           # double border (the "self" of the genogram)
decorations = ["alcoholism"]        # combinable, extensible; built-ins:
                       #   alcoholism / substance-abuse (bottom-half fill),
                       #   in-recovery (bottom-half hatch), mental-illness (left half),
                       #   physical-illness (right half), deceased, index
parents = "mom-dad"    # union id, or a person id for single-parent
shape = "miscarriage"  # optional shape override: miscarriage (dot) | pregnancy
                       # (triangle) | abortion (small ✗) — hang off a union via
                       # `parents` like any child; use `birth` for the date.
                       # Stillbirth: keep the sex shape + "deceased" decoration.
color = "#7a5195"      # optional: shape stroke, decoration ink, badge border
fill = "#f3e8fa"       # optional: shape interior
badge = "#e9d7f5"      # optional: name badge background

[unions.mom-dad]
partners = ["mom", "dad"]
status = "divorced"    # married | divorced | separated | cohabiting | dating | affair
year = 1988
color = "#7a5195"      # optional: line color
# The union line connects partners side-to-side (elbowing if they sit at
# different heights). 1–2 children drop straight from it; 3+ children share
# a single stem plus a sibling bus. "Married but cut off" is a union PLUS an
# emotional link between the same pair — the emotional line automatically
# renders offset above the union line, keeping the space below for children.

[emotional.ada-mom]
between = ["ada", "mom"]
kind = "close"         # close | fused | conflict | fused-conflict | cutoff | distant
                       # | harmony | love | distrust | indifferent
                       # directional kinds (between[0] acts on between[1]):
                       # | caretaker (arrow) | fixation (dot at target) | abuse (zigzag + arrow)
color = "#e07b39"      # optional: overrides the kind's default color

[annotations.n1]
text = """multiline works —
use TOML triple-quoted strings"""
attach = "ada"         # optional; attached notes move with the person
color = "#888"         # optional: text color

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
