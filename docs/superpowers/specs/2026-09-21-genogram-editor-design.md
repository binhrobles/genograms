# Genogram Editor — Design Spec

**Date:** 2026-09-21
**Status:** Approved design, pre-implementation

## Purpose

A local-first genogram builder/editor for personal use. Existing tools are
either too simple or paywall the interesting notation. This app is a
Mermaid-style text-first editor: a TOML definition file is the single source
of truth, rendered live on an interactive SVG canvas beside it. UI actions
are conveniences that write TOML; hand-editing the TOML is a first-class
workflow (custom decorations, comments, bulk edits).

- **Stack:** Vite + Svelte 5 + TypeScript, CodeMirror 6, `toml-eslint-parser`, Vitest.
- **Hosting:** static build on GitHub Pages (deployed via GitHub Actions). No backend; everything client-side.
- **Users:** one (the author). No auth, no collaboration, no mobile requirements.

## Scope

### V1 vocabulary

- **People:** male (square) / female (circle) / unknown (diamond + `?`); index
  person (double border); deceased (✗ overlay); birth/death years; name labels;
  free-text notes; extensible combinable decorations.
- **Family lines:** unions (marriage, divorce, separation, cohabitation,
  dating) rendered as the standard partnership bus below the pair, with
  status-derived line style and adornments (e.g. divorce = double slash);
  child drop-lines from the union line; single-parent child links; multiple
  unions per person (remarriage).
- **Emotional relationship lines:** close, fused, conflict, fused-conflict,
  cutoff, distant (extensible), drawn as arcs between any two people.
- **Annotations:** free-floating or person-attached text labels.

### Deferred (designed-for, not built)

- Reproductive events (pregnancy, miscarriage, abortion, stillbirth), twins,
  adopted/foster child links, pets. The schema and registries accommodate
  these as new person shapes / child-link kinds without structural change.
- Playwright e2e suite; "insert legend into diagram" export option.

### Explicit non-goals for v1

- Automatic full-graph layout. Placement is manual with smart defaults only.
- Multiple simultaneous documents; one active document at a time.

## Document format (TOML)

The document is one TOML file. Top-level tables:

```toml
[meta]
title = "Robles Family"

[people.binh]
name = "Binh"
sex = "M"                 # "M" | "F" | "U"; default "U"
birth = 1994              # number or string date; rendered as label
death = 2075              # presence implies the "deceased" decoration
index = true              # sugar for the "index" decoration (double border)
decorations = ["substance-abuse"]   # extensible; array order = draw order
notes = "shown in tooltip/inspector only, never on canvas"

[people.kai]
name = "Kai"
parents = "binh-mai"      # union id, or a person id for single-parent link

[unions.binh-mai]
partners = ["binh", "mai"]   # exactly 2 person ids
status = "married"           # married | divorced | separated | cohabiting | dating
year = 2020                  # optional label ("m. 2020")
decorations = []             # extensible line adornments

[emotional.kai-binh]
between = ["kai", "binh"]    # exactly 2 person ids
kind = "close"               # close | fused | conflict | fused-conflict | cutoff | distant

[annotations.note1]
text = "moved to NYC 2018"
attach = "binh"              # optional; attached notes move with the person

[layout]
binh = [0, 0]                # people and annotations only
mai = [160, 0]
kai = [80, 140]
note1 = [0, 40]              # attached annotations: offset from their person
```

### Semantics

- **Only people and annotations have layout entries.** Union buses, child
  drop-lines, and emotional arcs are derived from endpoint positions, so
  dragging a person drags all their lines.
- **Sibling order:** default placement slots children by `birth` year, falling
  back to declaration order; thereafter order is simply x-position.
- **`status` / `kind` are semantic;** rendering is derived via registries.
  Unknown statuses, kinds, or decoration names render with a fallback style +
  badge and emit a warning diagnostic — never a crash.
- **Validation diagnostics** (with line/col from the parser): unknown person
  refs, unions with ≠2 partners, duplicate ids, unknown decoration/status/kind
  names, layout entries for nonexistent ids, cyclic `parents` references.
  Errors show in the editor gutter; the canvas keeps the last good parse and
  shows a "stale" indicator until the file parses again.

## Architecture

```
TOML text ──parse──▶ Document + SourceMap + Diagnostics
Document ──resolve──▶ SceneGraph (geometry + VNodes)
SceneGraph ──▶ Svelte SVG canvas  /  SVG export string
UI action ──surgeon──▶ text edit ──▶ CodeMirror doc ──▶ (loop back to parse)
```

**The one-way loop invariant:** the CodeMirror document is the only mutable
state. Canvas gestures and buttons never mutate the model; they compose
surgeon edits dispatched to CodeMirror, and the change flows back through
parse → scene → render. Hand-typed edits and UI edits are indistinguishable,
so the panes can never disagree.

### Core engine (`src/core/`, framework-agnostic TS)

No Svelte imports; fully testable in Node.

- **`parse.ts`** — wraps `toml-eslint-parser`. Emits the `Document` model, a
  **SourceMap** (`elementId → AST ranges` for every table/key — the basis for
  surgical edits), and `Diagnostic[]`.
- **`model.ts`** — plain data types: `Person`, `Union`, `EmotionalLink`,
  `Annotation`, `Layout`. Serializable, dumb.
- **`scene.ts`** — resolves the model into a `SceneGraph`: shape nodes with
  bounds, union bus polylines, child drop-lines, emotional arcs, labels. The
  single input for both live canvas and SVG export.
