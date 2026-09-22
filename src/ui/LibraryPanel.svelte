<script lang="ts">
  import { app } from "./state.svelte";
  import { personShapes, decorations, unionLines, emotionalLines, childLinks } from "../core/registry";
  import { vnodeToString } from "../export/svg";
  import { dispatchEdits, editorText } from "./editor";
  import { appendToArray, setField } from "../core/surgeon";
  import { h, type VNode } from "../core/vnode";
  import { zigzagPath } from "../core/geom";
  import type { Person, Sex } from "../core/model";

  const svgWrap = (vnodes: VNode[], viewBox: string) => `<svg viewBox="${viewBox}" width="40" height="40">${vnodes.map(vnodeToString).join("")}</svg>`;
  const sample = (name: string, sex: Sex = "M"): Person => ({ id: `lib-${name}`, sex, index: false, decorations: [] });

  const shapeSwatch = (name: string) => svgWrap(personShapes.get(name)!.render(26), "-22 -22 44 44");
  const decoSwatch = (name: string) => {
    const sh = personShapes.get("M")!;
    const deco = decorations.get(name)!;
    return svgWrap([...sh.render(26), ...deco.render(sh.bounds(26), sample(name))], "-22 -22 44 44");
  };
  const unionSwatch = (name: string) => {
    const st = unionLines.get(name)!;
    const path = [
      { x: -18, y: 0 },
      { x: 18, y: 0 },
    ];
    return svgWrap([...st.renderLine(path), ...(st.renderAdornment?.({ x: 0, y: 0 }) ?? [])], "-22 -14 44 28");
  };
  const emoSwatch = (name: string) =>
    svgWrap(emotionalLines.get(name)!.render({ x: -20, y: -6, w: 12, h: 12 }, { x: 8, y: -6, w: 12, h: 12 }), "-22 -14 44 28");

  const selectedEl = $derived(app.selection.length === 1 ? (app.scene?.elements.find((e) => e.id === app.selection[0]) ?? null) : null);

  // color reference: field, which element kind it applies to, an example value, a swatch
  const STYLE_FIELDS = [
    {
      name: "person color",
      kind: "person",
      field: "color",
      example: "#7a5195",
      hint: "shape stroke; also inks decorations + badge border",
      swatch: svgWrap(personShapes.get("M")!.render(26, { fill: "white", stroke: "#7a5195" }), "-22 -22 44 44"),
    },
    {
      name: "person fill",
      kind: "person",
      field: "fill",
      example: "#f3e8fa",
      hint: "shape interior",
      swatch: svgWrap(personShapes.get("M")!.render(26, { fill: "#f3e8fa", stroke: "black" }), "-22 -22 44 44"),
    },
    {
      name: "name badge",
      kind: "person",
      field: "badge",
      example: "#e9d7f5",
      hint: "badge background",
      swatch: svgWrap([h("rect", { x: -16, y: -8, width: 32, height: 16, rx: 8, fill: "#e9d7f5", stroke: "#7a5195", "stroke-width": 1 })], "-22 -14 44 28"),
    },
    {
      name: "union color",
      kind: "union",
      field: "color",
      example: "#7a5195",
      hint: "line, slashes, and year label",
      swatch: svgWrap([h("line", { x1: -18, y1: 0, x2: 18, y2: 0, stroke: "#7a5195", "stroke-width": 1.5 })], "-22 -14 44 28"),
    },
    {
      name: "emotion color",
      kind: "emotional",
      field: "color",
      example: "#e07b39",
      hint: "overrides the kind's default color",
      swatch: svgWrap([h("path", { d: zigzagPath({ x: -18, y: 0 }, { x: 18, y: 0 }, 4, 9), fill: "none", stroke: "#e07b39", "stroke-width": 1.5 })], "-22 -14 44 28"),
    },
    {
      name: "note color",
      kind: "annotation",
      field: "color",
      example: "#888",
      hint: "annotation text color",
      swatch: svgWrap([h("text", { x: 0, y: 5, "text-anchor": "middle", "font-size": 14, fill: "#888" }, ["Aa"])], "-22 -14 44 28"),
    },
  ];

  const sections = $derived([
    {
      title: "Person shapes",
      entries: personShapes.names().map((n) => {
        const field = ["M", "F", "U"].includes(n) ? "sex" : "shape";
        return {
          name: n,
          swatch: shapeSwatch(n),
          snippet: `${field} = "${n}"`,
          canApply: selectedEl?.kind === "person",
          apply: () => dispatchEdits(setField(editorText(), app.map!, selectedEl!.id, field, n)),
        };
      }),
    },
    {
      title: "Decorations",
      entries: decorations.names().map((n) => ({
        name: n,
        swatch: decoSwatch(n),
        snippet: `decorations = ["${n}"]`,
        canApply: selectedEl?.kind === "person",
        apply: () => dispatchEdits(appendToArray(editorText(), app.map!, selectedEl!.id, "decorations", n)),
      })),
    },
    {
      title: "Union statuses",
      entries: unionLines.names().map((n) => ({
        name: n,
        swatch: unionSwatch(n),
        snippet: `status = "${n}"`,
        canApply: selectedEl?.kind === "union",
        apply: () => dispatchEdits(setField(editorText(), app.map!, selectedEl!.id, "status", n)),
      })),
    },
    {
      title: "Emotional kinds",
      entries: emotionalLines.names().map((n) => ({
        name: n,
        swatch: emoSwatch(n),
        snippet: `kind = "${n}"`,
        canApply: selectedEl?.kind === "emotional",
        apply: () => dispatchEdits(setField(editorText(), app.map!, selectedEl!.id, "kind", n)),
      })),
    },
    {
      title: "Child links",
      entries: childLinks.names().map((n) => ({
        name: n,
        swatch: svgWrap(
          [h("line", { x1: 0, y1: -14, x2: 0, y2: 14, stroke: "black", "stroke-width": 1.2, ...(childLinks.get(n)!.dash ? { "stroke-dasharray": childLinks.get(n)!.dash! } : {}) })],
          "-22 -18 44 36",
        ),
        snippet: `relation = "${n}"`,
        canApply: selectedEl?.kind === "person" && !!app.doc?.people.get(selectedEl.id)?.parents,
        apply: () => dispatchEdits(setField(editorText(), app.map!, selectedEl!.id, "relation", n)),
      })),
    },
    {
      title: "Colors & styling",
      entries: STYLE_FIELDS.map((f) => ({
        name: f.name,
        swatch: f.swatch,
        snippet: `${f.field} = "${f.example}"`,
        hint: f.hint,
        canApply: selectedEl?.kind === f.kind,
        apply: () => {
          const v = prompt(`${f.name} (any CSS color):`, f.example)?.trim();
          if (v) dispatchEdits(setField(editorText(), app.map!, selectedEl!.id, f.field, v));
        },
      })),
    },
  ]);

  const copy = (snippet: string) => navigator.clipboard?.writeText(snippet);
