import type { Crepe } from "@milkdown/crepe";

/**
 * Holds the currently mounted editor instance so imperative features
 * (find & replace, etc.) can push content without remounting it.
 */
let activeEditor: Crepe | null = null;

export function setActiveEditor(editor: Crepe | null): void {
  activeEditor = editor;
}

export function getActiveEditor(): Crepe | null {
  return activeEditor;
}

/** Clear the active-editor slot only if `editor` currently owns it (safe when instances overlap). */
export function clearActiveEditorIf(editor: Crepe): void {
  if (activeEditor === editor) activeEditor = null;
}

/**
 * Editors currently mounted, keyed by the document id they render. Instances of
 * the same doc can briefly overlap (a StrictMode remount), so a doc maps to a SET
 * of editors. Used by the file watcher to push external content into every live
 * instance showing the changed document.
 */
const editorsByDoc = new Map<string, Set<Crepe>>();

/** Register `editor` as currently rendering document `docId`. */
export function registerEditor(docId: string, editor: Crepe): void {
  let set = editorsByDoc.get(docId);
  if (!set) {
    set = new Set<Crepe>();
    editorsByDoc.set(docId, set);
  }
  set.add(editor);
}

/** Remove `editor` from `docId`; drops the entry once its set is empty. */
export function unregisterEditor(docId: string, editor: Crepe): void {
  const set = editorsByDoc.get(docId);
  if (!set) return;
  set.delete(editor);
  if (set.size === 0) editorsByDoc.delete(docId);
}

/** All mounted editors currently rendering `docId` (empty when none). */
export function getEditorsForDoc(docId: string): Crepe[] {
  const set = editorsByDoc.get(docId);
  return set ? [...set] : [];
}
