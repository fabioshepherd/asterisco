import { isTauri } from "@tauri-apps/api/core";
import { load, type Store } from "@tauri-apps/plugin-store";

import type { Accent } from "@/features/themes/accents";
import type { Neutral } from "@/features/themes/neutrals";
import type { EditorFontFamily, Language } from "@/stores/settings";
import type { ThemePreference } from "@/stores/theme";
import type { ViewMode } from "@/stores/ui";

const STORE_FILE = "settings.json";

/**
 * Schema version of the persisted settings shape. Bump this whenever the
 * structure of {@link PersistedSettings} changes in a way that needs a data
 * migration, and add the corresponding step to {@link migrateSettings}.
 *
 * - v0: pre-versioned stores (no `schemaVersion` key written). Field-by-field
 *   shape identical to v1; the load path defaults missing versions to 0.
 * - v1: migration from 0 → 1 is a no-op (identity) that simply stamps the
 *   version on the next save.
 * - v2: `showHiddenFiles` (reveal dot-prefixed entries) became
 *   `showIgnoredFolders` (reveal generated/vendored folders). The old key is
 *   dropped rather than carried over: someone who turned it on wanted to see
 *   `.github`, and that is now the default — carrying `true` across would have
 *   handed them `node_modules` instead.
 * - v3: the default `lineWidth` went from 90 to 66. Every setting
 *   is persisted on any change, so a stored 90 is the old default, not a choice:
 *   it is mapped to 66 once. A 90 stored at v3 or later is kept.
 * - v4: current shape (see {@link SETTINGS_SCHEMA_VERSION}). The `mono` reading font was dropped (no mono outside
 *   code and machine data); a stored `mono` becomes `serif`.
 */
export const SETTINGS_SCHEMA_VERSION = 4;

