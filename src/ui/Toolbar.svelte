<script lang="ts">
  import { app, canvasApi, DEFAULT_DOC } from "./state.svelte";
  import { editorUndo, editorRedo, replaceAll } from "./editor";
  import { saveTOML, openTOMLFile, exportSVG, exportPNG } from "./files";

  let fileInput: HTMLInputElement;
  let layersOpen = $state(false);
  const LAYER_LABELS = { names: "names", years: "birth years", decorations: "decorations", emotional: "emotional links", annotations: "notes" } as const;

  function newDoc() {
    if (confirm("Replace the current document with the example? (Undo still works.)")) replaceAll(DEFAULT_DOC);
  }
  function onOpen(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) openTOMLFile(file);
    (e.target as HTMLInputElement).value = "";
  }
  const errors = $derived(app.diagnostics.filter((d) => d.severity === "error").length);
</script>

<header>
  <span class="title">{app.doc?.title ?? "Genogram"}</span>

  <span class="group">
    <button onclick={newDoc}>new</button>
    <button onclick={() => fileInput.click()}>open</button>
    <button onclick={saveTOML}>save</button>
    <input type="file" accept=".toml" bind:this={fileInput} onchange={onOpen} hidden />
  </span>

  <span class="group">
    <button onclick={editorUndo}>↶</button>
    <button onclick={editorRedo}>↷</button>
  </span>

  <span class="group">
    <button onclick={() => canvasApi.zoomOut?.()}>−</button>
    <button onclick={() => canvasApi.zoomFit?.()}>fit</button>
    <button onclick={() => canvasApi.zoomIn?.()}>+</button>
  </span>

  <span class="group">
    <button onclick={exportSVG}>export svg</button>
    <button onclick={() => exportPNG()}>export png</button>
  </span>

  <span class="group layerswrap">
    <button class:active={layersOpen} onclick={() => (layersOpen = !layersOpen)}>layers</button>
    {#if layersOpen}
      <div class="popover">
        {#each Object.entries(LAYER_LABELS) as [key, text] (key)}
          <label>
            <input
              type="checkbox"
              checked={app.layers[key as keyof typeof app.layers]}
              onchange={() => app.toggleLayer(key as keyof typeof app.layers)}
            />
            {text}
          </label>
        {/each}
      </div>
    {/if}
  </span>

  <span class="spacer"></span>

  {#if errors > 0}
    <span class="errors">{errors} error{errors === 1 ? "" : "s"}</span>
  {/if}

  <span class="group">
    <button class:active={!app.editorCollapsed} onclick={() => (app.editorCollapsed = !app.editorCollapsed)} disabled={app.canvasCollapsed}>toml</button>
    <button class:active={!app.canvasCollapsed} onclick={() => (app.canvasCollapsed = !app.canvasCollapsed)} disabled={app.editorCollapsed}>canvas</button>
    <button class:active={app.libraryOpen} onclick={() => (app.libraryOpen = !app.libraryOpen)}>library</button>
    <a class="about" href="https://github.com/binhrobles/genograms" target="_blank" rel="noopener noreferrer">about</a>
  </span>
</header>

<style>
  header {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 6px 12px;
    border-bottom: 1px solid #ddd;
    background: #f7f7f7;
    flex: none;
  }
  .title {
    font-weight: 600;
    margin-right: 4px;
  }
  .group {
    display: flex;
    gap: 2px;
  }
  .spacer {
    flex: 1;
  }
  button {
    border: 1px solid transparent;
    background: none;
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 12px;
  }
  button:hover:not(:disabled) {
    background: #ececec;
  }
  button:disabled {
    opacity: 0.4;
  }
  button.active {
    border-color: #ccc;
    background: white;
  }
  .errors {
    font-size: 12px;
    color: #b3261e;
  }
  .about {
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 12px;
    color: inherit;
    text-decoration: none;
  }
  .about:hover {
    background: #ececec;
  }
  .layerswrap {
    position: relative;
  }
  .popover {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 4px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    background: white;
    border: 1px solid #ccc;
    border-radius: 8px;
    padding: 8px 10px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
    z-index: 20;
    font-size: 12px;
    white-space: nowrap;
  }
  .popover label {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
  }
</style>
