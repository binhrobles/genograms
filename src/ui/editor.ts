import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { basicSetup } from "codemirror";
import { StreamLanguage } from "@codemirror/language";
import { toml } from "@codemirror/legacy-modes/mode/toml";
import { setDiagnostics, type Diagnostic as CMDiagnostic } from "@codemirror/lint";
import { autocompletion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { undo, redo } from "@codemirror/commands";
import { app } from "./state.svelte";
import type { TextEdit } from "../core/surgeon";
import { unionLines, emotionalLines, decorations, personShapes } from "../core/registry";
import "../core/registry/builtins";

let view: EditorView | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

export function createEditor(parent: HTMLElement, initialDoc: string): EditorView {
  view = new EditorView({
    parent,
    state: EditorState.create({
      doc: initialDoc,
      extensions: [
        basicSetup,
        StreamLanguage.define(toml),
        autocompletion({ override: [genogramCompletions] }),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
              app.reparse(u.state.doc.toString());
              pushDiagnostics();
            }, 150);
          }
          if (u.selectionSet) syncCursorHighlight(u.state.selection.main.head);
        }),
        EditorView.theme({
          "&": { height: "100%", fontSize: "13px" },
          ".cm-scroller": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
        }),
      ],
    }),
  });
  app.reparse(initialDoc);
  pushDiagnostics();
  return view;
}

export const getView = () => view;
export const editorText = (): string => view?.state.doc.toString() ?? "";

/** Apply surgeon edits as ONE transaction (one undo step), then reparse immediately. */
export function dispatchEdits(edits: TextEdit[], opts?: { select?: string }) {
  if (!view || edits.length === 0) return;
  view.dispatch({ changes: edits.map((e) => ({ from: e.from, to: e.to, insert: e.insert })) });
  clearTimeout(debounceTimer);
  app.reparse(view.state.doc.toString());
  pushDiagnostics();
  if (opts?.select) app.selection = [opts.select];
}

/** Replace the whole document (used by New / Open). Undoable like any edit. */
export function replaceAll(text: string) {
  if (!view) return;
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
  clearTimeout(debounceTimer);
  app.reparse(text);
  pushDiagnostics();
  app.selection = [];
}

export function pushDiagnostics() {
  if (!view) return;
  const len = view.state.doc.length;
  const diags: CMDiagnostic[] = app.diagnostics.map((d) => ({
    from: Math.min(d.range[0], len),
    to: Math.min(Math.max(d.range[1], d.range[0] + 1), len),
    severity: d.severity,
    message: d.message,
  }));
  view.dispatch(setDiagnostics(view.state, diags));
}

export function selectElementInEditor(id: string) {
  if (!view) return;
  const el = app.map?.elements.get(id);
  if (!el) return;
  view.dispatch({ selection: { anchor: el.header[0] }, scrollIntoView: true });
}

export const editorUndo = () => view && undo(view);
export const editorRedo = () => view && redo(view);

function syncCursorHighlight(pos: number) {
  const map = app.map;
  if (!map) return;
  let found: string | null = null;
  for (const [id, el] of map.elements)
    if (pos >= el.table[0] && pos <= el.table[1]) {
      found = id;
      break;
    }
  app.highlightedId = found;
}

/** Completions for status/kind/sex values and decorations arrays, sourced from the registries. */
function genogramCompletions(ctx: CompletionContext): CompletionResult | null {
  const line = ctx.state.doc.lineAt(ctx.pos);
  const before = line.text.slice(0, ctx.pos - line.from);
  const mk = (names: string[]) => names.map((label) => ({ label, type: "constant" as const }));
  let m = before.match(/(status|kind|sex)\s*=\s*"([\w-]*)$/);
  if (m) {
    const opts = m[1] === "status" ? unionLines.names() : m[1] === "kind" ? emotionalLines.names() : personShapes.names();
    return { from: ctx.pos - m[2].length, options: mk(opts) };
  }
  m = before.match(/decorations\s*=\s*\[[^\]]*"([\w-]*)$/);
  if (m) return { from: ctx.pos - m[1].length, options: mk(decorations.names()) };
  return null;
}
