import { create } from "zustand";

export type ViewMode = "edit" | "source" | "reading";

/**
 * Sidebar width in pixels. The tree indents 0.75rem per level, so a fixed panel
 * runs out of room in a `docs/` tree three folders deep; the floor is what still
 * shows a readable name at that depth, and the ceiling stops the panel from
 * eating the reading measure it exists to serve.
 */
export const SIDEBAR_WIDTH = { min: 180, max: 480, default: 240 } as const;

/** Clamp a width (a drag, an arrow key, or a persisted value) into range. */
export function clampSidebarWidth(value: number): number {
  if (!Number.isFinite(value)) return SIDEBAR_WIDTH.default;
  return Math.round(Math.min(SIDEBAR_WIDTH.max, Math.max(SIDEBAR_WIDTH.min, value)));
}

export interface UiState {
  /** Sidebar visibility (file tree). */
  sidebarVisible: boolean;
  /** Sidebar width in pixels, clamped to {@link SIDEBAR_WIDTH}. */
  sidebarWidth: number;
  /** Outline panel visibility (headings of the active document). */
  outlineVisible: boolean;
  /** Active document view (mutually exclusive). */
  viewMode: ViewMode;
  /** Distraction-free: hide all chrome (and go OS fullscreen). */
  distractionFree: boolean;
  toggleSidebar: () => void;
  setSidebarWidth: (px: number) => void;
  toggleOutline: () => void;
  /** Apply a persisted outline open/closed value at startup. */
  setOutlineVisible: (value: boolean) => void;
  setViewMode: (mode: ViewMode) => void;
  /** edit<->source toggle (keeps the existing keybinding behaviour). */
  toggleSource: () => void;
  /** edit<->reading toggle (keeps the existing keybinding behaviour). */
  toggleReading: () => void;
  toggleDistractionFree: () => void;
  setDistractionFree: (value: boolean) => void;
}

export const useUi = create<UiState>()((set) => ({
  sidebarVisible: true,
  sidebarWidth: SIDEBAR_WIDTH.default,
  outlineVisible: true,
  viewMode: "edit",
  distractionFree: false,
  toggleSidebar: () => set((state) => ({ sidebarVisible: !state.sidebarVisible })),
  setSidebarWidth: (px) => set({ sidebarWidth: clampSidebarWidth(px) }),
  // Showing the outline implies the sidebar is visible.
  toggleOutline: () =>
    set((state) =>
      state.outlineVisible
        ? { outlineVisible: false }
        : { outlineVisible: true, sidebarVisible: true },
    ),
  setOutlineVisible: (outlineVisible) => set({ outlineVisible }),
  setViewMode: (viewMode) => set({ viewMode }),
  toggleSource: () =>
    set((state) => ({ viewMode: state.viewMode === "source" ? "edit" : "source" })),
  toggleReading: () =>
    set((state) => ({ viewMode: state.viewMode === "reading" ? "edit" : "reading" })),
  toggleDistractionFree: () => set((state) => ({ distractionFree: !state.distractionFree })),
  setDistractionFree: (distractionFree) => set({ distractionFree }),
}));
