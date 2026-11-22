import { create } from "zustand";

/** 1-based caret coordinates, as a text editor counts them. */
export interface Caret {
  line: number;
  column: number;
}

export interface SelectionState {
  /** Plain text of the current editor selection ("" when nothing is selected). */
  text: string;
  /**
   * Caret line/column, or null where the view has no lines to count.
   * Only source mode feeds it: the WYSIWYG is a node tree, and a line number
   * invented for it would be a number the machine does not actually know.
   */
  caret: Caret | null;
  setText: (text: string) => void;
  setCaret: (caret: Caret | null) => void;
  clear: () => void;
}

/**
 * Live selection text and caret position, fed by the editors (Crepe WYSIWYG +
 * CodeMirror source mode) so the status bar can show per-selection word/character
 * counts and the cursor position. Selection text is kept as plain text and counted
 * with the same logic as the whole-document stats, so the two stay consistent.
 *
 * `clear()` means "nothing is selected" and deliberately leaves the caret alone —
 * a collapsed caret is the common case, not an absence of one. An editor that
 * unmounts nulls the caret explicitly.
 */
export const useSelection = create<SelectionState>()((set) => ({
  text: "",
  caret: null,
  setText: (text) => set({ text }),
  setCaret: (caret) => set({ caret }),
  clear: () => set({ text: "" }),
}));
