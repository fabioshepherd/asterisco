import { confirm } from "@tauri-apps/plugin-dialog";
import { create } from "zustand";

import { openPath } from "@/features/file-ops/file-ops";
import i18n from "@/i18n";
import { createFile, moveToTrash, renamePath } from "@/lib/tauri/fs";
import { localizeAppError } from "@/lib/tauri/localize-error";
import { useDocuments } from "@/stores/document";
import { notify } from "@/stores/notifications";
import { useWorkspace } from "@/stores/workspace";

import { isMarkdownFile } from "./tree-utils";

function separator(path: string): string {
  return path.includes("\\") ? "\\" : "/";
}
function dirname(path: string): string {
  return path.replace(/[/\\][^/\\]*$/, "");
}
export function basename(path: string): string {
  return path.split(/[/\\]/).filter(Boolean).pop() ?? path;
}
function join(dir: string, name: string): string {
  return `${dir}${separator(dir)}${name}`;
}
/** Ensure a new file name has a markdown extension. */
function withMarkdownExt(name: string): string {
  return isMarkdownFile(name) ? name : `${name}.md`;
}

type Prompt = { kind: "new"; parentDir: string } | { kind: "rename"; targetPath: string };

interface FileActionsState {
  prompt: Prompt | null;
  name: string;
  /** Inline validation/error shown in the dialog; cleared on edit/cancel. */
  error: string | null;
  busy: boolean;
  startNewFile: (parentDir: string) => void;
  startRename: (targetPath: string) => void;
  setName: (name: string) => void;
  cancel: () => void;
  submit: () => Promise<void>;
}

export const useFileActions = create<FileActionsState>()((set, get) => ({
  prompt: null,
  name: "",
  error: null,
  busy: false,
  startNewFile: (parentDir) =>
    set({ prompt: { kind: "new", parentDir }, name: "", error: null, busy: false }),
  startRename: (targetPath) =>
    set({
      prompt: { kind: "rename", targetPath },
      name: basename(targetPath),
      error: null,
      busy: false,
    }),
  setName: (name) => set({ name, error: null }),
  cancel: () => set({ prompt: null, name: "", error: null, busy: false }),
  submit: async () => {
    const { prompt, name, busy } = get();
    const trimmed = name.trim();
    if (!prompt || trimmed.length === 0 || busy) return;
    set({ error: null, busy: true });

    try {
      if (prompt.kind === "new") {
        const path = join(prompt.parentDir, withMarkdownExt(trimmed));
        await createFile(path);
        useWorkspace.getState().refreshTree();
        await openPath(path);
      } else {
        const from = prompt.targetPath;
        const to = join(dirname(from), trimmed);
        if (to === from) {
          set({ prompt: null, name: "", busy: false });
          return;
        }
        await renamePath(from, to);
        useDocuments.getState().updatePath(from, to);
        // Renaming the workspace folder itself used to succeed on disk and
        // leave the app pointed at a path that no longer existed.
        if (useWorkspace.getState().rootPath === from) useWorkspace.getState().setRoot(to);
        useWorkspace.getState().refreshTree();
        notify.success(i18n.t("notify.renamed", { ns: "editor", name: basename(to) }), {
          label: i18n.t("notify.undo", { ns: "editor" }),
          onAction: () => void restoreRename(to, from),
        });
      }
      // Success: close the dialog.
      set({ prompt: null, name: "", error: null, busy: false });
    } catch (error) {
      // Keep the dialog open and surface the specific reason inline so the
      // user can correct the name without retyping it.
      set({ error: localizeAppError(error), busy: false });
    }
  },
}));

/** Undo a rename by renaming `current` back to `original` and re-syncing state. */
async function restoreRename(current: string, original: string): Promise<void> {
  try {
    await renamePath(current, original);
    useDocuments.getState().updatePath(current, original);
    if (useWorkspace.getState().rootPath === current) useWorkspace.getState().setRoot(original);
    useWorkspace.getState().refreshTree();
  } catch (error) {
    notify.error(i18n.t("notify.fileOpFailed", { ns: "editor", error: localizeAppError(error) }));
  }
}

/**
 * Move an entry to the system trash, after a confirmation that says what it is
 * about to move.
 *
 * The workspace root is refused outright. It renders as an ordinary row, it is
 * where `Mod+Shift+E` puts the keyboard, and `Delete` there was one generic
 * confirm away from putting an entire repository — untracked `.claude/` scratch
 * included — in the trash. Closing a folder is what someone means there.
 */
export async function deleteEntry(path: string, isDir = false): Promise<void> {
  if (path === useWorkspace.getState().rootPath) {
    notify.error(i18n.t("fileActions.cannotDeleteRoot", { ns: "editor" }));
    return;
  }
  const confirmed = await confirm(
    i18n.t(isDir ? "fileActions.confirmDeleteFolder" : "fileActions.confirmDelete", {
      ns: "editor",
      name: basename(path),
    }),
    { title: i18n.t("fileActions.delete", { ns: "editor" }), kind: "warning" },
  );
  if (!confirmed) return;
  try {
    await moveToTrash(path);
    useWorkspace.getState().refreshTree();
    notify.success(i18n.t("notify.movedToTrash", { ns: "editor", name: basename(path) }));
  } catch (error) {
    notify.error(i18n.t("notify.fileOpFailed", { ns: "editor", error: localizeAppError(error) }));
  }
}
