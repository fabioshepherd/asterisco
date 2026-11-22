import { create } from "zustand";

interface AboutDialogState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

/** Visibility of the About panel (app menu on macOS, Help on Windows/Linux). */
export const useAboutDialog = create<AboutDialogState>()((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
