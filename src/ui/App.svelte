<script lang="ts">
  import Toolbar from "./Toolbar.svelte";
  import EditorPane from "./EditorPane.svelte";
  import CanvasPane from "./CanvasPane.svelte";
  import LibraryPanel from "./LibraryPanel.svelte";
  import { app, DEFAULT_DOC, LS_KEY } from "./state.svelte";
  import { editorUndo, editorRedo, editorText, dispatchEdits } from "./editor";
  import { removeElements } from "../core/surgeon";
  import { selectionToTOML } from "./actions";

  const initial = (() => {
    try {
      return localStorage.getItem(LS_KEY) ?? DEFAULT_DOC;
    } catch {
      return DEFAULT_DOC;
    }
  })();

  let splitting = $state(false);

  function onKeydown(e: KeyboardEvent) {
    const t = e.target as HTMLElement;
    if (t.closest?.(".cm-editor") || t.tagName === "INPUT" || t.tagName === "TEXTAREA") return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) editorRedo();
      else editorUndo();
    } else if (mod && e.key.toLowerCase() === "y") {
      e.preventDefault();
      editorRedo();
    } else if ((e.key === "Delete" || e.key === "Backspace") && app.selection.length && app.doc && app.map && !app.stale) {
      e.preventDefault();
      dispatchEdits(removeElements(editorText(), app.map, app.doc, app.selection));
      app.selection = [];
    } else if (e.key === "Escape") {
      app.linkPick = null;
      app.selection = [];
    } else if (mod && e.key.toLowerCase() === "c" && app.selection.length && app.doc && app.map) {
      navigator.clipboard?.writeText(selectionToTOML({ doc: app.doc, map: app.map, text: editorText() }, app.selection));
    }
  }

  function onSplitMove(e: PointerEvent) {
    if (!splitting) return;
    const pct = (e.clientX / window.innerWidth) * 100;
    app.splitPct = Math.min(80, Math.max(15, pct));
  }
</script>

<svelte:window onkeydown={onKeydown} onpointermove={onSplitMove} onpointerup={() => (splitting = false)} />

<div class="app">
  <Toolbar />
  <div class="panes">
    {#if !app.editorCollapsed}
      <div class="editor" style="width: {app.canvasCollapsed ? '100%' : `${app.splitPct}%`}">
        <EditorPane {initial} />
      </div>
    {/if}
    {#if !app.editorCollapsed && !app.canvasCollapsed}
      <div
        class="divider"
        role="separator"
        aria-orientation="vertical"
        onpointerdown={(e) => {
          e.preventDefault();
          splitting = true;
        }}
      ></div>
    {/if}
    {#if !app.canvasCollapsed}
      <div class="canvas">
        <CanvasPane />
      </div>
    {/if}
    {#if app.libraryOpen}
      <LibraryPanel />
    {/if}
  </div>
</div>

<style>
  .app {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  .panes {
    flex: 1;
    display: flex;
    min-height: 0;
  }
  .editor {
    flex: none;
    min-width: 0;
    height: 100%;
  }
  .canvas {
    flex: 1;
    min-width: 0;
    height: 100%;
  }
  .divider {
    flex: none;
    width: 5px;
    cursor: col-resize;
    background: #eee;
  }
  .divider:hover {
    background: #d5e3f3;
  }
</style>
