import { create } from "zustand";

interface NoticesDialogState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

/** Visibility of the third-party notices modal (Settings ▸ Advanced). */
export const useNoticesDialog = create<NoticesDialogState>()((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
