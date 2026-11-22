import { create } from "zustand";

import { focusOrigin, returnFocus } from "@/lib/focus-return";

/**
 * Element focused when the panel opened. Closing unmounts the sheet from `App`
 * (after its exit animation), so Radix has nothing to restore focus to: the
 * store does it, while the sheet is still on screen. Module-level, like the
 * find panel's origin — it never drives a render.
 */
let origin: HTMLElement | null = null;

/** Return focus if it is still in the sheet that is closing (or on `<body>`). */
function leavePanel(): void {
  const target = origin;
  origin = null;
  if (typeof document === "undefined") return;
  returnFocus(target, document.querySelector("[data-settings-panel]"));
}

interface SettingsPanelState {
  isOpen: boolean;
  /**
   * Section to scroll to the next time the panel opens (e.g. a menu entry jumps
   * straight to "shortcuts"). Consumed once by the panel, then cleared.
   */
  initialSection: string | null;
  open: (section?: string) => void;
  close: () => void;
  toggle: () => void;
  /** Read and clear the pending initial section. */
  consumeInitialSection: () => string | null;
}

/** Visibility of the settings side sheet. */
export const useSettingsPanel = create<SettingsPanelState>()((set, get) => ({
  isOpen: false,
  initialSection: null,
  open: (section) => {
    if (!get().isOpen) origin = focusOrigin();
    set({ isOpen: true, initialSection: section ?? null });
  },
  close: () => {
    if (!get().isOpen) return;
    set({ isOpen: false });
    leavePanel();
  },
  toggle: () => {
    if (get().isOpen) get().close();
    else get().open();
  },
  consumeInitialSection: () => {
    const { initialSection } = get();
    if (initialSection !== null) set({ initialSection: null });
    return initialSection;
  },
}));
