<script lang="ts">
  import { onMount } from "svelte";
  import { app, canvasApi } from "./state.svelte";
  import { vnodeToString } from "../export/svg";
  import { dispatchEdits, selectElementInEditor, editorText } from "./editor";
  import { setLayoutEntry, type TextEdit } from "../core/surgeon";
  import { boxesIntersect, type Box } from "../core/geom";
  import { addEmotional } from "./actions";
  import type { SceneElement } from "../core/scene";
  import ActionBar from "./ActionBar.svelte";

  let svgEl: SVGSVGElement;
  let vw = $state(800);
  let vh = $state(600);
  let cam = $state({ x: -120, y: -140, k: 1 });
  let spaceHeld = $state(false);

  type Drag =
    | { mode: "pan"; sx: number; sy: number; cx: number; cy: number }
    | { mode: "move"; sx: number; sy: number; moved: boolean }
    | { mode: "marquee"; sx: number; sy: number; ex: number; ey: number };
  let drag = $state<Drag | null>(null);
  let delta = $state({ x: 0, y: 0 });

  const viewBox = $derived(`${cam.x} ${cam.y} ${Math.max(1, vw / cam.k)} ${Math.max(1, vh / cam.k)}`);
  const selectedSet = $derived(new Set(app.selection));
  const marqueeBox = $derived.by((): Box | null => {
    if (drag?.mode !== "marquee") return null;
    const { sx, sy, ex, ey } = drag;
    return { x: Math.min(sx, ex), y: Math.min(sy, ey), w: Math.abs(ex - sx), h: Math.abs(ey - sy) };
  });
  const selectionBBox = $derived.by((): Box | null => {
    const els = (app.scene?.elements ?? []).filter((e) => selectedSet.has(e.id));
    if (!els.length) return null;
    const x1 = Math.min(...els.map((e) => e.bounds.x));
    const y1 = Math.min(...els.map((e) => e.bounds.y));
    const x2 = Math.max(...els.map((e) => e.bounds.x + e.bounds.w));
    const y2 = Math.max(...els.map((e) => e.bounds.y + e.bounds.h));
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  });
  const barPos = $derived.by(() => {
    if (!selectionBBox || drag) return null;
    return {
      left: (selectionBBox.x + selectionBBox.w / 2 - cam.x) * cam.k,
      top: (selectionBBox.y - cam.y) * cam.k - 14,
    };
  });

  function clientToWorld(e: { clientX: number; clientY: number }) {
    const r = svgEl.getBoundingClientRect();
    return { x: cam.x + (e.clientX - r.left) / cam.k, y: cam.y + (e.clientY - r.top) / cam.k };
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const w = clientToWorld(e);
      const k2 = Math.min(4, Math.max(0.15, cam.k * Math.exp(-e.deltaY * 0.01)));
      cam = { k: k2, x: w.x - (w.x - cam.x) * (cam.k / k2), y: w.y - (w.y - cam.y) * (cam.k / k2) };
    } else {
      cam = { ...cam, x: cam.x + e.deltaX / cam.k, y: cam.y + e.deltaY / cam.k };
    }
  }

  function bgPointerDown(e: PointerEvent) {
    svgEl.setPointerCapture(e.pointerId);
    if (e.button === 1 || spaceHeld) {
      drag = { mode: "pan", sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y };
    } else if (e.button === 0) {
      const w = clientToWorld(e);
      drag = { mode: "marquee", sx: w.x, sy: w.y, ex: w.x, ey: w.y };
    }
  }

  function elPointerDown(e: PointerEvent, el: SceneElement) {
    e.stopPropagation();
    if (e.button === 1 || spaceHeld) {
      svgEl.setPointerCapture(e.pointerId);
      drag = { mode: "pan", sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y };
      return;
    }
    if (e.button !== 0) return;
    if (app.linkPick && el.kind === "person") {
      const { from, kind } = app.linkPick;
      app.linkPick = null;
      if (el.id !== from && app.doc && app.map) {
        const r = addEmotional({ doc: app.doc, map: app.map, text: editorText() }, from, el.id, kind);
        dispatchEdits(r.edits, { select: r.newId });
      }
      return;
    }
    if (e.shiftKey) {
      app.selection = selectedSet.has(el.id) ? app.selection.filter((i) => i !== el.id) : [...app.selection, el.id];
    } else if (!selectedSet.has(el.id)) {
      app.selection = [el.id];
    }
    selectElementInEditor(el.id);
    svgEl.setPointerCapture(e.pointerId);
    if (el.draggable && !app.stale) drag = { mode: "move", sx: e.clientX, sy: e.clientY, moved: false };
  }

  function onPointerMove(e: PointerEvent) {
    if (!drag) return;
    if (drag.mode === "pan") {
      cam = { ...cam, x: drag.cx - (e.clientX - drag.sx) / cam.k, y: drag.cy - (e.clientY - drag.sy) / cam.k };
    } else if (drag.mode === "move") {
      delta = { x: (e.clientX - drag.sx) / cam.k, y: (e.clientY - drag.sy) / cam.k };
      if (Math.hypot(delta.x, delta.y) > 2) drag.moved = true;
    } else {
      const w = clientToWorld(e);
      drag.ex = w.x;
      drag.ey = w.y;
    }
  }

  function onPointerUp() {
    if (!drag) return;
    if (drag.mode === "move" && drag.moved && app.map) {
      const text = editorText();
      const edits: TextEdit[] = [];
      for (const el of app.scene?.elements ?? []) {
        if (selectedSet.has(el.id) && el.draggable && el.layoutPos) {
          edits.push(...setLayoutEntry(text, app.map, el.id, [el.layoutPos[0] + delta.x, el.layoutPos[1] + delta.y]));
        }
      }
      dispatchEdits(edits);
    } else if (drag.mode === "marquee") {
      const box = marqueeBox!;
      if (box.w > 4 || box.h > 4) {
        app.selection = (app.scene?.elements ?? []).filter((el) => el.selectable && boxesIntersect(box, el.bounds)).map((el) => el.id);
      } else {
        app.selection = [];
      }
    }
    drag = null;
    delta = { x: 0, y: 0 };
  }

  const isDragged = (el: SceneElement) => drag?.mode === "move" && selectedSet.has(el.id) && el.draggable;

  function zoomBy(f: number) {
    const cx = cam.x + vw / cam.k / 2;
    const cy = cam.y + vh / cam.k / 2;
    const k2 = Math.min(4, Math.max(0.15, cam.k * f));
    cam = { k: k2, x: cx - vw / k2 / 2, y: cy - vh / k2 / 2 };
  }
  function zoomFit() {
    const b = app.scene?.bbox;
    if (!b || b.w === 0 || b.h === 0) return;
    const k = Math.min(4, Math.max(0.15, Math.min(vw / b.w, vh / b.h)));
    cam = { k, x: b.x + b.w / 2 - vw / k / 2, y: b.y + b.h / 2 - vh / k / 2 };
  }

  onMount(() => {
    canvasApi.zoomIn = () => zoomBy(1.25);
    canvasApi.zoomOut = () => zoomBy(0.8);
    canvasApi.zoomFit = zoomFit;
    zoomFit();
    const down = (e: KeyboardEvent) => {
      if (e.key === " " && !(e.target as HTMLElement).closest?.(".cm-editor")) spaceHeld = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === " ") spaceHeld = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  });
