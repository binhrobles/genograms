<script lang="ts">
  import { app } from "./state.svelte";
  import { dispatchEdits, editorText } from "./editor";
  import { removeElements } from "../core/surgeon";
  import { emotionalLines } from "../core/registry";
  import { addPartner, addChild, addSibling, addNote, toggleDeceased, setIndex, type Ctx } from "./actions";

  let { pos }: { pos: { left: number; top: number } } = $props();
  let showLinkKinds = $state(false);

  const single = $derived(app.selection.length === 1 ? (app.scene?.elements.find((e) => e.id === app.selection[0]) ?? null) : null);
  const singlePerson = $derived(single?.kind === "person" ? single.id : null);
  const singleUnion = $derived(single?.kind === "union" ? single.id : null);

  const ctx = (): Ctx => ({ doc: app.doc!, map: app.map!, text: editorText() });
  const ready = $derived(!!app.doc && !!app.map && !app.stale);

  function withName(label: string, fn: (c: Ctx, id: string, name: string) => { edits: import("../core/surgeon").TextEdit[]; newId: string } | null, id: string) {
    const name = prompt(label)?.trim();
    if (!name) return;
    const r = fn(ctx(), id, name);
    if (r) dispatchEdits(r.edits, { select: r.newId });
  }

  function del() {
    dispatchEdits(removeElements(editorText(), app.map!, app.doc!, app.selection));
    app.selection = [];
  }

  function startLink(kind: string) {
    showLinkKinds = false;
    if (singlePerson) app.linkPick = { kind, from: singlePerson };
  }
</script>

{#if ready && app.selection.length > 0}
  <div class="bar" style="left: {pos.left}px; top: {pos.top}px">
    {#if singlePerson}
      <button onclick={() => withName("Partner's name?", addPartner, singlePerson)}>+ partner</button>
      <button onclick={() => withName("Child's name?", addChild, singlePerson)}>+ child</button>
      <button onclick={() => withName("Sibling's name?", addSibling, singlePerson)} disabled={!app.doc?.people.get(singlePerson)?.parents} title="needs a parents ref">+ sibling</button>
      <span class="linkwrap">
        <button onclick={() => (showLinkKinds = !showLinkKinds)}>+ link</button>
        {#if showLinkKinds}
          <div class="menu">
            {#each emotionalLines.names() as kind (kind)}
              <button onclick={() => startLink(kind)}>{kind}</button>
            {/each}
          </div>
        {/if}
      </span>
      <button onclick={() => dispatchEdits(toggleDeceased(ctx(), singlePerson))}>† deceased</button>
      <button onclick={() => dispatchEdits(setIndex(ctx(), singlePerson))}>◎ index</button>
      <button onclick={() => withName("Note text?", addNote, singlePerson)}>+ note</button>
    {:else if singleUnion}
      <button onclick={() => withName("Child's name?", addChild, singleUnion)}>+ child</button>
    {/if}
    <button class="danger" onclick={del}>delete</button>
  </div>
{/if}

<style>
  .bar {
    position: absolute;
    transform: translate(-50%, -100%);
    display: flex;
    gap: 2px;
    background: white;
    border: 1px solid #ccc;
    border-radius: 8px;
    padding: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
    white-space: nowrap;
    z-index: 10;
  }
  button {
    border: none;
    background: none;
    padding: 3px 7px;
    border-radius: 5px;
    font-size: 12px;
  }
  button:hover:not(:disabled) {
    background: #eef4fb;
  }
  button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .danger:hover {
    background: #fdecea;
    color: #b3261e;
  }
  .linkwrap {
    position: relative;
  }
  .menu {
    position: absolute;
    top: 100%;
    left: 0;
    display: flex;
    flex-direction: column;
    background: white;
    border: 1px solid #ccc;
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
    z-index: 11;
  }
  .menu button {
    text-align: left;
  }
</style>
