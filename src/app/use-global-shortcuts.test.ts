import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { COMMANDS, type CommandId } from "@/app/menu/commands";
import { useWorkspaceSearch } from "@/features/search/use-workspace-search";
import { useKeybindings } from "@/features/settings/keybindings";

import { useGlobalShortcuts } from "./use-global-shortcuts";

function press(init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { ...init, cancelable: true, bubbles: true });
  window.dispatchEvent(event);
  return event;
}

/** Stub every command body so a keystroke records which one it reached. */
function spyOnCommands() {
  return Object.fromEntries(
    Object.values(COMMANDS).map((command) => [
      command.id,
      vi.spyOn(command, "run").mockImplementation(() => undefined),
    ]),
  ) as Record<CommandId, ReturnType<typeof vi.spyOn>>;
}

beforeEach(() => useKeybindings.getState().resetAll());
afterEach(() => vi.restoreAllMocks());

describe("useGlobalShortcuts", () => {
  // Off macOS there is no native menu to register these accelerators, so the
  // webview is the only place they can fire (ROADMAP "Menu gaps", [V1]).
  const FILE_KEYS: { key: string; shiftKey?: boolean; command: CommandId }[] = [
    { key: "n", command: "new-file" },
    { key: "o", command: "open-file" },
    { key: "O", shiftKey: true, command: "open-folder" },
    { key: "s", command: "save-file" },
    { key: "S", shiftKey: true, command: "save-file-as" },
    { key: "p", command: "print" },
    { key: "w", command: "close" },
    { key: "q", command: "quit" },
  ];

  it.each(FILE_KEYS)(
    "dispatches mod+n/mod+o/... on windows and linux: $key → $command",
    ({ key, shiftKey, command }) => {
      const spies = spyOnCommands();
      renderHook(() => useGlobalShortcuts());

      const event = press({ key, ctrlKey: true, shiftKey });

      expect(spies[command]).toHaveBeenCalledTimes(1);
      // WebView2 would otherwise open its own "save page" / "print page" dialog.
      expect(event.defaultPrevented).toBe(true);
    },
  );

  it("follows a remapped File shortcut", () => {
    const spies = spyOnCommands();
    useKeybindings.getState().setBinding("newFile", "mod+alt+n");
    renderHook(() => useGlobalShortcuts());

    press({ key: "n", ctrlKey: true });
    expect(spies["new-file"]).not.toHaveBeenCalled();
    press({ key: "n", ctrlKey: true, altKey: true });
    expect(spies["new-file"]).toHaveBeenCalledTimes(1);
  });

  it("leaves Ctrl+Shift+P to the command palette, not Print", () => {
    const spies = spyOnCommands();
    renderHook(() => useGlobalShortcuts());

    press({ key: "P", ctrlKey: true, shiftKey: true });

    expect(spies.print).not.toHaveBeenCalled();
  });

  it("opens workspace search the way the menu and palette do", () => {
    // One command, one behaviour: the key used to toggle while the menu opened.
    useWorkspaceSearch.setState({ isOpen: false });
    renderHook(() => useGlobalShortcuts());

    press({ key: "F", ctrlKey: true, shiftKey: true });
    press({ key: "F", ctrlKey: true, shiftKey: true });

    expect(useWorkspaceSearch.getState().isOpen).toBe(true);
    useWorkspaceSearch.setState({ isOpen: false });
  });

  it.each(["s", "p"])(
    "suppresses the WebView's own page Save/Print on mod+%s even when unbound",
    (key) => {
      const spies = spyOnCommands();
      useKeybindings.getState().clearBinding(key === "s" ? "save" : "print");
      renderHook(() => useGlobalShortcuts());

      const event = press({ key, ctrlKey: true });

      expect(event.defaultPrevented).toBe(true);
      expect(spies["save-file"]).not.toHaveBeenCalled();
      expect(spies.print).not.toHaveBeenCalled();
    },
  );

  it("runs the action a combo was reassigned to, still suppressing the page dialog", () => {
    const spies = spyOnCommands();
    useKeybindings.getState().clearBinding("save");
    useKeybindings.getState().setBinding("outline", "mod+s");
    renderHook(() => useGlobalShortcuts());

    const event = press({ key: "s", ctrlKey: true });

    expect(event.defaultPrevented).toBe(true);
    expect(spies["toggle-outline"]).toHaveBeenCalledTimes(1);
    expect(spies["save-file"]).not.toHaveBeenCalled();
  });

  it("ignores a plain keystroke", () => {
    const spies = spyOnCommands();
    renderHook(() => useGlobalShortcuts());

    const event = press({ key: "s" });

    expect(spies["save-file"]).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });
});
