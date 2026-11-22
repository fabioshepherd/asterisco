import { getCurrentWindow } from "@tauri-apps/api/window";

import { flushActiveEditor } from "@/editor/flush-editor";
import i18n from "@/i18n";
import { log } from "@/lib/log";
import { documentDisplayName, useDocuments } from "@/stores/document";

import { saveWithFeedback } from "./file-ops";
import { requestUnsavedDecision } from "./use-unsaved-prompt";

/**
 * Prompt to resolve every dirty document before the window/app closes.
 *
 * For each dirty document the user picks save / discard / cancel:
 * - "cancel" aborts the whole close (returns false, stops iterating);
 * - "save" persists the document (with success/error feedback); a
 *   failed/cancelled save also aborts;
 * - "discard" leaves it unsaved and moves on.
 *
 * Returns true only when every dirty document has been handled.
 */
export async function confirmCloseAllDirty(): Promise<boolean> {
  const untitled = i18n.t("untitled", { ns: "editor" });
  const active = useDocuments.getState().activeId;
  if (active) flushActiveEditor(active); // pending debounced edits must be seen as dirty
  const dirty = useDocuments.getState().documents.filter((doc) => doc.isDirty);

  for (const doc of dirty) {
    const decision = await requestUnsavedDecision(documentDisplayName(doc, untitled));
    if (decision === "cancel") return false;
    if (decision === "save" && !(await saveWithFeedback(doc.id))) return false;
  }

  return true;
}

/**
 * Resolve unsaved documents, then destroy the window when the user confirms.
 * Shared by the title-bar close guard and the native quit menu item so both
 * follow the same flow. A rejection here must never escape as an unhandled
 * promise rejection.
 */
export async function closeWindowIfConfirmed(): Promise<void> {
  try {
    if (await confirmCloseAllDirty()) await getCurrentWindow().destroy();
  } catch (error) {
    log.error("Failed to close window", error);
  }
}
