import { useEffect } from "react";

import i18n from "@/i18n";
import { openPath } from "@/features/file-ops/file-ops";
import { useKeybindings } from "@/features/settings/keybindings";
import { withoutReservedCombos } from "@/features/settings/reserved-combos";
import { migrateLegacyCustomTheme, selectTheme } from "@/features/themes/themes-folder";
import { welcomeDocument } from "@/features/welcome/welcome-doc";
import { useDocuments } from "@/stores/document";
import { useRecents } from "@/stores/recents";
import { useSettings, type SettingsState } from "@/stores/settings";
import { useUi } from "@/stores/ui";
import { useWorkspace } from "@/stores/workspace";
import { pathExists } from "@/lib/tauri/fs";
import { findProjectRoot } from "@/lib/tauri/workspace";
import { onFilesPending, takePendingFiles } from "@/lib/tauri/open-with";
import { getOsLanguage } from "@/lib/tauri/system";
import {
  loadKeybindings,
  loadPersistedSettings,
  loadRecentFolders,
  loadRecents,
  loadUiPrefs,
  loadWorkspaceRoot,
  saveWorkspaceRoot,
  savePersistedSettings,
  saveKeybindings,
  saveRecentFolders,
  saveRecents,
  saveUiPrefs,
  type PersistedSettings,
  type UiPrefs,
} from "@/lib/tauri/settings-store";

/**
 * Reflect the active locale on the root element so assistive tech announces UI
 * text with the correct pronunciation (WCAG 3.1.1 Language of Page).
 */
export function syncDocumentLang(lng: string): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lng;
}

/**
 * Whether the first run should seed the bundled welcome document.
 *
 * A launch that came from a file (double click, "Open with", argv) never does:
 * the user asked for that document, and greeting them with a different one is
 * the app talking over them at the exact moment PRODUCT.md promises "open and
 * see". The welcome doc is for a launch with no file behind it.
 */
export function shouldSeedWelcome(input: {
  openedRequestedFile: boolean;
  openDocuments: number;
  hasSeenWelcome: boolean;
}): boolean {
  return !input.openedRequestedFile && input.openDocuments === 0 && !input.hasSeenWelcome;
}

/**
 * Open everything the OS has handed us, in the order it arrived. Returns the
 * paths, so a launch that came from a file can skip the welcome document and
 * adopt that file's project as the workspace. Paths already open are focused
 * rather than duplicated (`openPath`).
 */
async function openPendingFiles(): Promise<string[]> {
  const paths = await takePendingFiles();
  for (const path of paths) await openPath(path);
  return paths;
}

/**
 * Put a workspace behind the session before the user has to ask for one.
 *
 * The folder open at the last close is restored (sessions here are short and
 * frequent, so re-picking it every launch is a tax on the common case). Failing
 * that, a launch that came from a file adopts that file's project — otherwise
 * the app's canonical entry point, a double click in Finder, opens a document
 * against an empty sidebar.
 */
async function restoreWorkspace(openedPaths: string[]): Promise<void> {
  // Adopting a folder is opening it: it belongs in "recent folders" too, or the
  // one the user works in daily could be missing from the palette.
  const adopt = (path: string): void => {
    useWorkspace.getState().setRoot(path);
    useRecents.getState().addRecentFolder(path);
  };

  const persisted = await loadWorkspaceRoot();
  if (persisted) {
    if (await pathExists(persisted).catch(() => false)) {
      adopt(persisted);
      return;
    }
    // The folder moved or was deleted; don't resurrect a dead path.
    await saveWorkspaceRoot(null);
  }
  const [firstOpened] = openedPaths;
  if (!firstOpened) return;
  const projectRoot = await findProjectRoot(firstOpened).catch(() => null);
  if (projectRoot) adopt(projectRoot);
}

/** The settings fields written to `settings.json`. */
function persistedSettings(state: SettingsState): PersistedSettings {
  return {
    themePreference: state.themePreference,
    accent: state.accent,
    neutral: state.neutral,
    customThemeName: state.customThemeName,
    language: state.language,
    defaultViewMode: state.defaultViewMode,
    autoSave: state.autoSave,
    editorFontSize: state.editorFontSize,
    lineWidth: state.lineWidth,
    editorFontFamily: state.editorFontFamily,
    editorLineHeight: state.editorLineHeight,
    autoPairing: state.autoPairing,
    showIgnoredFolders: state.showIgnoredFolders,
    revealActiveFile: state.revealActiveFile,
    hasSeenWelcome: state.hasSeenWelcome,
  };
}

function sameSettings(a: PersistedSettings, b: PersistedSettings): boolean {
  return (Object.keys(a) as (keyof PersistedSettings)[]).every((key) => Object.is(a[key], b[key]));
}

/**
 * Persist later changes to settings, recents, keybindings and UI prefs. Call
 * it once the stored values are applied. Each listener writes only when a
 * persisted value changed: zustand notifies on every `set`, so view mode,
 * theme resolution or a same-width drag frame would otherwise rewrite the
 * store. The disk write itself is debounced by the store plugin.
 */
