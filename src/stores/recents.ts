import { create } from "zustand";

const MAX_RECENTS = 8;

export interface RecentsState {
  /** Recently opened file paths, most recent first. */
  recents: string[];
  /** Recently opened workspace folder paths, most recent first. */
  recentFolders: string[];
  addRecent: (path: string) => void;
  removeRecent: (path: string) => void;
  setRecents: (paths: string[]) => void;
  clearRecents: () => void;
  addRecentFolder: (path: string) => void;
  removeRecentFolder: (path: string) => void;
  setRecentFolders: (paths: string[]) => void;
  clearRecentFolders: () => void;
}

/** Insert `path` at the front, de-duplicated, capped at {@link MAX_RECENTS}. */
function promote(list: string[], path: string): string[] {
  return [path, ...list.filter((p) => p !== path)].slice(0, MAX_RECENTS);
}

export const useRecents = create<RecentsState>()((set) => ({
  recents: [],
  recentFolders: [],
  addRecent: (path) => set((state) => ({ recents: promote(state.recents, path) })),
  removeRecent: (path) => set((state) => ({ recents: state.recents.filter((p) => p !== path) })),
  setRecents: (paths) => set({ recents: paths.slice(0, MAX_RECENTS) }),
  clearRecents: () => set({ recents: [] }),
  addRecentFolder: (path) =>
    set((state) => ({ recentFolders: promote(state.recentFolders, path) })),
  removeRecentFolder: (path) =>
    set((state) => ({ recentFolders: state.recentFolders.filter((p) => p !== path) })),
  setRecentFolders: (paths) => set({ recentFolders: paths.slice(0, MAX_RECENTS) }),
  clearRecentFolders: () => set({ recentFolders: [] }),
}));
