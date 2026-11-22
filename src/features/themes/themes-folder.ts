import i18n from "@/i18n";
import { log } from "@/lib/log";
import { pathExists, readDir, readTextFile, writeTextFile } from "@/lib/tauri/fs";
import { localizeAppError } from "@/lib/tauri/localize-error";
import { ensureThemesDir } from "@/lib/tauri/themes";
import { notify } from "@/stores/notifications";
import { useSettings } from "@/stores/settings";

import { applyCustomThemeCss } from "./apply-theme";

let cachedDir: Promise<string> | null = null;

/** Memoized absolute path of the managed themes folder. */
export function getThemesDir(): Promise<string> {
  // A rejected resolution is cached for the session on purpose: an unwritable
  // config dir is a hard environmental failure that won't self-heal mid-session.
  cachedDir ??= ensureThemesDir();
  return cachedDir;
}

// `dir` is always a native Rust path (from `ensureThemesDir`), so mixed
// separators aren't expected — the heuristic only handles pure-`\` (Windows)
// vs pure-`/` (Unix).
/** Cross-platform join (the dir separator follows the OS path from Rust). */
function joinThemePath(dir: string, name: string): string {
  const sep = dir.includes("\\") && !dir.includes("/") ? "\\" : "/";
  return `${dir}${dir.endsWith(sep) ? "" : sep}${name}`;
}

function basename(path: string): string {
  return path.split(/[/\\]/).pop() ?? path;
}

/** Discovered `.css` theme basenames in the managed folder, sorted. */
export async function listThemes(): Promise<string[]> {
  const dir = await getThemesDir();
  const { entries } = await readDir(dir);
  return entries
    .filter((e) => !e.isDir && e.name.toLowerCase().endsWith(".css"))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));
}

/** Select a theme by filename (null clears). Reads the file and applies it. */
export async function selectTheme(name: string | null): Promise<void> {
  if (!name) {
    applyCustomThemeCss(null);
    useSettings.getState().setCustomThemeName(null);
    return;
  }
  const dir = await getThemesDir();
  try {
    const css = await readTextFile(joinThemePath(dir, name));
    applyCustomThemeCss(css);
    useSettings.getState().setCustomThemeName(name);
  } catch (error) {
    // Leave settings unchanged so the controlled <select> reverts to the prior pick.
    notify.error(i18n.t("notify.fileOpFailed", { ns: "editor", error: localizeAppError(error) }));
  }
}

/**
 * Re-read + re-apply the currently selected theme (hot-reload). If the file is
 * gone (deleted/renamed on disk), revert to the default theme and notify.
 */
export async function reapplyActiveTheme(): Promise<void> {
  const name = useSettings.getState().customThemeName;
  if (!name) return;
  const dir = await getThemesDir();
  try {
    const css = await readTextFile(joinThemePath(dir, name));
    applyCustomThemeCss(css);
  } catch {
    applyCustomThemeCss(null);
    useSettings.getState().setCustomThemeName(null);
    notify.error(i18n.t("notify.themeDeleted", { ns: "editor" }));
  }
}

/** Whether a folder change at `path` affects the active theme (basename match). */
export function affectsActiveTheme(path: string): boolean {
  const name = useSettings.getState().customThemeName;
  return name !== null && basename(path) === name;
}

/**
 * One-time migration of a legacy absolute custom-theme path into the managed
 * folder. If the file already lives there, select it in place; otherwise copy it
 * in (collision-safe " (1)" suffix) and select the copy.
 */
export async function migrateLegacyCustomTheme(legacyPath: string): Promise<void> {
  const dir = await getThemesDir();
  try {
    const name = basename(legacyPath);
    // Already inside the managed folder -> select in place, no copy.
    if (joinThemePath(dir, name) === legacyPath) {
      await selectTheme(name);
      return;
    }
    const css = await readTextFile(legacyPath);
    const finalName = await uniqueName(dir, name);
    await writeTextFile(joinThemePath(dir, finalName), css);
    await selectTheme(finalName);
  } catch {
    // Best-effort: a missing/unreadable legacy file just leaves no custom theme.
    log.warn(`Legacy custom-theme migration failed for ${legacyPath}`);
  }
}

/** Append " (n)" before .css until the name is free in the folder. */
async function uniqueName(dir: string, name: string): Promise<string> {
  if (!(await pathExists(joinThemePath(dir, name)))) return name;
  const dot = name.lastIndexOf(".");
  const stem = dot === -1 ? name : name.slice(0, dot);
  const ext = dot === -1 ? "" : name.slice(dot);
  for (let i = 1; i < 1000; i += 1) {
    const candidate = `${stem} (${i})${ext}`;
    if (!(await pathExists(joinThemePath(dir, candidate)))) return candidate;
  }
  return `${stem} (${Date.now()})${ext}`; // pathological fallback
}