</script>

<aside>
  <header>
    <strong>Library</strong>
    <button class="close" onclick={() => (app.libraryOpen = false)}>×</button>
  </header>
  {#each sections as section (section.title)}
    <h3>{section.title}</h3>
    {#each section.entries as entry (entry.name)}
      <div class="row">
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        <span class="swatch">{@html entry.swatch}</span>
        <span class="name">
          {entry.name}
          <code>{entry.snippet}</code>
          {#if "hint" in entry && entry.hint}<small>{entry.hint}</small>{/if}
        </span>
        <span class="btns">
          <button title="copy TOML snippet" onclick={() => copy(entry.snippet)}>copy</button>
          {#if entry.canApply && !app.stale}
            <button title="apply to selection" onclick={entry.apply}>apply</button>
          {/if}
        </span>
      </div>
    {/each}
  {/each}
</aside>

<style>
  aside {
    width: 280px;
    flex: none;
    overflow-y: auto;
    border-left: 1px solid #ddd;
    background: white;
    padding: 8px 12px;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .close {
    border: none;
    background: none;
    font-size: 16px;
  }
  h3 {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #888;
    margin: 14px 0 4px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 2px 0;
  }
  .swatch {
    flex: none;
    width: 40px;
    height: 40px;
  }
  .name {
    flex: 1;
    display: flex;
    flex-direction: column;
    font-size: 12px;
  }
  code {
    font-size: 10px;
    color: #888;
  }
  small {
    font-size: 10px;
    color: #aaa;
  }
  .btns {
    display: flex;
    gap: 4px;
  }
  .btns button {
    font-size: 11px;
    border: 1px solid #ddd;
    background: white;
    border-radius: 5px;
    padding: 2px 6px;
  }
  .btns button:hover {
    background: #eef4fb;
  }
</style>
