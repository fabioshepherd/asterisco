import { create } from "zustand";

export type UnsavedDecision = "save" | "discard" | "cancel";

interface UnsavedPromptState {
  isOpen: boolean;
  documentName: string;
  resolver: ((decision: UnsavedDecision) => void) | null;
  /** Open the prompt for a document and resolve with the user's choice. */
  requestDecision: (documentName: string) => Promise<UnsavedDecision>;
  /** Resolve the open prompt with a decision and close it. */
  resolve: (decision: UnsavedDecision) => void;
}

export const useUnsavedPrompt = create<UnsavedPromptState>()((set, get) => ({
  isOpen: false,
  documentName: "",
  resolver: null,
  requestDecision: (documentName) =>
    new Promise<UnsavedDecision>((resolve) => {
      // A prompt should never stack: cancel any in-flight one first.
      get().resolver?.("cancel");
      set({ isOpen: true, documentName, resolver: resolve });
    }),
  resolve: (decision) => {
    get().resolver?.(decision);
    set({ isOpen: false, documentName: "", resolver: null });
  },
}));

/** Imperative entry point for non-React code (file-ops orchestration). */
export function requestUnsavedDecision(documentName: string): Promise<UnsavedDecision> {
  return useUnsavedPrompt.getState().requestDecision(documentName);
}
