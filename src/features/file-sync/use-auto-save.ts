import { useEffect } from "react";

import { useDocuments } from "@/stores/document";
import { useSettings } from "@/stores/settings";

import { cancelOnChangeSave, scheduleOnChangeSave } from "./on-change-auto-save";

/**
 * Drive auto-save when enabled: debounce a flush after each edit (and flush on
 * blur — see the editor's blur wiring). One document-store subscription covers
 * both the Crepe and source editors, since both edit through `setMarkdown`.
 * Only dirty documents that have a path are saved; untitled docs are skipped.
 */
export function useAutoSave(): void {
  const autoSave = useSettings((state) => state.autoSave);

  useEffect(() => {
    if (!autoSave) return;

    // Re-arm the debounce on every document-store change. The controller
    // self-gates, and flushDirtyDocuments is idempotent, so the store update
    // from a save itself just schedules a harmless no-op flush.
    const unsubscribe = useDocuments.subscribe(() => scheduleOnChangeSave());
    return () => {
      unsubscribe();
      cancelOnChangeSave();
    };
  }, [autoSave]);
}