</script>

<div class="wrap" bind:clientWidth={vw} bind:clientHeight={vh} class:panning={spaceHeld}>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <svg
    bind:this={svgEl}
    {viewBox}
    role="application"
    aria-label="genogram canvas"
    onwheel={onWheel}
    onpointerdown={bgPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
  >
    {#each app.scene?.elements ?? [] as el (el.id)}
      <g transform={isDragged(el) ? `translate(${delta.x}, ${delta.y})` : undefined}>
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html el.vnodes.map(vnodeToString).join("")}
        {#if el.selectable}
          <rect
            class="hit"
            data-id={el.id}
            role="button"
            tabindex="-1"
            x={el.bounds.x}
            y={el.bounds.y}
            width={el.bounds.w}
            height={el.bounds.h}
            onpointerdown={(e) => elPointerDown(e, el)}
          />
        {/if}
        {#if selectedSet.has(el.id) || app.highlightedId === el.id}
          <rect
            class="sel"
            class:hl={!selectedSet.has(el.id)}
            x={el.bounds.x - 4}
            y={el.bounds.y - 4}
            width={el.bounds.w + 8}
            height={el.bounds.h + 8}
          />
        {/if}
      </g>
    {/each}
    {#if marqueeBox}
      <rect class="marquee" x={marqueeBox.x} y={marqueeBox.y} width={marqueeBox.w} height={marqueeBox.h} />
    {/if}
  </svg>

  {#if app.stale}
    <div class="badge stale">TOML has errors — canvas shows the last good parse</div>
  {/if}
  {#if app.linkPick}
    <div class="badge pick">Click another person to add a “{app.linkPick.kind}” link (Esc to cancel)</div>
  {/if}
  {#if barPos && !app.stale}
    <ActionBar pos={barPos} />
  {/if}
</div>

<style>
  .wrap {
    position: relative;
    height: 100%;
    overflow: hidden;
    background: #fafafa;
  }
  .wrap.panning {
    cursor: grab;
  }
  svg {
    width: 100%;
    height: 100%;
    display: block;
    touch-action: none;
  }
  .hit {
    fill: transparent;
    stroke: none;
    cursor: pointer;
  }
  .sel {
    fill: none;
    stroke: #4a90d9;
    stroke-width: 1.5;
    stroke-dasharray: 4 3;
    pointer-events: none;
  }
  .sel.hl {
    stroke: #b0cbe8;
  }
  .marquee {
    fill: rgba(74, 144, 217, 0.08);
    stroke: #4a90d9;
    stroke-width: 1;
    pointer-events: none;
  }
  .badge {
    position: absolute;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    padding: 4px 12px;
    border-radius: 6px;
    font-size: 12px;
    pointer-events: none;
  }
  .stale {
    background: #fdecea;
    color: #b3261e;
    border: 1px solid #f5c6c2;
  }
  .pick {
    background: #e8f1fb;
    color: #1a5daa;
    border: 1px solid #b0cbe8;
  }
</style>
