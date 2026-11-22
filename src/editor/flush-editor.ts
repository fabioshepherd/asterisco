import { useDocuments } from "@/stores/document";
import { useUi } from "@/stores/ui";

import { getActiveEditor, getEditorsForDoc } from "./active-editor";

/**
 * Push the active editor's current content into the document store, so a read
 * of `doc.markdown` for output (save, save-as, export, copy, auto-save) never
 * lags the screen. Crepe only reports edits through Milkdown's ~200 ms debounced
 * `markdownUpdated` listener; this serializes the live view right now instead.
 *
 * Only the focused editor is flushed, and only when it renders `docId`: another
 * instance of the same doc may hold older content and must not overwrite it.
 * Source mode needs nothing — CodeMirror writes the store on every change, while
 * the hidden Crepe view is stale until source mode closes, so it is skipped.
 *
 * `setMarkdown` is a no-op for unchanged content, so flushing a clean document
 * never marks it dirty, and the dirty/baseline rules of `markSaved` still hold.
 */
export function flushActiveEditor(docId: string): void {
  if (useUi.getState().viewMode === "source") return;
  const editor = getActiveEditor();
  if (!editor || !getEditorsForDoc(docId).includes(editor)) return;
  let markdown: string;
  try {
    markdown = editor.getMarkdown();
  } catch {
    return; // editor mid-teardown; the store keeps the last reported content
  }
  useDocuments.getState().setMarkdown(docId, markdown);
}
