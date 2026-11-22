import { create } from "zustand";

import { selectActiveDocument, useDocuments } from "@/stores/document";
import { useUi } from "@/stores/ui";
import { useWorkspace } from "@/stores/workspace";

interface TreeFocusState {
  /** Bumped on every request; the tree focuses its tab stop when it changes. */
  token: number;
  request: () => void;
}

export const useTreeFocus = create<TreeFocusState>()((set) => ({
  token: 0,
  request: () => set((state) => ({ token: state.token + 1 })),
}));

/**
 * Put keyboard focus on the file tree, opening the panel first if it is closed.
 *
 * Thirteen actions were bound to keys and none of them reached the tree, so the
 * only way in was a Tab walk through the chrome. Asking for the tree implies
 * wanting to see it, so this also leaves distraction-free.
 *
 * The token is bumped on the next frame rather than inline: when the panel was
 * closed, `FileTree` does not exist yet at this point, and a token it never saw
 * change would be a request it never answers.
 */
export function focusFileTree(): void {
  const { sidebarVisible, distractionFree, setDistractionFree, toggleSidebar } = useUi.getState();
  if (distractionFree) setDistractionFree(false);
  if (!sidebarVisible) toggleSidebar();
  requestAnimationFrame(() => useTreeFocus.getState().request());
}

/**
 * Locate the open document in the tree, on purpose.
 *
 * Following the active document is a preference and it deliberately will not
 * reopen a folder closed by hand, so there has to be one action that always
 * does: asking where a file lives should never be answered with silence.
 */
export function revealActiveDocument(): void {
  const path = selectActiveDocument(useDocuments.getState())?.path ?? null;
  if (path) revealInTree(path);
}

/**
 * Same, for a file that is open but not the active one — a tab you right-clicked
 * without switching to it. Outside the workspace `revealPath` no-ops, so callers
 * only offer this where the file is actually locatable.
 */
export function revealInTree(path: string): void {
  const { sidebarVisible, distractionFree, setDistractionFree, toggleSidebar } = useUi.getState();
  if (distractionFree) setDistractionFree(false);
  if (!sidebarVisible) toggleSidebar();
  useWorkspace.getState().revealPath(path, { force: true });
}
