import { afterEach, describe, expect, it, vi } from "vitest";

import { useSettings } from "@/stores/settings";

import { COMMANDS, type CommandDef, type CommandId } from "./commands";
import { MENU_MODEL, type MenuNode } from "./menu-model";

describe("command registry", () => {
  it("every command has a stable id matching its key and a run function", () => {
    for (const [id, cmd] of Object.entries(COMMANDS)) {
      expect(cmd.id).toBe(id);
      expect(typeof cmd.run).toBe("function");
    }
  });

  it("exposes the canonical ids the native menu depends on", () => {
    const ids: CommandId[] = [
      "new-file",
      "open-file",
      "open-folder",
      "save-file",
      "save-file-as",
      "close",
      "quit",
      "export-html",
      "print",
      "copy-html",
      "copy-markdown",
      "settings",
      "check-updates",
      "toggle-theme",
      "find",
      "replace",
      "search-workspace",
      "command-palette",
      "toggle-sidebar",
      "toggle-outline",
      "reading-mode",
      "source-mode",
      "distraction-free",
      "help-shortcuts",
    ];
    for (const id of ids) expect(COMMANDS[id]).toBeDefined();
  });

  it("gives a palette group to every command the menu does not list", () => {
    // A menu command takes its menu's group; anything else would be invisible.
    const inMenu = new Set<string>();
    const walk = (nodes: readonly MenuNode[]) => {
      for (const node of nodes) {
        if (node.kind === "command") inMenu.add(node.command);
        if (node.kind === "submenu") walk(node.children);
      }
    };
    for (const section of MENU_MODEL) walk(section.children);

    const orphans = Object.values(COMMANDS as Record<string, CommandDef>).filter(
      (command) => !inMenu.has(command.id) && !command.group,
    );
    expect(orphans.map((command) => command.id)).toEqual([]);
  });
});

describe("toggle-theme", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useSettings.setState({ themePreference: "system" });
  });

  it("flips the theme that is in effect, including the system one", () => {
    const systemDark = (dark: boolean) =>
      vi.spyOn(window, "matchMedia").mockReturnValue({ matches: dark } as MediaQueryList);

    systemDark(true);
    useSettings.setState({ themePreference: "system" });
    COMMANDS["toggle-theme"].run();
    expect(useSettings.getState().themePreference).toBe("light");

    COMMANDS["toggle-theme"].run();
    expect(useSettings.getState().themePreference).toBe("dark");

    systemDark(false);
    useSettings.setState({ themePreference: "system" });
    COMMANDS["toggle-theme"].run();
    expect(useSettings.getState().themePreference).toBe("dark");
  });
});
