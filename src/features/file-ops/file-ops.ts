import { open, save } from "@tauri-apps/plugin-dialog";

import { flushActiveEditor } from "@/editor/flush-editor";
import { MARKDOWN_EXTENSIONS } from "@/features/file-tree/tree-utils";
import i18n from "@/i18n";
import { pathExists, readTextFile, writeTextFile } from "@/lib/tauri/fs";
import { localizeAppError } from "@/lib/tauri/localize-error";
import { decodeText, encodeText } from "@/lib/text-format";
import { documentDisplayName, type EditorDocument, useDocuments } from "@/stores/document";
import { type NotificationAction, notify } from "@/stores/notifications";
import { useRecents } from "@/stores/recents";

import { requestUnsavedDecision } from "./use-unsaved-prompt";

/** File operations: open, save, save-as, new, close — each opens/uses a tab. */

/** A "Retry" affordance for a failed file op, so the error toast isn't a dead end. */
function retry(onAction: () => void): NotificationAction {
  return { label: i18n.t("notify.retry", { ns: "editor" }), onAction };
}

function markdownFilter() {
  return {
    name: i18n.t("dialog.markdownFilter", { ns: "editor" }),
    extensions: MARKDOWN_EXTENSIONS,
  };
}

function getDocument(id: string): EditorDocument | undefined {
  return useDocuments.getState().documents.find((doc) => doc.id === id);
}

function documentName(doc: EditorDocument | undefined): string {
  return documentDisplayName(doc, i18n.t("untitled", { ns: "editor" }));
}

/** Open a fresh untitled document in a new tab. */
export function newFile(): void {
  useDocuments.getState().createDocument();
}

/** Pick a markdown file and open it in a new tab. */
export async function openFile(): Promise<void> {
  const selected = await open({ multiple: false, filters: [markdownFilter()] });
  if (typeof selected !== "string") return; // cancelled
  await openPath(selected);
}

/**
 * Surface a file-open failure: if the file is simply gone, prune the stale
 * recent and say so; otherwise surface the underlying error and keep the entry
 * (it may be transient). The retry re-runs the open.
 */
async function notifyOpenFailure(path: string, error: unknown): Promise<void> {
  let missing = false;
  try {
    missing = !(await pathExists(path));
  } catch {
    // ignore probe failures; fall back to the generic error below
  }
  if (missing) {
    useRecents.getState().removeRecent(path);
    notify.error(i18n.t("notify.fileMissing", { ns: "editor" }));
  } else {
    notify.error(
      i18n.t("notify.openFailed", { ns: "editor", error: localizeAppError(error) }),
      retry(() => void openPath(path)),
    );
  }
}

/** Open a known path in a tab, focusing it if already open. */
export async function openPath(path: string): Promise<void> {
  const existing = useDocuments.getState().documents.find((doc) => doc.path === path);
  if (existing) {
    useDocuments.getState().setActiveDocument(existing.id);
    useRecents.getState().addRecent(path);
    return;
  }

  try {
    // The editor gets LF text; the file's line endings, BOM and final newline
    // are remembered and re-applied on save.
    const { text, format } = decodeText(await readTextFile(path));
    useDocuments.getState().createDocument({ path, markdown: text, format });
    useRecents.getState().addRecent(path);
  } catch (error) {
    await notifyOpenFailure(path, error);
  }
}

/**
 * The latest save of each document, by id. Writes run off the main thread, so
 * two saves of one document in flight (an auto-save, then Ctrl+S) could finish
 * in either order and leave the older snapshot on disk after the newer one was
 * marked saved. Each save waits for the previous one of the same document.
 */
const saveChains = new Map<string, Promise<boolean>>();

