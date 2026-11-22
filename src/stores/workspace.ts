import { create } from "zustand";

import { saveWorkspaceRoot } from "@/lib/tauri/settings-store";

export interface WorkspaceState {
  /** Absolute path of the opened folder, or null when none is open. */
  rootPath: string | null;
  /** Bumped to force the file tree to reload (after a create/rename/delete). */
  treeVersion: number;
  /**
   * Ancestors of the path the tree has been asked to reveal, plus the path
   * itself. `TreeNode` opens itself when it is in this set, so a file opened
   * from a tab, quick-open, search or recents can be located in the tree.
   * Bumped through `revealToken` so revealing the same file twice still works.
   */
  revealPaths: Set<string>;
  revealToken: number;
  /**
   * Whether this reveal may reopen a folder the user closed by hand.
   *
   * Following the active document must not: switching tabs would then undo a
   * deliberate collapse over and over. Asking for the file explicitly must,
   * because otherwise the command would do nothing and never say why.
   */
  revealForce: boolean;
  setRoot: (path: string) => void;
  closeWorkspace: () => void;
  refreshTree: () => void;
  revealPath: (path: string | null, options?: { force?: boolean }) => void;
}

/** Display name (last path segment) for a folder path. */
export function workspaceName(path: string | null): string | null {
  if (!path) return null;
  return path.split(/[/\\]/).filter(Boolean).pop() ?? path;
}

/** The folder containing `path`, or null at the filesystem root. */
export function parentFolder(path: string | null): string | null {
  if (!path) return null;
  const trimmed = path.replace(/[/\\]+$/, "");
  const cut = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  if (cut <= 0) return null;
  return trimmed.slice(0, cut);
}

/**
 * Every ancestor directory of `path` within `root`, inclusive of both ends.
 * Separator-agnostic so Windows paths behave like POSIX ones.
 */
export function ancestorsWithin(path: string, root: string): Set<string> {
  const out = new Set<string>();
  const base = root.replace(/[/\\]+$/, "");
  // Prefix *and* separator boundary: a raw prefix test would make `/x/proj`
  // "contain" `/x/project2/a.md` and emit reveal paths that match no node.
  const rest = path.startsWith(base) ? path.slice(base.length) : null;
  if (rest === null) return out;
  if (rest !== "" && !/^[/\\]/.test(rest)) return out;
  out.add(root);
  const segments = rest.split(/[/\\]/).filter(Boolean);
  if (segments.length === 0) return out;
  const separator = path.includes("\\") && !path.includes("/") ? "\\" : "/";
  let current = base;
  for (const segment of segments) {
    current = `${current}${separator}${segment}`;
    out.add(current);
  }
  return out;
}

export const useWorkspace = create<WorkspaceState>()((set, get) => ({
  rootPath: null,
  treeVersion: 0,
  revealPaths: new Set(),
  revealToken: 0,
  revealForce: false,
  setRoot: (rootPath) => {
    set({ rootPath, revealPaths: new Set(), revealToken: 0, revealForce: false });
    void saveWorkspaceRoot(rootPath);
  },
  closeWorkspace: () => {
    set({ rootPath: null, revealPaths: new Set(), revealToken: 0, revealForce: false });
    void saveWorkspaceRoot(null);
  },
  refreshTree: () => set((state) => ({ treeVersion: state.treeVersion + 1 })),
  revealPath: (path, options) => {
    const { rootPath } = get();
    if (!path || !rootPath) return;
    const revealPaths = ancestorsWithin(path, rootPath);
    if (revealPaths.size === 0) return; // outside the workspace: nothing to open
    set((state) => ({
      revealPaths,
      revealToken: state.revealToken + 1,
      revealForce: options?.force === true,
    }));
  },
}));
