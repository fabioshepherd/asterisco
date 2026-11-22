import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: vi.fn() }));
vi.mock("@tauri-apps/plugin-os", () => ({ platform: vi.fn() }));
vi.mock("@/lib/tauri/menu", () => ({ setAppMenu: vi.fn().mockResolvedValue(undefined) }));

import { isTauri } from "@tauri-apps/api/core";
import { platform } from "@tauri-apps/plugin-os";

import type { SpecNode, SpecSection } from "@/lib/tauri/menu-spec";

import i18n from "@/i18n";
import { setAppMenu } from "@/lib/tauri/menu";
import { useKeybindings } from "@/features/settings/keybindings";

import { useNativeMenu } from "./use-native-menu";

function pushedSpec(call: number): SpecSection[] {
  return vi.mocked(setAppMenu).mock.calls[call]?.[0] as SpecSection[];
}

function commandLabel(
  spec: SpecSection[],
  sectionId: string,
  commandId: string,
): string | undefined {
  const section = spec.find((s) => s.id === sectionId);
  const node = section?.children.find(
    (c): c is Extract<SpecNode, { kind: "command" }> => c.kind === "command" && c.id === commandId,
  );
  return node?.label;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isTauri).mockReturnValue(true);
  // The native menu is macOS-only, so that is the default for these tests.
  vi.mocked(platform).mockReturnValue("macos");
});

afterEach(async () => {
  useKeybindings.getState().resetAll();
  await i18n.changeLanguage("en");
});

describe("useNativeMenu", () => {
  it("pushes the localized menu spec on mount under Tauri", () => {
    renderHook(() => useNativeMenu());

    expect(setAppMenu).toHaveBeenCalledTimes(1);
    const spec = pushedSpec(0);
    // English defaults active; spot-check a couple of localized labels.
    expect(spec.find((s) => s.id === "file")?.label).toBe("File");
    expect(commandLabel(spec, "file", "save-file")).toBe("Save");
    expect(spec.find((s) => s.id === "help")?.label).toBe("Help");
  });

  it("does nothing outside the Tauri runtime", () => {
    vi.mocked(isTauri).mockReturnValue(false);

    renderHook(() => useNativeMenu());

    expect(setAppMenu).not.toHaveBeenCalled();
  });

  // On Windows/Linux AppMenubar is the app menu. A native menu alongside it would
  // draw a second menu bar and register accelerators that outrank the in-app
  // keymap, so the hook must not push a spec there at all.
  it.each(["windows", "linux"] as const)("pushes no native menu on %s", (os) => {
    vi.mocked(platform).mockReturnValue(os);

    renderHook(() => useNativeMenu());

    expect(setAppMenu).not.toHaveBeenCalled();
  });

  it("stops pushing on a language change once the platform is not macOS", async () => {
    vi.mocked(platform).mockReturnValue("windows");

    renderHook(() => useNativeMenu());
    await i18n.changeLanguage("it");

    expect(setAppMenu).not.toHaveBeenCalled();
  });

  it("rebuilds the menu when the language changes", async () => {
    renderHook(() => useNativeMenu());
    expect(setAppMenu).toHaveBeenCalledTimes(1);

    await i18n.changeLanguage("it");

    expect(setAppMenu).toHaveBeenCalledTimes(2);
    const spec = pushedSpec(1);
    expect(spec.find((s) => s.id === "file")?.label).toBe("File");
    expect(commandLabel(spec, "file", "save-file")).toBe("Salva");
    expect(spec.find((s) => s.id === "help")?.label).toBe("Aiuto");
  });

  it("rebuilds the menu when a keybinding changes, so the key-equivalent follows it", () => {
    renderHook(() => useNativeMenu());

    act(() => useKeybindings.getState().setBinding("newFile", "mod+alt+n"));

    expect(setAppMenu).toHaveBeenCalledTimes(2);
    const file = pushedSpec(1).find((s) => s.id === "file");
    const item = file?.children.find((c) => c.kind === "command" && c.id === "new-file");
    expect(item).toMatchObject({ accelerator: "CmdOrCtrl+Alt+N" });
  });

  it("stops rebuilding after unmount", async () => {
    const { unmount } = renderHook(() => useNativeMenu());
    expect(setAppMenu).toHaveBeenCalledTimes(1);

    unmount();
    await i18n.changeLanguage("it");
    useKeybindings.getState().resetAll();

    expect(setAppMenu).toHaveBeenCalledTimes(1);
  });
});
