import { isTauri } from "@tauri-apps/api/core";
import { useEffect } from "react";

import { getThemesDir, affectsActiveTheme, reapplyActiveTheme } from "./themes-folder";
import { log } from "@/lib/log";
import { onThemesDirChanged, startThemesWatch, stopThemesWatch } from "@/lib/tauri/themes";

/**
 * Watch the managed themes folder app-wide and hot-reload the active theme when
 * its file changes (or revert if it was removed). Mounted once at the app root,
 * so reloads happen even when Settings is closed. The settings panel subscribes
 * to the same `themes-dir-changed` event separately to refresh its list.
 */
export function useThemesHotReload(): void {
  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void (async () => {
      try {
        const dir = await getThemesDir();
        await startThemesWatch(dir);
        const fn = await onThemesDirChanged((path) => {
          if (affectsActiveTheme(path)) void reapplyActiveTheme();
        });
        if (cancelled) fn();
        else unlisten = fn;
      } catch (error) {
        log.warn(`Themes hot-reload setup failed: ${String(error)}`);
      }
    })();
    return () => {
      cancelled = true;
      unlisten?.();
      void stopThemesWatch();
    };
  }, []);
}
