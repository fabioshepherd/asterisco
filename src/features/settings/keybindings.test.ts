import { beforeEach, describe, expect, it } from "vitest";

import { COMMANDS } from "@/app/menu/commands";
import { useSettings } from "@/stores/settings";

import {
  actionForCombo,
  eventToCombo,
  formatCombo,
  KEY_ACTIONS,
  useKeybindings,
} from "./keybindings";

describe("eventToCombo", () => {
  it("normalizes a modifier + key into a combo", () => {
    expect(eventToCombo(new KeyboardEvent("keydown", { key: "k", metaKey: true }))).toBe("mod+k");
    expect(
      eventToCombo(new KeyboardEvent("keydown", { key: "K", metaKey: true, shiftKey: true })),
    ).toBe("mod+shift+k");
    expect(eventToCombo(new KeyboardEvent("keydown", { key: ",", ctrlKey: true }))).toBe(
      "mod+comma",
    );
  });

  it("returns null for a modifier-only event", () => {
    expect(eventToCombo(new KeyboardEvent("keydown", { key: "Meta", metaKey: true }))).toBeNull();
  });
});

describe("formatCombo", () => {
  it("renders a readable combo containing the key", () => {
    expect(formatCombo("mod+shift+k")).toMatch(/K/);
  });
});

describe("keybindings store", () => {
  beforeEach(() => useKeybindings.getState().resetAll());

  it("resolves the action bound to a default combo", () => {
    expect(actionForCombo("mod+shift+p")?.id).toBe("commandPalette");
  });

  it("rebinds and resets an action", () => {
    useKeybindings.getState().setBinding("commandPalette", "mod+alt+p");
    expect(actionForCombo("mod+alt+p")?.id).toBe("commandPalette");
    useKeybindings.getState().resetBinding("commandPalette");
    expect(useKeybindings.getState().bindings.commandPalette).toBe("mod+shift+p");
  });
});

describe("commandPalette keybinding", () => {
  it("binds the command palette to mod+shift+p (frees mod+k for link)", () => {
    const palette = KEY_ACTIONS.find((a) => a.id === "commandPalette");
    expect(palette?.defaultCombo).toBe("mod+shift+p");
  });
});

describe("toggleAutoSave keybinding", () => {
  beforeEach(() => {
    useKeybindings.getState().resetAll();
    useSettings.setState({ autoSave: false });
  });

  it("is registered but unbound by default", () => {
    const action = KEY_ACTIONS.find((a) => a.id === "toggleAutoSave");
    expect(action?.defaultCombo).toBe("");
    expect(useKeybindings.getState().bindings.toggleAutoSave).toBe("");
    expect(actionForCombo("mod+shift+a")).toBeUndefined();
  });

  it("drops a persisted mod+shift+a (the retired default) on hydrate", () => {
    useKeybindings.getState().hydrate({ toggleAutoSave: "mod+shift+a", find: "mod+alt+f" });
    expect(useKeybindings.getState().bindings.toggleAutoSave).toBe("");
    expect(actionForCombo("mod+shift+a")).toBeUndefined();
    expect(useKeybindings.getState().bindings.find).toBe("mod+alt+f");
  });

  it("keeps a persisted user-custom binding, which still flips auto-save", () => {
    useKeybindings.getState().hydrate({ toggleAutoSave: "mod+alt+s" });
    const action = actionForCombo("mod+alt+s");
    expect(action?.id).toBe("toggleAutoSave");
    if (action) void COMMANDS[action.command].run();
    expect(useSettings.getState().autoSave).toBe(true);
  });
});

describe("hydrate", () => {
  beforeEach(() => useKeybindings.getState().resetAll());

  it("migrates away split settings", () => {
    // A store written before the split editor was removed still carries its id.
    expect(() =>
      useKeybindings.getState().hydrate({ splitEditor: "mod+\\", find: "mod+alt+f" }),
    ).not.toThrow();
    const { bindings } = useKeybindings.getState();
    expect(bindings).not.toHaveProperty("splitEditor");
    expect(KEY_ACTIONS.some((a) => (a.id as string) === "splitEditor")).toBe(false);
    expect(actionForCombo("mod+\\")).toBeUndefined();
    // Known ids still hydrate.
    expect(bindings.find).toBe("mod+alt+f");
  });

  it("drops unknown ids on hydrate so they cannot linger in the bindings", () => {
    useKeybindings.getState().hydrate({ removedAction: "mod+shift+p" });
    expect(Object.keys(useKeybindings.getState().bindings)).not.toContain("removedAction");
    expect(actionForCombo("mod+shift+p")?.id).toBe("commandPalette");
  });
});

describe("persisted keybinding ids", () => {
  beforeEach(() => useKeybindings.getState().resetAll());

  // `keybindings` in settings.json is keyed by these ids; renaming one would
  // silently drop a user's custom shortcut. Each now names a command instead of
  // carrying its own body, and that must not change what a stored binding runs.
  const STORED: Record<string, string> = {
    commandPalette: "mod+alt+1",
    find: "mod+alt+2",
    searchWorkspace: "mod+alt+3",
    focusFileTree: "mod+alt+4",
    moveTabLeft: "mod+alt+5",
    moveTabRight: "mod+alt+6",
    sourceMode: "mod+alt+7",
    readingMode: "mod+alt+8",
    distractionFree: "mod+alt+9",
    outline: "mod+alt+o",
    sidebar: "mod+alt+l",
    settings: "mod+alt+s",
    toggleAutoSave: "mod+alt+a",
  };
  const COMMAND_OF: Record<string, string> = {
    commandPalette: "command-palette",
    find: "find",
    searchWorkspace: "search-workspace",
    focusFileTree: "focus-file-tree",
    moveTabLeft: "move-tab-left",
    moveTabRight: "move-tab-right",
    sourceMode: "source-mode",
    readingMode: "reading-mode",
    distractionFree: "distraction-free",
    outline: "toggle-outline",
    sidebar: "toggle-sidebar",
    settings: "settings",
    toggleAutoSave: "toggle-auto-save",
  };

  it("keeps every id a user may have stored, each running the same command", () => {
    useKeybindings.getState().hydrate(STORED);

    for (const [id, combo] of Object.entries(STORED)) {
      expect(useKeybindings.getState().bindings[id], id).toBe(combo);
      expect(actionForCombo(combo)?.command, id).toBe(COMMAND_OF[id]);
    }
  });
});

describe("tab-reorder keybindings", () => {
  it("moveTabLeft / moveTabRight are registered with PageUp/PageDown", () => {
    const byId = new Map(KEY_ACTIONS.map((a) => [a.id, a.defaultCombo]));
    expect(byId.get("moveTabLeft")).toBe("mod+shift+pageup");
    expect(byId.get("moveTabRight")).toBe("mod+shift+pagedown");
  });
});
