import { create } from "zustand";

import type { TextFormat } from "@/lib/text-format";

/** An open document in the editor. `path` is null until the file is saved to disk. */
export interface EditorDocument {
  readonly id: string;
  /** Absolute path on disk, or null for an unsaved (untitled) document. */
  path: string | null;
  /** Current editor content. */
  markdown: string;
  /**
   * Editor-normalized content as last loaded or saved — the baseline used to
   * decide dirtiness. WYSIWYG round-trips normalize markdown, so comparing
   * against this (not the raw file) avoids false "dirty" on open/switch.
   */
  savedMarkdown: string;
  isDirty: boolean;
  /** Whether the editor's normalized baseline has been captured (first mount). */
  baselineReady: boolean;
  /**
   * How the backing file spells its text (line endings, BOM, final newline),
   * re-applied on save. Absent for a document not read from a file.
   */
  format?: TextFormat;
}

export interface DocumentState {
  documents: EditorDocument[];
  activeId: string | null;
  /** Ordered open document ids, as shown in the tab strip. */
  tabs: string[];
  /** Create a document (untitled by default) in a new tab and make it active. Returns its id. */
  createDocument: (init?: { path?: string; markdown?: string; format?: TextFormat }) => string;
  /** Update a document's markdown; dirty when it diverges from the baseline. */
  setMarkdown: (id: string, markdown: string) => void;
  /** Adopt the editor's normalized content as the clean baseline (on load). */
  setBaseline: (id: string, markdown: string) => void;
  /**
   * Mark a document saved. `savedMarkdown` is the EXACT content written to disk
   * (snapshotted before the async write). The baseline becomes that snapshot;
   * dirty is cleared only if the live content still equals it, so edits typed
   * during the write stay dirty and flush next cycle (no silent data loss).
   */
  markSaved: (id: string, savedMarkdown: string, path?: string) => void;
  /** Replace content from disk (external change/reload): new baseline, not dirty. */
  applyExternalContent: (id: string, markdown: string, format?: TextFormat) => void;
  /**
   * Adopt what is on disk as the baseline without touching the live content
   * (the user kept their version over an external change, or a tool only
   * re-encoded the file). Dirty when the live content differs from it.
   */
  adoptDiskBaseline: (id: string, savedMarkdown: string, format: TextFormat) => void;
  /**
   * Mark a document whose backing file was deleted externally: forces it dirty
   * so the unsaved indicator shows and the content is treated as needing a
   * save. The tab and its content are kept so the user can re-save.
   */
  markExternallyDeleted: (id: string) => void;
  /** Make a document active (no-op if it does not exist). */
  setActiveDocument: (id: string) => void;
  /** Close a document; reactivates the last remaining one (or none). */
  closeDocument: (id: string) => void;
  /** Re-point any open document at `oldPath` to `newPath` (after a rename). */
  updatePath: (oldPath: string, newPath: string) => void;

  /** Move a tab to `toIndex` in the strip (clamped). */
  reorderTab: (id: string, toIndex: number) => void;
  /** Reorder the active tab by one slot. Clamps at the ends. */
  moveActiveTab: (delta: -1 | 1) => void;
}

/** Resolve the currently active document, or undefined when none is open. */
export function selectActiveDocument(state: DocumentState): EditorDocument | undefined {
  return state.documents.find((doc) => doc.id === state.activeId);
}

/** Human-readable name for a document: its file name, or the untitled label. */
export function documentDisplayName(
  doc: EditorDocument | undefined,
  untitledLabel: string,
): string {
  return doc?.path?.split(/[/\\]/).pop() ?? untitledLabel;
}

