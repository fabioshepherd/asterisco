import type { FindOptions } from "@/features/find-replace/find-utils";

/** A find query plus its matching options, as driven by the Find panel. */
export interface FindQuery {
  query: string;
  options: FindOptions;
}

/**
 * Per-mode bridge between the Find panel state and the live editor view. The
 * active editor (CodeMirror in source mode, ProseMirror/Crepe otherwise)
 * registers an implementation so the Find store can highlight, scroll to and
 * replace matches in whatever the user is actually looking at — matches are
 * computed against the editor's own text, not the markdown string.
 */
export interface EditorSearchController {
  /**
   * Recompute matches in the editor's own text, highlight them all (marking
   * `current` distinctly), and return the total count.
   */
  search: (query: FindQuery, current: number) => number;
  /** Scroll to, select and distinctly mark the match at `index` (no-op if out of range). */
  reveal: (index: number) => void;
  /** Remove all find decorations (panel closed or query cleared). */
  clear: () => void;
  /** Replace the currently revealed match with `replacement`; true if applied. */
  replaceCurrent: (query: FindQuery, replacement: string) => boolean;
  /** Replace every match with `replacement`. */
  replaceAll: (query: FindQuery, replacement: string) => void;
}

/**
 * Holds the controller for the currently mounted editor view so imperative Find
 * features can drive it without prop drilling. Exactly one is active at a time;
 * mirrors `active-editor.ts`.
 */
let controller: EditorSearchController | null = null;

export function setSearchController(next: EditorSearchController | null): void {
  controller = next;
}

export function getSearchController(): EditorSearchController | null {
  return controller;
}

/**
 * Clear the controller slot only if `next` currently owns it (safe when
 * instances overlap). Mirrors `clearActiveEditorIf` so one editor unmounting
 * can't wipe another editor's controller.
 */
export function clearSearchControllerIf(next: EditorSearchController): void {
  if (controller === next) controller = null;
}