- **`placement.ts`** — pure smart-default placement for newly created
  elements: `placePartner` (beside), `placeChild` (south of union midpoint,
  x-slotted by birth among siblings), `placeSibling`. Never moves existing
  elements.
- **`surgeon.ts`** — write-back layer over the SourceMap. Intent-level
  operations, each returning `{from, to, insert}` text edits:
  `setLayoutEntry(id, xy)`, `addTable(kind, id, fields)`,
  `setField(id, key, value)`, `appendToArray(id, key, value)`,
  `removeElement(id)` (table + layout line + dangling refs),
  `renameId(old, new)`. Bytes outside touched ranges are never rewritten —
  comments and formatting survive all UI edits.

### Registries (extensibility)

All visuals are produced through registries returning lightweight virtual
SVG nodes (`VNode = {tag, attrs, children}`), shared by canvas and export:

```ts
interface PersonShape {              // keyed by sex: square, circle, diamond
  render(size: number): VNode[];
  bounds(size: number): Box;         // decorations & connections anchor here
}
interface Decoration {               // combinable overlays, keyed by name
  render(box: Box, person: Person): VNode[];
  layer: "under" | "over";           // fills under, ✗/border over
}
interface UnionLineStyle {           // keyed by union status
  renderLine(path: Point[]): VNode[];
  renderAdornment?(midpoint: Point): VNode[];   // divorce slashes, etc.
}
interface EmotionalLineStyle {       // keyed by kind
  render(from: Box, to: Box): VNode[];
}
```

Each registry is a `Map` with `register(name, impl)`. Adding a symbol = one
module + one register call. `index = true` and `death` are sugar that resolve
to the `"index"` / `"deceased"` decorations, so built-ins and user-specified
`decorations = [...]` flow through the identical mechanism.

Registries are also the documentation source (see Library panel) and the
autocomplete source — they cannot drift from reality.

## UI

Single-page Svelte 5 app.

- **Shell:** two resizable panes — editor left, canvas right — each
  independently collapsible. Top toolbar: New / Open / Save (.toml),
  Export SVG / PNG, undo/redo, zoom controls, Library toggle.
- **Editor pane:** CodeMirror 6; TOML highlighting; diagnostics as gutter
  markers + squiggles; section folding; ~150 ms debounced reparse;
  autocomplete for `status`, `kind`, and `decorations` values sourced from
  the registries.
- **Canvas pane:** SVG viewport. Pan (space-drag / trackpad), zoom
  (pinch / ctrl-wheel / buttons). Click / shift-click / marquee selection.
  Drag moves selection (attached annotations follow); the gesture previews
  locally and commits one `setLayoutEntry` per moved element in a single
  history transaction on release — one drag = one undo step.
- **Contextual action bar** near the selection: Add partner · Add child ·
  Add sibling · Add emotional link (pick kind, then click the other person) ·
  Toggle deceased · Set as index · Add note · Delete. New-person actions
  prompt for a name; ids are slugified and de-duped (`kai-2`).
- **Selection sync, both ways:** canvas click scrolls/highlights the TOML
  table; editor cursor inside a table highlights the canvas element.
- **Library panel:** collapsible pane/overlay generated from the registries —
  every shape, decoration, union status, and emotional kind rendered as a live
  swatch with its name and invoking TOML snippet. Per entry: **copy snippet**,
  and **apply to selection** (dispatches a surgeon edit) when applicable.

## History, persistence, export

- **Undo/redo:** CodeMirror history, globally bound (works with canvas
  focused). No other state exists to undo.
- **Autosave:** debounced TOML text → localStorage; restored on load.
  Save = download `.toml`; Open = file picker or drag-and-drop.
- **Copy/paste:** v1 copies the selected elements' TOML text to the clipboard;
  paste of TOML text inserts tables (ids de-duped) near the cursor/viewport.
- **Export:** SceneGraph → standalone SVG string (computed bounds + padding,
  inlined styles) → download; PNG via offscreen canvas rasterization at 2×.

## Error handling summary

- Parse errors: gutter diagnostics; canvas holds last good scene + stale badge.
- Semantic errors (bad refs, arity): diagnostics; offending element omitted or
  rendered with fallback, rest of scene unaffected.
- Unknown registry names: fallback visual + warning diagnostic.
- Surgeon edits are computed against the current parse's SourceMap and applied
  atomically as one CodeMirror transaction; if the document is currently
  unparseable, structural UI actions are disabled (drag of last-good scene is
  too, since layout ranges are stale).

## Testing

- **Vitest (core, headless — the bulk):** parser→model fixtures; diagnostic
  cases; placement heuristics; registry fallback behavior; **property tests on
  the surgeon** (parse → edit → reparse round-trips preserve comments and
  untouched formatting byte-for-byte).
- **Component smoke tests** (Vitest browser mode / @testing-library/svelte):
  selection → action bar appears; action dispatches expected text edit.
- **Interactive QA during development:** agent-browser drives Chromium against
  `vite dev` — click/drag/type/screenshot — for visual verification of
  notation rendering at the end of each feature.
- SVG-structure assertions are preferred over pixel comparisons (canvas is
  SceneGraph-derived SVG, so structure is deterministic).

## Project structure

```
src/
  core/            # framework-agnostic engine
    parse.ts  model.ts  scene.ts  placement.ts  surgeon.ts
    registry/      # shapes/, decorations/, union-lines/, emotional-lines/
  ui/              # Svelte 5 components
    App.svelte  EditorPane.svelte  CanvasPane.svelte
    ActionBar.svelte  LibraryPanel.svelte  Toolbar.svelte
  export/          # svg.ts, png.ts
docs/superpowers/specs/
```
