<script lang="ts">
  import { app } from "./state.svelte";
  import { personShapes, decorations, unionLines, emotionalLines } from "../core/registry";
  import { vnodeToString } from "../export/svg";
  import { dispatchEdits, editorText } from "./editor";
  import { appendToArray, setField } from "../core/surgeon";
  import type { VNode } from "../core/vnode";
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

  const sections = $derived([
    {
      title: "Person shapes",
      entries: personShapes.names().map((n) => ({
        name: n,
        swatch: shapeSwatch(n),
        snippet: `sex = "${n}"`,
        canApply: selectedEl?.kind === "person",
        apply: () => dispatchEdits(setField(editorText(), app.map!, selectedEl!.id, "sex", n)),
      })),
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
