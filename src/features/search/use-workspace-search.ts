import { create } from "zustand";

interface WorkspaceSearchState {
  isOpen: boolean;
  /**
   * Bumped by every `open()`. The panel focuses its input when this changes, so
   * opening an already-open panel still brings the caret back to it.
   */
  focusRequest: number;
  open: () => void;
  close: () => void;
}

/** Visibility of the workspace (full-text) search panel. */
export const useWorkspaceSearch = create<WorkspaceSearchState>()((set) => ({
  isOpen: false,
  focusRequest: 0,
  open: () => set((state) => ({ isOpen: true, focusRequest: state.focusRequest + 1 })),
  close: () => set({ isOpen: false }),
}));
