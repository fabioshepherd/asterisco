import { AnimatePresence, m } from "motion/react";
import { useEffect } from "react";

import { DocumentEditor } from "@/editor/DocumentEditor";
import { CommandPalette } from "@/features/command-palette/CommandPalette";
import { UnsavedPromptDialog } from "@/features/file-ops/UnsavedPromptDialog";
import { Sidebar } from "@/features/file-tree/Sidebar";
import { SidebarRevealButton } from "@/features/file-tree/SidebarRevealButton";
import { FindReplace } from "@/features/find-replace/FindReplace";
import { DropOverlay } from "@/features/file-drop/DropOverlay";
import { Toaster } from "@/features/notifications/Toaster";
import { WorkspaceSearch } from "@/features/search/WorkspaceSearch";
import { AboutDialog } from "@/features/about/AboutDialog";
import { NoticesDialog } from "@/features/settings/NoticesDialog";
import { SettingsPanel } from "@/features/settings/SettingsPanel";
import { useSettingsPanel } from "@/features/settings/use-settings-panel";
import { StatusBar } from "@/features/status-bar/StatusBar";
import { TabBar } from "@/features/tabs/TabBar";
import { useSettings } from "@/stores/settings";
import { useUi } from "@/stores/ui";
import { cn } from "@/lib/utils";

import { setWindowFullscreen } from "@/lib/tauri/window";
import { useAutoSave } from "@/features/file-sync/use-auto-save";
import { useFileWatcher } from "@/features/file-sync/use-file-watcher";
import { useTabShortcuts } from "@/features/tabs/use-tab-shortcuts";
import { useThemesHotReload } from "@/features/themes/use-themes-hot-reload";

import { MacTitleStrip } from "./chrome/MacTitleStrip";
import { TitleBar } from "./chrome/TitleBar";
import { usePlatformChrome } from "./chrome/use-platform-chrome";
import { ErrorBoundary } from "./ErrorBoundary";
import { MotionProvider } from "./MotionProvider";
import { reflowLayout, useWindowWidth } from "./use-reflow";
import { useCloseGuard } from "./use-close-guard";
import { useFileDrop } from "./use-file-drop";
import { useFloatingSidebar } from "./use-floating-sidebar";
import { useGlobalShortcuts } from "./use-global-shortcuts";
import { useMenuEvents } from "./use-menu-events";
import { useNativeMenu } from "./use-native-menu";
import { useWebViewContextMenu } from "./use-webview-context-menu";
import { useStartup } from "./use-startup";
import { useThemeSync } from "./use-theme-sync";