export interface PersistedSettings {
  themePreference: ThemePreference;
  accent: Accent;
  neutral: Neutral;
  customThemeName: string | null;
  /** Legacy (pre-folder) absolute custom-theme path — read only, for one-time migration. */
  customThemePath?: string | null;
  language: Language;
  defaultViewMode: ViewMode;
  autoSave: boolean;
  editorFontSize: number;
  lineWidth: number;
  editorFontFamily: EditorFontFamily;
  editorLineHeight: number;
  autoPairing: boolean;
  showIgnoredFolders: boolean;
  revealActiveFile: boolean;
  hasSeenWelcome: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Pull only the recognized {@link PersistedSettings} fields out of an arbitrary
 * raw object, dropping unknown keys. Type coercion/clamping of these values is
 * the store's responsibility (`useSettings.hydrate`); this only narrows shape.
 */
function pickKnownSettings(raw: Record<string, unknown>): Partial<PersistedSettings> {
  return {
    ...(raw.themePreference === undefined
      ? {}
      : { themePreference: raw.themePreference as ThemePreference }),
    ...(raw.accent === undefined ? {} : { accent: raw.accent as Accent }),
    ...(raw.neutral === undefined ? {} : { neutral: raw.neutral as Neutral }),
    ...(raw.customThemeName === undefined
      ? {}
      : { customThemeName: raw.customThemeName as string | null }),
    ...(raw.customThemePath === undefined
      ? {}
      : { customThemePath: raw.customThemePath as string | null }),
    ...(raw.language === undefined ? {} : { language: raw.language as Language }),
    ...(raw.defaultViewMode === undefined
      ? {}
      : { defaultViewMode: raw.defaultViewMode as ViewMode }),
    ...(raw.autoSave === undefined ? {} : { autoSave: raw.autoSave as boolean }),
    ...(raw.editorFontSize === undefined ? {} : { editorFontSize: raw.editorFontSize as number }),
    ...(raw.lineWidth === undefined ? {} : { lineWidth: raw.lineWidth as number }),
    ...(raw.editorFontFamily === undefined
      ? {}
      : { editorFontFamily: raw.editorFontFamily as EditorFontFamily }),
    ...(raw.editorLineHeight === undefined
      ? {}
      : { editorLineHeight: raw.editorLineHeight as number }),
    ...(raw.autoPairing === undefined ? {} : { autoPairing: raw.autoPairing as boolean }),
    ...(raw.showIgnoredFolders === undefined
      ? {}
      : { showIgnoredFolders: raw.showIgnoredFolders as boolean }),
    ...(raw.revealActiveFile === undefined
      ? {}
      : { revealActiveFile: raw.revealActiveFile as boolean }),
    ...(raw.hasSeenWelcome === undefined ? {} : { hasSeenWelcome: raw.hasSeenWelcome as boolean }),
  };
}

/**
 * Migrate a raw persisted-settings object from `fromVersion` to the current
 * {@link SETTINGS_SCHEMA_VERSION}. This is the single documented hook for
 * future structural migrations: as the shape evolves, add a step per version
 * here (e.g. rename/split/relocate a field) before the final narrowing.
 *
 * One step per version, applied in order: v0 → v1 is identity (a pre-versioned
 * store loads as before and gains a stamped `schemaVersion` on the next save);
 * v1 → v2 drops `showHiddenFiles` (it is not a known key any more); v2 → v3
 * maps the old default `lineWidth` 90 to 66; v3 → v4 maps the `mono` reading
 * font to `serif`. The history of each version is in the list above.
 */
export function migrateSettings(raw: unknown, fromVersion: number): Partial<PersistedSettings> {
  if (!isRecord(raw)) return {};
  // Already current (or newer — forward-compat: don't down-migrate); just narrow.
  if (fromVersion >= SETTINGS_SCHEMA_VERSION) return pickKnownSettings(raw);
  const picked = pickKnownSettings(raw);
  // v2 → v3: a stored 90 is the old default measure, not a user choice.
  if (fromVersion < 3 && picked.lineWidth === 90) picked.lineWidth = 66;
  // v3 → v4: the mono reading font is gone.
  if (fromVersion < 4 && (picked.editorFontFamily as string | undefined) === "mono") {
    picked.editorFontFamily = "serif";
  }
  return picked;
}

/**
 * Debounce, in ms, of the store plugin's own auto-save: every `set`/`delete`
 * restarts one timer and `settings.json` is written once it runs out (the
 * plugin also saves on a graceful exit). A sidebar drag is a burst of `set`s,
 * so it ends in one file write instead of one per frame. Only
 * {@link flushSettings} saves explicitly.
 */
export const SETTINGS_SAVE_DEBOUNCE_MS = 500;

let storePromise: Promise<Store> | null = null;

function getStore(): Promise<Store> {
  storePromise ??= load(STORE_FILE, { autoSave: SETTINGS_SAVE_DEBOUNCE_MS, defaults: {} });
  return storePromise;
}

/**
 * Write `settings.json` now instead of waiting for the auto-save debounce.
 * Called before the updater installs: on Windows the installer ends the
 * process without a graceful exit, so a change made in the last
 * {@link SETTINGS_SAVE_DEBOUNCE_MS} would otherwise be lost. Best-effort; a
 * no-op outside the Tauri runtime.
 */
export async function flushSettings(): Promise<void> {
  if (!isTauri()) return;
  try {
    const store = await getStore();
    await store.save();
  } catch {
    // Best-effort.
  }
}

/** Read persisted settings. Returns an empty object outside the Tauri runtime. */
export async function loadPersistedSettings(): Promise<Partial<PersistedSettings>> {
  if (!isTauri()) return {};
  try {
    const store = await getStore();
    // Pre-versioned stores have no `schemaVersion` key → treat as v0.
    const fromVersion = (await store.get<number>("schemaVersion")) ?? 0;
    const raw: Record<string, unknown> = {
      themePreference: await store.get<ThemePreference>("themePreference"),
      accent: await store.get<Accent>("accent"),
      neutral: await store.get<Neutral>("neutral"),
      customThemeName: await store.get<string | null>("customThemeName"),
      customThemePath: await store.get<string | null>("customThemePath"),
      language: await store.get<Language>("language"),
      defaultViewMode: await store.get<ViewMode>("defaultViewMode"),
      autoSave: await store.get<boolean>("autoSave"),
      editorFontSize: await store.get<number>("editorFontSize"),
      lineWidth: await store.get<number>("lineWidth"),
      editorFontFamily: await store.get<EditorFontFamily>("editorFontFamily"),
      editorLineHeight: await store.get<number>("editorLineHeight"),
      autoPairing: await store.get<boolean>("autoPairing"),
      showIgnoredFolders: await store.get<boolean>("showIgnoredFolders"),
      revealActiveFile: await store.get<boolean>("revealActiveFile"),
      hasSeenWelcome: await store.get<boolean>("hasSeenWelcome"),
    };
    return migrateSettings(raw, fromVersion);
  } catch {
    return {};
  }
}

/** Persist settings to the local JSON store. No-op outside the Tauri runtime. */
export async function savePersistedSettings(values: PersistedSettings): Promise<void> {
  if (!isTauri()) return;
  try {
    const store = await getStore();
    await store.set("schemaVersion", SETTINGS_SCHEMA_VERSION);
    await store.set("themePreference", values.themePreference);
    await store.set("accent", values.accent);
    await store.set("neutral", values.neutral);
    await store.set("customThemeName", values.customThemeName);
    // The legacy absolute-path pointer is retired on the first save after load,
    // regardless of whether migration succeeded (best-effort, one-time).
    await store.delete("customThemePath");
    // DOCX export was removed; its reference-template path is cleared on the
    // first save after load (one-time). The load path never reads it.
    await store.delete("docxReferenceTemplatePath");
    await store.set("language", values.language);
    await store.set("defaultViewMode", values.defaultViewMode);
    await store.set("autoSave", values.autoSave);
    // Auto-save is one on/off switch (save after typing stops, and on blur); the
    // retired mode and interval are cleared on the first save after load.
    await store.delete("autoSaveInterval");
    await store.delete("autoSaveMode");
    // The inline-base64 image mode was removed (images always go to `assets/`);
    // its key is cleared on the first save after load (one-time).
    await store.delete("imagePathMode");
    await store.set("editorFontSize", values.editorFontSize);
    await store.set("lineWidth", values.lineWidth);
    await store.set("editorFontFamily", values.editorFontFamily);
    await store.set("editorLineHeight", values.editorLineHeight);
    // Smart punctuation was removed; its flag is cleared on the first save
    // after load (one-time). The load path never reads it.
    await store.delete("smartPunctuation");
    await store.set("autoPairing", values.autoPairing);
    await store.set("showIgnoredFolders", values.showIgnoredFolders);
    await store.set("revealActiveFile", values.revealActiveFile);
    // Retired in schema v2; cleared on the first save after load (one-time).
    await store.delete("showHiddenFiles");
    await store.set("hasSeenWelcome", values.hasSeenWelcome);
  } catch {
    // Persistence is best-effort; the in-memory store remains the source of truth.
  }
}

/** Read persisted recent file paths. */
export async function loadRecents(): Promise<string[]> {
  if (!isTauri()) return [];
  try {
    const store = await getStore();
    return (await store.get<string[]>("recents")) ?? [];
  } catch {
    return [];
  }
}

/** Persist recent file paths. */
export async function saveRecents(recents: string[]): Promise<void> {
  if (!isTauri()) return;
  try {
    const store = await getStore();
    await store.set("recents", recents);
  } catch {
    // Best-effort.
  }
}

/** Read persisted recent workspace folder paths. */
export async function loadRecentFolders(): Promise<string[]> {
  if (!isTauri()) return [];
  try {
    const store = await getStore();
    return (await store.get<string[]>("recentFolders")) ?? [];
  } catch {
    return [];
  }
}

/** Persist recent workspace folder paths. */
export async function saveRecentFolders(recentFolders: string[]): Promise<void> {
  if (!isTauri()) return;
  try {
    const store = await getStore();
    await store.set("recentFolders", recentFolders);
  } catch {
    // Best-effort.
  }
}

/**
 * Read the workspace folder open when the app last closed.
 *
 * Sessions here are short and frequent ("open, read, fix a line, close"), so
 * re-picking the folder every launch is a tax on the common case.
 */
export async function loadWorkspaceRoot(): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    const store = await getStore();
    return (await store.get<string>("workspaceRoot")) ?? null;
  } catch {
    return null;
  }
}

