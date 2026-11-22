import { isTauri } from "@tauri-apps/api/core";
import { ask } from "@tauri-apps/plugin-dialog";

import { confirmCloseAllDirty } from "@/features/file-ops/close-window";
import i18n from "@/i18n";
import { localizeAppError } from "@/lib/tauri/localize-error";
import { flushSettings } from "@/lib/tauri/settings-store";
import { notify } from "@/stores/notifications";

/**
 * Check for an application update (tauri-plugin-updater). Only ever run on an
 * explicit user action (menu or palette), so every outcome is reported —
 * including "no update" and failures. If an update is available the user
 * confirms before it downloads and installs.
 *
 * On Windows the installer exits the app (updater docs), so once the download
 * is done (edits made while it runs count too) unsaved documents are resolved,
 * exactly as on quit (cancel = no install), and the debounced settings store
 * is written out before installing.
 *
 * `onChecked` runs once the check itself has an answer (an update, none, or an
 * error), before any confirmation or download, so a caller can stop saying
 * "checking" while the rest of the flow carries on.
 */
let inFlight = false;

export async function checkForUpdates(onChecked?: () => void): Promise<void> {
  // One check at a time, whoever starts it (menu, palette, About): a second
  // click during a download would otherwise start another check, prompt and
  // download in parallel.
  if (inFlight) return;
  inFlight = true;
  try {
    await runCheck(onChecked);
  } finally {
    inFlight = false;
  }
}

async function runCheck(onChecked?: () => void): Promise<void> {
  let reported = false;
  const settle = () => {
    if (reported) return;
    reported = true;
    onChecked?.();
  };

  if (!isTauri()) {
    settle();
    notify.error(i18n.t("notify.updateUnavailable", { ns: "editor" }));
    return;
  }

  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    settle();

    if (!update) {
      notify.success(i18n.t("notify.updateNone", { ns: "editor" }));
      return;
    }

    const proceed = await ask(i18n.t("update.confirm", { ns: "editor", version: update.version }), {
      title: i18n.t("update.title", { ns: "editor" }),
      kind: "info",
    });
    if (!proceed) return;

    notify.success(i18n.t("notify.updateDownloading", { ns: "editor", version: update.version }));
    await update.download();
    if (!(await confirmCloseAllDirty())) return;
    await flushSettings();
    await update.install();
    notify.success(i18n.t("notify.updateReady", { ns: "editor" }));
  } catch (error) {
    settle();
    notify.error(i18n.t("notify.updateFailed", { ns: "editor", error: localizeAppError(error) }));
  }
}