export function subscribePersistence(): () => void {
  const unsubscribeSettings = useSettings.subscribe((state, prev) => {
    const next = persistedSettings(state);
    if (!sameSettings(next, persistedSettings(prev))) void savePersistedSettings(next);
    if (i18n.language !== state.language) {
      void i18n.changeLanguage(state.language);
    }
  });

  const unsubscribeRecents = useRecents.subscribe((state, prev) => {
    if (state.recents !== prev.recents) void saveRecents(state.recents);
    if (state.recentFolders !== prev.recentFolders) void saveRecentFolders(state.recentFolders);
  });

  const unsubscribeKeybindings = useKeybindings.subscribe((state, prev) => {
    if (state.bindings !== prev.bindings) void saveKeybindings(state.bindings);
  });

  const unsubscribeUi = useUi.subscribe((state, prev) => {
    const changed: Partial<UiPrefs> = {
      ...(state.outlineVisible === prev.outlineVisible
        ? {}
        : { outlineVisible: state.outlineVisible }),
      ...(state.sidebarWidth === prev.sidebarWidth ? {} : { sidebarWidth: state.sidebarWidth }),
    };
    if (Object.keys(changed).length > 0) void saveUiPrefs(changed);
  });

  return () => {
    unsubscribeSettings();
    unsubscribeRecents();
    unsubscribeKeybindings();
    unsubscribeUi();
  };
}

/**
 * Hydrate settings from the persisted store (falling back to the OS locale for
 * language), then persist later changes back (see {@link subscribePersistence}).
 * Also keeps i18n in sync.
 */
export function useStartup(): void {
  useEffect(() => {
    let cancelled = false;
    let unsubscribePersistence = (): void => {};

    const handleLanguageChanged = (lng: string): void => syncDocumentLang(lng);
    i18n.on("languageChanged", handleLanguageChanged);

    void (async () => {
      const [persisted, recents, recentFolders, keybindings, uiPrefs] = await Promise.all([
        loadPersistedSettings(),
        loadRecents(),
        loadRecentFolders(),
        loadKeybindings(),
        loadUiPrefs(),
      ]);
      const language = persisted.language ?? (await getOsLanguage());
      if (cancelled) return;

      // `hydrate` accepts the live settings shape, which has `customThemeName`
      // but not the legacy `customThemePath`; strip the legacy key before passing.
      // Behaviorally this also keeps a stale absolute legacy path out of live
      // settings state — it's migrated below, never re-entered as a setting.
      const { customThemePath: legacyThemePath, ...persistedState } = persisted;
      useSettings.getState().hydrate({ ...persistedState, language });
      useKeybindings.getState().hydrate(withoutReservedCombos(keybindings));
      useRecents.getState().setRecents(recents);
      useRecents.getState().setRecentFolders(recentFolders);
      if (uiPrefs.outlineVisible !== undefined) {
        useUi.getState().setOutlineVisible(uiPrefs.outlineVisible);
      }
      if (uiPrefs.sidebarWidth !== undefined) {
        // Goes through the setter, so a corrupt or hand-edited stored width is
        // clamped back into range instead of being applied verbatim.
        useUi.getState().setSidebarWidth(uiPrefs.sidebarWidth);
      }
      // The canonical entry point is a double click on a `.md`, and reading is
      // the larger half of the job (PRODUCT.md, principle 2) — so which view the
      // app lands in is the user's decision, not a hardcoded "edit".
      useUi.getState().setViewMode(useSettings.getState().defaultViewMode);
      // Only now: a change made before the stored values are applied
      // must not write defaults over them.
      unsubscribePersistence = subscribePersistence();
      await i18n.changeLanguage(language);
      // Ensure the very first paint carries the right document language even if
      // the locale was already active (no languageChanged event would fire).
      syncDocumentLang(i18n.language);
      // Re-apply the selected folder theme, or migrate a legacy absolute path.
      if (persisted.customThemeName) {
        void selectTheme(persisted.customThemeName);
      } else if (legacyThemePath) {
        void migrateLegacyCustomTheme(legacyThemePath);
      }

      // The app is usually reached *from the file* (PRODUCT.md): a double click,
      // an "Open with", a path on argv. Those paths were queued in Rust before
      // this webview existed, so drain them here — and open them before anything
      // else claims the window.
      const requestedPaths = await openPendingFiles();
      if (cancelled) return;

      await restoreWorkspace(requestedPaths);
      if (cancelled) return;

      // First run: seed the bundled welcome document. Afterwards an empty
      // session shows the welcome/empty state instead. Skipped when the user
      // arrived by opening a specific file — they asked for that document, not
      // for an introduction to the app.
      const settings = useSettings.getState();
      if (
        shouldSeedWelcome({
          openedRequestedFile: requestedPaths.length > 0,
          openDocuments: useDocuments.getState().documents.length,
          hasSeenWelcome: settings.hasSeenWelcome,
        })
      ) {
        useDocuments.getState().createDocument({ markdown: welcomeDocument(language) });
        settings.markWelcomeSeen();
      }
    })();

    // Files that arrive while the app is already running: a second double-click
    // is routed here by the single-instance plugin instead of starting a second
    // app. Same drain as at startup, so both paths behave identically.
    const filesPending = onFilesPending(() => void openPendingFiles());

    return () => {
      cancelled = true;
      i18n.off("languageChanged", handleLanguageChanged);
      unsubscribePersistence();
      void filesPending.then((unlisten) => unlisten());
    };
  }, []);
}
