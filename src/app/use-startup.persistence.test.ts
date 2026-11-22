import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { UiPrefs } from "@/lib/tauri/settings-store";

const store = vi.hoisted(() => {
  let resolveUi: (prefs: Partial<UiPrefs>) => void = () => {};
  return {
    uiLoaded: (prefs: Partial<UiPrefs>) => resolveUi(prefs),
    loadUiPrefs: vi.fn(
      () =>
        new Promise<Partial<UiPrefs>>((resolve) => {
          resolveUi = resolve;
        }),
    ),
    saveUiPrefs: vi.fn(() => Promise.resolve()),
    savePersistedSettings: vi.fn(() => Promise.resolve()),
    saveRecents: vi.fn(() => Promise.resolve()),
    saveRecentFolders: vi.fn(() => Promise.resolve()),
    saveKeybindings: vi.fn(() => Promise.resolve()),
  };
});

vi.mock("@/lib/tauri/settings-store", () => ({
  loadPersistedSettings: () => Promise.resolve({ language: "en", hasSeenWelcome: true }),
  loadRecents: () => Promise.resolve([]),
  loadRecentFolders: () => Promise.resolve([]),
  loadKeybindings: () => Promise.resolve({}),
  loadUiPrefs: store.loadUiPrefs,
  loadWorkspaceRoot: () => Promise.resolve(null),
  saveWorkspaceRoot: () => Promise.resolve(),
  saveUiPrefs: store.saveUiPrefs,
  savePersistedSettings: store.savePersistedSettings,
  saveRecents: store.saveRecents,
  saveRecentFolders: store.saveRecentFolders,
  saveKeybindings: store.saveKeybindings,
}));
vi.mock("@/lib/tauri/open-with", () => ({
  takePendingFiles: () => Promise.resolve([]),
  onFilesPending: () => Promise.resolve(() => {}),
}));
vi.mock("@/lib/tauri/system", () => ({ getOsLanguage: () => Promise.resolve("en") }));

import { SIDEBAR_WIDTH, useUi } from "@/stores/ui";
import { useSettings } from "@/stores/settings";

import { useStartup } from "./use-startup";

async function flush(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
  });
}

describe("useStartup persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUi.setState({ sidebarWidth: SIDEBAR_WIDTH.default, outlineVisible: true });
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("does not save UI prefs before the stored ones are loaded", async () => {
    const { unmount } = renderHook(() => useStartup());
    // A UI change that is not persisted, while the load is still in flight.
    act(() => useUi.getState().setDistractionFree(true));
    expect(store.saveUiPrefs).not.toHaveBeenCalled();

    store.uiLoaded({ sidebarWidth: 320, outlineVisible: false });
    await flush();

    expect(useUi.getState().sidebarWidth).toBe(320);
    expect(useUi.getState().outlineVisible).toBe(false);
    // Applying what was loaded is not a change to write back.
    expect(store.saveUiPrefs).not.toHaveBeenCalled();
    expect(store.savePersistedSettings).not.toHaveBeenCalled();
    unmount();
  });

  it("writes only persisted values that changed", async () => {
    const { unmount } = renderHook(() => useStartup());
    store.uiLoaded({});
    await flush();
    store.saveUiPrefs.mockClear();
    store.savePersistedSettings.mockClear();

    act(() => {
      useUi.getState().setDistractionFree(true);
      useUi.getState().setViewMode("reading");
      useUi.getState().toggleSidebar();
      useUi.getState().setSidebarWidth(useUi.getState().sidebarWidth);
    });
    expect(store.saveUiPrefs).not.toHaveBeenCalled();

    act(() => useUi.getState().setSidebarWidth(300));
    expect(store.saveUiPrefs).toHaveBeenCalledTimes(1);
    expect(store.saveUiPrefs).toHaveBeenCalledWith({ sidebarWidth: 300 });

    act(() => useSettings.getState().setAutoSave(useSettings.getState().autoSave));
    expect(store.savePersistedSettings).not.toHaveBeenCalled();
    unmount();
  });
});
