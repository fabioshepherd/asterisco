import { flushActiveEditor } from "@/editor/flush-editor";
import { saveDocument } from "@/features/file-ops/file-ops";
import i18n from "@/i18n";
import { log } from "@/lib/log";
import { useDocuments } from "@/stores/document";
import { notify } from "@/stores/notifications";
import { useSettings } from "@/stores/settings";

/** Don't toast more than once per this window — auto-save retries on every edit pause. */
const AUTO_SAVE_ERROR_THROTTLE_MS = 30_000;
let lastAutoSaveErrorAt = 0;

/**
 * Documents with a save currently in flight. Guards against a debounced or blur
 * flush re-firing before the prior write settles, which would issue
 * two concurrent `writeTextFile` calls for the same path on a slow/network disk.
 */
const savingDocs = new Set<string>();

/**
 * Report a failed auto-save. Always logs; surfaces a localized error toast at
 * most once per throttle window so a persistent failure can't spam the user.
 */
function reportAutoSaveFailure(reason: unknown): void {
  log.warn("Auto-save failed", reason);

  const now = Date.now();
  if (now - lastAutoSaveErrorAt <= AUTO_SAVE_ERROR_THROTTLE_MS) return;
  lastAutoSaveErrorAt = now;
  notify.error(i18n.t("notify.autoSaveFailed", { ns: "editor" }));
}

/**
 * Save every dirty document that already has a path. Untitled documents are
 * skipped (saving them needs a dialog). Success stays silent (auto-save runs
 * after every edit pause); failures are logged and surface a rate-limited error
 * toast. Used both by the debounced/blur auto-save and by the instant flush
 * when auto-save is enabled.
 */
export function flushDirtyDocuments(): void {
  // Pull the active editor's not-yet-reported edits in first, so a doc typed in
  // within the editor's debounce window counts as dirty and saves its latest text.
  const { activeId } = useDocuments.getState();
  if (activeId) flushActiveEditor(activeId);
  for (const doc of useDocuments.getState().documents) {
    if (doc.isDirty && doc.path && !savingDocs.has(doc.id)) {
      savingDocs.add(doc.id);
      void saveDocument(doc.id)
        .then(
          (saved) => {
            if (!saved) reportAutoSaveFailure(new Error("saveDocument returned false"));
          },
          (reason: unknown) => reportAutoSaveFailure(reason),
        )
        .finally(() => savingDocs.delete(doc.id));
      // A doc still dirty after this write settles (e.g. edited mid-write) is
      // picked up on the next flush — never written twice concurrently.
    }
  }
}

/**
 * Flip auto-save. Turning it on flushes dirty docs immediately so the user gets
 * instant confirmation instead of waiting for the next edit.
 */
export function toggleAutoSave(): void {
  const next = !useSettings.getState().autoSave;
  useSettings.getState().setAutoSave(next);
  if (next) flushDirtyDocuments();
}