/** Save a document to disk, falling back to save-as when it has no path. May throw. */
export function saveDocument(id: string): Promise<boolean> {
  flushActiveEditor(id); // write what is on screen, not the debounced store copy
  const previous = saveChains.get(id);
  // With nothing in flight the write starts now, snapshotting the content at
  // the moment of the call. A failed earlier save was already reported to its
  // own caller; a save queued behind it still runs.
  const run = previous
    ? previous.catch(() => false).then(() => writeDocument(id))
    : writeDocument(id);
  saveChains.set(id, run);
  const release = () => {
    if (saveChains.get(id) === run) saveChains.delete(id);
  };
  run.then(release, release);
  return run;
}

async function writeDocument(id: string): Promise<boolean> {
  const doc = getDocument(id);
  if (!doc) return false;
  if (!doc.path) return saveDocumentAs(id);
  // Nothing to save: rewriting the file would only normalize what the user
  // did not touch (a whole-file `git diff` for a file merely opened). Unless
  // the file is gone (a checkout deleted it, or an undo cleared the dirty flag
  // set when it was deleted): then this tab holds the only copy.
  if (!doc.isDirty && (await pathExists(doc.path))) return true;

  // Snapshot the exact content written so an edit landing during the async
  // write isn't mistaken for the saved baseline (silent data-loss guard).
  const written = doc.markdown;
  await writeTextFile(doc.path, encodeText(written, doc.format));
  useDocuments.getState().markSaved(id, written);
  return true;
}

/** Prompt for a destination and write the document there. May throw. */
export async function saveDocumentAs(id: string): Promise<boolean> {
  flushActiveEditor(id);
  const doc = getDocument(id);
  if (!doc) return false;

  const selected = await save({
    filters: [markdownFilter()],
    defaultPath: doc.path ?? undefined,
  });
  if (typeof selected !== "string") return false; // cancelled

  const written = doc.markdown;
  await writeTextFile(selected, encodeText(written, doc.format));
  useDocuments.getState().markSaved(id, written, selected);
  useRecents.getState().addRecent(selected);
  return true;
}

export async function saveWithFeedback(id: string): Promise<boolean> {
  try {
    const saved = await saveDocument(id);
    if (saved) notify.success(i18n.t("notify.saved", { ns: "editor" }));
    return saved;
  } catch (error) {
    notify.error(
      i18n.t("notify.saveFailed", { ns: "editor", error: localizeAppError(error) }),
      retry(() => void saveWithFeedback(id)),
    );
    return false;
  }
}

export function saveActiveDocument(): Promise<boolean> {
  const id = useDocuments.getState().activeId;
  return id ? saveWithFeedback(id) : Promise.resolve(false);
}

export async function saveActiveDocumentAs(): Promise<boolean> {
  const id = useDocuments.getState().activeId;
  if (!id) return false;
  try {
    const saved = await saveDocumentAs(id);
    if (saved) {
      notify.success(
        i18n.t("notify.savedAs", { ns: "editor", name: documentName(getDocument(id)) }),
      );
    }
    return saved;
  } catch (error) {
    notify.error(
      i18n.t("notify.saveFailed", { ns: "editor", error: localizeAppError(error) }),
      retry(() => void saveActiveDocumentAs()),
    );
    return false;
  }
}

/**
 * Close a tab, prompting to save when it has unsaved changes. Returns whether
 * the tab actually closed, so a bulk close can stop where the user said stop.
 */
export async function closeTab(id: string): Promise<boolean> {
  const doc = getDocument(id);
  if (!doc) return true; // already gone

  flushActiveEditor(id); // an edit inside the editor's debounce must still count as unsaved
  if (getDocument(id)?.isDirty) {
    const decision = await requestUnsavedDecision(documentName(doc));
    if (decision === "cancel") return false;
    if (decision === "save" && !(await saveWithFeedback(id))) return false; // save failed/cancelled
  }

  useDocuments.getState().closeDocument(id);
  return true;
}

/**
 * Close several tabs, one prompt at a time, stopping at the first one the user
 * declines. Cancelling a save prompt means "not this batch", not "skip this one
 * and shut the rest anyway".
 */
export async function closeTabs(ids: readonly string[]): Promise<void> {
  for (const id of ids) {
    if (!(await closeTab(id))) return;
  }
}
