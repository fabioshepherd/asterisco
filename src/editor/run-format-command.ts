import type { CmdKey } from "@milkdown/kit/core";
import { commandsCtx } from "@milkdown/kit/core";
import type { Ctx } from "@milkdown/kit/ctx";
import type { EditorView } from "@milkdown/kit/prose/view";

import { useUi } from "@/stores/ui";

import { getActiveEditor } from "./active-editor";
import { viewFromCtx } from "./editor-view";

/**
 * Dispatch a Milkdown command on the active editor (used by the Format menu and
 * the command palette). Focuses the editor view first so the command targets the
 * live selection.
 *
 * Guarded so it only acts on the WYSIWYG document, approximating native menu
 * validation: a no-op outside edit mode (reading/source), or when focus is in a
 * CodeMirror surface (a code block, or source mode). This matters because on
 * macOS these run from native menu key-equivalents, which fire app-wide.
 */
export function runFormatCommand<T>(command: CmdKey<T>, payload?: T): void {
  withEditView((view, ctx) => {
    view.focus();
    ctx.get(commandsCtx).call(command, payload);
  });
}

/**
 * Run `fn` with the active WYSIWYG view, only in Edit mode and not while a
 * source (CodeMirror) editor has focus.
 */
export function withEditView(fn: (view: EditorView, ctx: Ctx) => void): void {
  if (useUi.getState().viewMode !== "edit") return;
  if (typeof document !== "undefined" && document.activeElement?.closest(".cm-editor")) return;
  getActiveEditor()?.editor.action((ctx) => {
    const view = viewFromCtx(ctx);
    // `editorViewCtx` is an empty placeholder until the view mounts; guard like
    // CrepeEditor's selectionUpdated handler so we never touch a half-built view.
    if (!view?.state) return;
    fn(view, ctx);
  });
}
