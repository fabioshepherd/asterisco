import { useSettings } from "@/stores/settings";

import { flushDirtyDocuments } from "./toggle-auto-save";

/** Debounce window for on-change auto-save: save this long after the last edit. */
export const ON_CHANGE_DEBOUNCE_MS = 1000;

let timer: ReturnType<typeof setTimeout> | null = null;

/** True only when auto-save is enabled. */
function isOnChangeActive(): boolean {
  return useSettings.getState().autoSave;
}

function clearTimer(): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}

/**
 * Arm (or re-arm) the debounced save. No-op unless auto-save is on. Each call pushes the flush ON_CHANGE_DEBOUNCE_MS into the future, so a
 * burst of keystrokes collapses into a single save once typing pauses.
 */
export function scheduleOnChangeSave(): void {
  if (!isOnChangeActive()) return;
  clearTimer();
  timer = setTimeout(() => {
    timer = null;
    flushDirtyDocuments();
  }, ON_CHANGE_DEBOUNCE_MS);
}

/**
 * Flush immediately, cancelling any pending debounce. Wired to editor blur so
 * leaving the editor saves at once instead of waiting out the debounce. No-op
 * unless auto-save is on.
 */
export function flushOnChangeNow(): void {
  if (!isOnChangeActive()) return;
  clearTimer();
  flushDirtyDocuments();
}

/** Cancel any pending debounced save (effect cleanup / auto-save turned off). */
export function cancelOnChangeSave(): void {
  clearTimer();
}
