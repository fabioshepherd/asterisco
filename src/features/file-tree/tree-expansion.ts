import { create } from "zustand";

interface TreeExpansionState {
  /**
   * Explicit open/closed state per directory path. A path that is absent has
   * never been decided by anyone, and the node falls back to its own default —
   * which is what lets the root start open without that counting as a choice
   * the user made.
   *
   * The map lives out here because collapsing a folder unmounts its entire
   * subtree. With the flag inside `TreeNode`, closing the root threw away every
   * descendant's expansion, and reopening it gave back a bare list instead of
   * the shape the user had built.
   */
  expanded: Record<string, boolean>;
  setExpanded: (path: string, value: boolean) => void;
  /** Flip a directory, given the default it falls back to when undecided. */
  toggle: (path: string, fallback: boolean) => void;
  /**
   * Open a directory only if nobody has decided for it yet. Reveal-follows-
   * document uses this so it can locate a file without reopening a branch the
   * user closed on purpose.
   */
  expandIfUnset: (path: string) => void;
  /**
   * Close every directory but the root. The root stays open because collapsing
   * it would leave the panel showing a single row and nothing to navigate.
   */
  collapseAll: (rootPath: string) => void;
  /** Forget everything — a different workspace is a different tree. */
  reset: () => void;
}

export const useTreeExpansion = create<TreeExpansionState>()((set) => ({
  expanded: {},
  setExpanded: (path, value) =>
    set((state) => ({ expanded: { ...state.expanded, [path]: value } })),
  toggle: (path, fallback) =>
    set((state) => ({
      expanded: { ...state.expanded, [path]: !(state.expanded[path] ?? fallback) },
    })),
  expandIfUnset: (path) =>
    set((state) =>
      state.expanded[path] === undefined
        ? { expanded: { ...state.expanded, [path]: true } }
        : state,
    ),
  collapseAll: (rootPath) => set({ expanded: { [rootPath]: true } }),
  reset: () => set({ expanded: {} }),
}));

/** Whether any directory below `rootPath` is currently open. */
export function hasOpenBranches(expanded: Record<string, boolean>, rootPath: string): boolean {
  return Object.entries(expanded).some(([path, open]) => open && path !== rootPath);
}
