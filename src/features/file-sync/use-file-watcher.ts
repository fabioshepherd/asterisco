import { replaceAll as crepeReplaceAll } from "@milkdown/kit/utils";
import { ask } from "@tauri-apps/plugin-dialog";
import { isTauri } from "@tauri-apps/api/core";
import { useEffect } from "react";

import { getEditorsForDoc } from "@/editor/active-editor";
import i18n from "@/i18n";
import { log } from "@/lib/log";
import { readTextFile } from "@/lib/tauri/fs";
import { decodeText, encodeText, type TextFormat } from "@/lib/text-format";
import { onFileChanged, onFileDeleted, startWatch, stopWatch } from "@/lib/tauri/watcher";
import { documentDisplayName, selectActiveDocument, useDocuments } from "@/stores/document";
import { notify } from "@/stores/notifications";

function reloadDocument(id: string, markdown: string, format: TextFormat): void {
  // The store stays the single source of truth regardless of what's mounted.
  useDocuments.getState().applyExternalContent(id, markdown, format);
  // Push the external content into every live editor showing this document,
  // targeted by document id rather than the focused editor (the changed doc may
  // not be the active one). When no editor is mounted for the doc, the store
  // update above suffices.
  for (const editor of getEditorsForDoc(id)) {
    editor.editor.action(crepeReplaceAll(markdown, true));
  }
}

export async function handleExternalChange(path: string): Promise<void> {
  const doc = useDocuments.getState().documents.find((d) => d.path === path);
  if (!doc) return;

  let raw: string;
  try {
    raw = await readTextFile(path);
  } catch {
    return;
  }
  // Nothing actually changed: the file holds the baseline, or exactly what the
  // last save wrote (the baseline spelled in the file's own format).
  const { text: markdown, format } = decodeText(raw);
  if (raw === encodeText(doc.savedMarkdown, doc.format)) return;
  if (markdown === doc.savedMarkdown) {
    // Same text, new spelling (a tool turned CRLF into LF, stripped the BOM):
    // remember it, or the next save would undo the tool's change.
    useDocuments.getState().adoptDiskBaseline(doc.id, markdown, format);
    return;
  }

  if (!doc.isDirty) {
    reloadDocument(doc.id, markdown, format); // no local edits to lose
    return;
  }

  const name = documentDisplayName(doc, i18n.t("untitled", { ns: "editor" }));
  const shouldReload = await ask(i18n.t("watcher.changedMessage", { ns: "editor", name }), {
    title: i18n.t("watcher.changedTitle", { ns: "editor" }),
    kind: "warning",
    okLabel: i18n.t("watcher.reload", { ns: "editor" }),
    cancelLabel: i18n.t("watcher.keep", { ns: "editor" }),
  });
  if (shouldReload) reloadDocument(doc.id, markdown, format);
  // Kept: measure the local version against what is now on disk, so it stays
  // dirty (and Save writes it) even if the user later reverts to the old text.
  else useDocuments.getState().adoptDiskBaseline(doc.id, markdown, format);
}

/**
 * The backing file of an open document was deleted (or renamed away) outside
 * the app. Keep the tab and its content, force the document dirty so the user
 * can re-save it, and surface a localized toast. Never auto-closes.
 */
export function handleExternalDelete(path: string): void {
  const doc = useDocuments.getState().documents.find((d) => d.path === path);
  if (!doc) return;

  useDocuments.getState().markExternallyDeleted(doc.id);
  const name = documentDisplayName(doc, i18n.t("untitled", { ns: "editor" }));
  log.warn(`Watched file deleted externally: ${path}`);
  notify.error(i18n.t("notify.deletedExternal", { ns: "editor", name }));
}

/** Watch the active document's file and prompt/reload on external changes. */
export function useFileWatcher(): void {
  const activePath = useDocuments((state) => selectActiveDocument(state)?.path ?? null);

  useEffect(() => {
    if (!isTauri() || !activePath) return;
    void startWatch(activePath);
    return () => {
      void stopWatch();
    };
  }, [activePath]);

  useEffect(() => {
    if (!isTauri()) return;
    const unlistenChanged = onFileChanged((path) => void handleExternalChange(path));
    const unlistenDeleted = onFileDeleted((path) => handleExternalDelete(path));
    return () => {
      void unlistenChanged.then((fn) => fn());
      void unlistenDeleted.then((fn) => fn());
    };
  }, []);
}