/** Persist the open workspace folder (null once it is closed). */
export async function saveWorkspaceRoot(rootPath: string | null): Promise<void> {
  if (!isTauri()) return;
  try {
    const store = await getStore();
    if (rootPath === null) {
      await store.delete("workspaceRoot");
    } else {
      await store.set("workspaceRoot", rootPath);
    }
  } catch {
    // Best-effort.
  }
}

/** Read persisted custom keybindings (action id → combo). */
export async function loadKeybindings(): Promise<Record<string, string>> {
  if (!isTauri()) return {};
  try {
    const store = await getStore();
    return (await store.get<Record<string, string>>("keybindings")) ?? {};
  } catch {
    return {};
  }
}

/** Persist custom keybindings. */
export async function saveKeybindings(bindings: Record<string, string>): Promise<void> {
  if (!isTauri()) return;
  try {
    const store = await getStore();
    await store.set("keybindings", bindings);
  } catch {
    // Best-effort.
  }
}

export interface UiPrefs {
  /** Whether the outline body is expanded. */
  outlineVisible: boolean;
  /** Sidebar width in pixels; sanitized against SIDEBAR_WIDTH on load. */
  sidebarWidth: number;
}

/** Read persisted UI preferences. Empty outside the Tauri runtime. */
export async function loadUiPrefs(): Promise<Partial<UiPrefs>> {
  if (!isTauri()) return {};
  try {
    const store = await getStore();
    const outlineVisible = await store.get<boolean>("outlineVisible");
    const sidebarWidth = await store.get<number>("sidebarWidth");
    return {
      ...(outlineVisible === undefined ? {} : { outlineVisible }),
      ...(sidebarWidth === undefined ? {} : { sidebarWidth }),
    };
  } catch {
    return {};
  }
}

/**
 * Persist the given UI preferences; keys left out are not touched. No-op
 * outside the Tauri runtime.
 */
export async function saveUiPrefs(prefs: Partial<UiPrefs>): Promise<void> {
  if (!isTauri()) return;
  try {
    const store = await getStore();
    if (prefs.outlineVisible !== undefined) {
      await store.set("outlineVisible", prefs.outlineVisible);
    }
    if (prefs.sidebarWidth !== undefined) await store.set("sidebarWidth", prefs.sidebarWidth);
  } catch {
    // Best-effort.
  }
}