export const useDocuments = create<DocumentState>()((set, get) => ({
  documents: [],
  activeId: null,
  tabs: [],
  createDocument: (init) => {
    const id = crypto.randomUUID();
    const markdown = init?.markdown ?? "";
    const doc: EditorDocument = {
      id,
      path: init?.path ?? null,
      markdown,
      savedMarkdown: markdown,
      isDirty: false,
      baselineReady: false,
      ...(init?.format ? { format: init.format } : {}),
    };
    set((state) => ({
      documents: [...state.documents, doc],
      tabs: state.tabs.includes(id) ? state.tabs : [...state.tabs, id],
      activeId: id,
    }));
    return id;
  },
  setMarkdown: (id, markdown) =>
    set((state) => ({
      documents: state.documents.map((doc) =>
        doc.id === id && doc.markdown !== markdown
          ? { ...doc, markdown, isDirty: markdown !== doc.savedMarkdown }
          : doc,
      ),
    })),
  setBaseline: (id, markdown) =>
    set((state) => ({
      documents: state.documents.map((doc) =>
        // Only the first mount establishes the baseline; later remounts (tab
        // switches) must not reset it and wipe the dirty flag.
        doc.id === id && !doc.baselineReady
          ? {
              ...doc,
              markdown,
              savedMarkdown: markdown,
              isDirty: false,
              baselineReady: true,
            }
          : doc,
      ),
    })),
  markSaved: (id, savedMarkdown, path) =>
    set((state) => ({
      documents: state.documents.map((doc) =>
        doc.id === id
          ? {
              ...doc,
              // Baseline is exactly what we wrote. Stay dirty if the live
              // content has moved on (user typed during the async write), so
              // the newer content is persisted on the next save/flush.
              savedMarkdown,
              isDirty: doc.markdown !== savedMarkdown,
              path: path ?? doc.path,
            }
          : doc,
      ),
    })),
  applyExternalContent: (id, markdown, format) =>
    set((state) => ({
      documents: state.documents.map((doc) =>
        doc.id === id
          ? {
              ...doc,
              markdown,
              savedMarkdown: markdown,
              isDirty: false,
              baselineReady: true,
              ...(format ? { format } : {}),
            }
          : doc,
      ),
    })),
  adoptDiskBaseline: (id, savedMarkdown, format) =>
    set((state) => ({
      documents: state.documents.map((doc) =>
        doc.id === id
          ? { ...doc, savedMarkdown, format, isDirty: doc.markdown !== savedMarkdown }
          : doc,
      ),
    })),
  markExternallyDeleted: (id) =>
    set((state) => ({
      documents: state.documents.map((doc) => (doc.id === id ? { ...doc, isDirty: true } : doc)),
    })),
  setActiveDocument: (id) =>
    set((state) =>
      state.documents.some((doc) => doc.id === id) && state.tabs.includes(id)
        ? { activeId: id }
        : {},
    ),
  closeDocument: (id) =>
    set((state) => {
      const tabs = state.tabs.filter((tab) => tab !== id);
      // Keep the current tab if it is still open, else fall back to the last one.
      const activeId =
        state.activeId && tabs.includes(state.activeId) ? state.activeId : (tabs.at(-1) ?? null);
      return { documents: state.documents.filter((doc) => doc.id !== id), tabs, activeId };
    }),
  updatePath: (oldPath, newPath) =>
    set((state) => ({
      documents: state.documents.map((doc) =>
        doc.path === oldPath ? { ...doc, path: newPath } : doc,
      ),
    })),
  reorderTab: (id, toIndex) =>
    set((state) => {
      if (!state.tabs.includes(id)) return {};
      const tabs = state.tabs.filter((tab) => tab !== id);
      tabs.splice(Math.max(0, Math.min(toIndex, tabs.length)), 0, id);
      return { tabs };
    }),
  moveActiveTab: (delta) => {
    const { tabs, activeId, reorderTab } = get();
    if (!activeId) return;
    const from = tabs.indexOf(activeId);
    if (from < 0) return;
    const to = Math.min(Math.max(from + delta, 0), tabs.length - 1);
    if (to === from) return;
    reorderTab(activeId, to);
  },
}));
