import { open } from "@tauri-apps/plugin-dialog";

import i18n from "@/i18n";
import { pathExists } from "@/lib/tauri/fs";
import { localizeAppError } from "@/lib/tauri/localize-error";
import { notify } from "@/stores/notifications";
import { useRecents } from "@/stores/recents";
import { useWorkspace } from "@/stores/workspace";

/** Pick a folder and open it as the workspace root. */
export async function openFolder(): Promise<void> {
  const selected = await open({ directory: true, multiple: false });
  if (typeof selected !== "string") return; // cancelled
  useWorkspace.getState().setRoot(selected);
  useRecents.getState().addRecentFolder(selected);
}

/**
 * Reopen a known folder as the workspace root (no dialog). If the folder no
 * longer exists it is dropped from the recents list and the user is notified.
 */
export async function openRecentFolder(path: string): Promise<void> {
  try {
    if (!(await pathExists(path))) {
      useRecents.getState().removeRecentFolder(path);
      notify.error(i18n.t("notify.folderMissing", { ns: "editor" }));
      return;
    }
  } catch (error) {
    notify.error(i18n.t("notify.fileOpFailed", { ns: "editor", error: localizeAppError(error) }));
    return;
  }
  useWorkspace.getState().setRoot(path);
  useRecents.getState().addRecentFolder(path);
}