export function App() {
  useStartup();
  useThemeSync();
  useNativeMenu();
  useWebViewContextMenu();
  useMenuEvents();
  useCloseGuard();
  const drag = useFileDrop();
  useGlobalShortcuts();
  useTabShortcuts();
  useFileWatcher();
  useThemesHotReload();
  useAutoSave();

  const accent = useSettings((state) => state.accent);
  const neutral = useSettings((state) => state.neutral);
  const editorFontSize = useSettings((state) => state.editorFontSize);
  const lineWidth = useSettings((state) => state.lineWidth);
  const editorFontFamily = useSettings((state) => state.editorFontFamily);
  const editorLineHeight = useSettings((state) => state.editorLineHeight);
  const sidebarVisible = useUi((state) => state.sidebarVisible);
  const distractionFree = useUi((state) => state.distractionFree);
  const settingsOpen = useSettingsPanel((state) => state.isOpen);
  const sidebarWidth = useUi((state) => state.sidebarWidth);
  const sidebarShown = sidebarVisible && !distractionFree;
  const { sidebarOverlay, settingsOverlay } = reflowLayout(
    useWindowWidth(),
    sidebarWidth,
    sidebarShown,
  );
  const floatingSidebar = useFloatingSidebar(sidebarOverlay, sidebarShown);
  const setDistractionFree = useUi((state) => state.setDistractionFree);
  const { chrome } = usePlatformChrome();

  // Distraction-free mode hides all chrome and goes native fullscreen; Escape exits.
  useEffect(() => {
    void setWindowFullscreen(distractionFree);
    if (!distractionFree) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDistractionFree(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [distractionFree, setDistractionFree]);

  // Apply the active accent: set data-accent on <html>; accents.css re-points the
  // accent-derived tokens to the matching Radix scale (live, no reload).
  useEffect(() => {
    document.documentElement.dataset.accent = accent;
  }, [accent]);

  // Apply the active neutral base: set data-neutral on <html>; neutrals.css
  // re-points the neutral tokens to the matching Radix gray scale (live, no reload).
  useEffect(() => {
    document.documentElement.dataset.neutral = neutral;
  }, [neutral]);

  // Apply editor typography via CSS variables consumed in editor-theme.css.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--editor-font-size", `${editorFontSize}px`);
    root.style.setProperty("--editor-measure", `${lineWidth}ch`);
    root.style.setProperty("--editor-font-default", `var(--font-${editorFontFamily})`);
    root.style.setProperty("--editor-line-height", `${editorLineHeight}`);
  }, [editorFontSize, lineWidth, editorFontFamily, editorLineHeight]);

  return (
    <MotionProvider>
      <div className="flex h-full min-h-0 flex-col">
        {/* macOS overlay title strip spans the full window width above the
            sidebar/main split; it hosts the tabs alongside the traffic lights. */}
        {chrome === "mac" && !distractionFree ? <MacTitleStrip /> : null}
        {/* Windows/Linux frameless custom title bar (menu + window controls);
            the tab strip is rendered inside <main> below. */}
        {chrome === "winlinux" && !distractionFree ? <TitleBar /> : null}
        <div className="relative flex min-h-0 flex-1">
          {/* Width is the documented layout-animation exception (premium-motion design);
              overflow-hidden clips the fixed-width Sidebar as it collapses. On a
              narrow window (minimum size at 200% zoom) the sidebar and Settings
              float over the document rather than squeeze it (SC 1.4.10); floating,
              the sidebar closes on Escape and hands focus back. */}
          <AnimatePresence initial={false}>
            {sidebarShown && (
              <m.div
                ref={floatingSidebar.ref}
                onKeyDown={floatingSidebar.onKeyDown}
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: "auto", opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                className={cn(
                  "flex shrink-0 overflow-hidden",
                  sidebarOverlay &&
                    "absolute inset-y-0 left-0 z-(--z-panel) max-w-full shadow-card",
                )}
              >
                <Sidebar />
              </m.div>
            )}
          </AnimatePresence>
          <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
            <SidebarRevealButton />
            {/* Narrow boundary: an editor-stack crash keeps the shell and dialogs alive. */}
            <ErrorBoundary variant="editor">
              <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
                {/* macOS hosts the tab strip in the title bar; distraction-free hides it. */}
                {chrome === "winlinux" && !distractionFree ? <TabBar /> : null}
                <DocumentEditor />
              </div>
            </ErrorBoundary>
            <FindReplace />
            <WorkspaceSearch />
          </main>
          {/* Settings dock beside the document instead of over it, so the theme,
              the accent and the typography being changed are visible on the real
              text while they change. Same width animation (and the same clipping
              trick) as the sidebar it mirrors; the panel stays mounted through
              its exit, which is why it is the mount that carries the open state. */}
          <AnimatePresence initial={false}>
            {settingsOpen && (
              <m.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: "auto", opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                className={cn(
                  "flex shrink-0 overflow-hidden",
                  settingsOverlay &&
                    "absolute inset-y-0 right-0 z-(--z-panel) max-w-full shadow-card",
                )}
              >
                <SettingsPanel />
              </m.div>
            )}
          </AnimatePresence>
        </div>

        {!distractionFree ? <StatusBar /> : null}
        <UnsavedPromptDialog />
        <CommandPalette />
        <NoticesDialog />
        <AboutDialog />
        <DropOverlay phase={drag.phase} />
        <Toaster />
      </div>
    </MotionProvider>
  );
}
