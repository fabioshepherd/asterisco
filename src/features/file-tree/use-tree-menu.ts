import { create } from "zustand";

export interface TreeMenuTarget {
  x: number;
  y: number;
  path: string;
  isDir: boolean;
}

interface TreeMenuState {
  target: TreeMenuTarget | null;
  open: (target: TreeMenuTarget) => void;
  close: () => void;
}

/** Position + target of the file-tree right-click context menu. */
export const useTreeMenu = create<TreeMenuState>()((set) => ({
  target: null,
  open: (target) => set({ target }),
  close: () => set({ target: null }),
}));
