import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { openPath } from "@tauri-apps/plugin-opener";

interface ThemesChangedPayload {
  path: string;
}

/** Resolve (creating + seeding if needed) the managed themes folder. */
export function ensureThemesDir(): Promise<string> {
  return invoke<string>("ensure_themes_dir");
}

/** Start watching the themes folder for changes (replaces any previous watch). */
export function startThemesWatch(path: string): Promise<void> {
  return invoke<void>("start_themes_watch", { path });
}

/** Stop watching the themes folder. */
export function stopThemesWatch(): Promise<void> {
  return invoke<void>("stop_themes_watch");
}

/** Subscribe to themes-folder change events (per changed path). */
export function onThemesDirChanged(handler: (path: string) => void): Promise<UnlistenFn> {
  return listen<ThemesChangedPayload>("themes-dir-changed", (e) => handler(e.payload.path));
}

/** Open the themes folder in the OS file manager. */
export function openThemesDir(dir: string): Promise<void> {
  return openPath(dir);
}
