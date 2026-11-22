import { editorViewCtx } from "@milkdown/kit/core";
import type { Ctx } from "@milkdown/kit/ctx";
import type { EditorState } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";

/** Convenience: read the editor view out of a ctx. */
export function viewFromCtx(ctx: Ctx): EditorView {
  return ctx.get(editorViewCtx);
}

/**
 * True inside a code block or under an inline `code` mark: typing helpers
 * (auto-pairing, footnote completion) must skip there. Inline math needs no
 * special case: it is an atom node with no editable inline text, so the caret
 * never sits "inside" it.
 */
export function isRawTextContext(state: EditorState): boolean {
  const { $from } = state.selection;
  if ($from.parent.type.spec.code) return true;
  const codeMark = state.schema.marks.code;
  return Boolean(codeMark && codeMark.isInSet($from.marks()));
}
