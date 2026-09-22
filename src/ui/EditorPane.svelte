<script lang="ts">
  import { onMount } from "svelte";
  import { createEditor } from "./editor";

  let { initial }: { initial: string } = $props();
  let container: HTMLDivElement;

  onMount(() => {
    const view = createEditor(container, initial);
    return () => view.destroy();
  });
</script>

<div class="host" bind:this={container}></div>

<style>
  .host {
    height: 100%;
    overflow: hidden;
    border-right: 1px solid #ddd;
  }
  .host :global(.cm-editor) {
    height: 100%;
  }
</style>
