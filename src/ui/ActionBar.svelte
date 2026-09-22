<script lang="ts">
  import { app } from "./state.svelte";
  import { dispatchEdits, editorText } from "./editor";
  import { removeElements, type TextEdit } from "../core/surgeon";
  import { emotionalLines, unionLines, decorations } from "../core/registry";
  import { addPartner, addChild, addSibling, addParent, addNote, toggleDecoration, hasDecoration, type Ctx } from "./actions";

  let { pos }: { pos: { left: number; top: number } } = $props();
  let openMenu = $state<"person" | "union" | "emotion" | "decoration" | null>(null);

  const single = $derived(app.selection.length === 1 ? (app.scene?.elements.find((e) => e.id === app.selection[0]) ?? null) : null);
  const singlePerson = $derived(single?.kind === "person" ? single.id : null);
  const singleUnion = $derived(single?.kind === "union" ? single.id : null);
  const parentsRef = $derived(singlePerson ? app.doc?.people.get(singlePerson)?.parents : undefined);

  const ctx = (): Ctx => ({ doc: app.doc!, map: app.map!, text: editorText() });
  const ready = $derived(!!app.doc && !!app.map && !app.stale);

  type NamedAction = (c: Ctx, id: string, name: string) => { edits: TextEdit[]; newId: string } | null;
  function withName(label: string, fn: NamedAction, id: string) {
    openMenu = null;
    const name = prompt(label)?.trim();
    if (!name) return;
    const r = fn(ctx(), id, name);
    if (r) dispatchEdits(r.edits, { select: r.newId });
  }

  const personMenu = $derived(
    singlePerson
      ? [
          { label: "parent", prompt: "Parent's name?", fn: addParent, disabled: !!parentsRef && !!app.doc?.unions.has(parentsRef) },
          { label: "partner", prompt: "Partner's name?", fn: addPartner, disabled: false },
          { label: "child", prompt: "Child's name?", fn: addChild, disabled: false },
          { label: "sibling", prompt: "Sibling's name?", fn: addSibling, disabled: !parentsRef },
        ]
      : [],
  );

  function del() {
    dispatchEdits(removeElements(editorText(), app.map!, app.doc!, app.selection));
    app.selection = [];
  }

  function startLink(kind: string, union: boolean) {
    openMenu = null;
    if (singlePerson) app.linkPick = { kind, from: singlePerson, union };
  }

  function applyDecoration(name: string) {
    openMenu = null;
    if (singlePerson) dispatchEdits(toggleDecoration(ctx(), singlePerson, name));
  }

  function toggleMenu(which: typeof openMenu) {
    openMenu = openMenu === which ? null : which;
  }
</script>

{#if ready && app.selection.length > 0}
  <div class="bar" style="left: {pos.left}px; top: {pos.top}px">
    {#if singlePerson}
      <span class="menuwrap">
        <button onclick={() => toggleMenu("person")}>+ person</button>
        {#if openMenu === "person"}
          <div class="menu">
            {#each personMenu as item (item.label)}
              <button onclick={() => withName(item.prompt, item.fn, singlePerson)} disabled={item.disabled}>{item.label}</button>
            {/each}
          </div>
        {/if}
      </span>
      <span class="menuwrap">
        <button onclick={() => toggleMenu("union")} title="union with an existing person">+ union</button>
        {#if openMenu === "union"}
          <div class="menu">
            {#each unionLines.names() as status (status)}
              <button onclick={() => startLink(status, true)}>{status}</button>
            {/each}
          </div>
        {/if}
      </span>
      <span class="menuwrap">
        <button onclick={() => toggleMenu("emotion")} title="emotional link with an existing person">+ emotion</button>
        {#if openMenu === "emotion"}
          <div class="menu">
            {#each emotionalLines.names() as kind (kind)}
              <button onclick={() => startLink(kind, false)}>{kind}</button>
            {/each}
          </div>
        {/if}
      </span>
      <span class="menuwrap">
        <button onclick={() => toggleMenu("decoration")} title="toggle decorations">+ decoration</button>
        {#if openMenu === "decoration"}
          <div class="menu">
            {#each decorations.names() as name (name)}
              {@const active = hasDecoration(ctx(), singlePerson, name)}
              <button class:active onclick={() => applyDecoration(name)}>{active ? "✓ " : ""}{name}</button>
            {/each}
          </div>
        {/if}
      </span>
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
  .menuwrap {
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
  .menu button.active {
    color: #1a5daa;
  }
</style>
