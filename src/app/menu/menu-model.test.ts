import { describe, expect, it } from "vitest";
import { COMMANDS } from "./commands";
import { MENU_MODEL, type MenuNode, type Platform } from "./menu-model";

function walk(nodes: MenuNode[], visit: (n: MenuNode) => void) {
  for (const n of nodes) {
    visit(n);
    if (n.kind === "submenu") walk(n.children, visit);
  }
}

describe("menu model", () => {
  it("every command node references a registered command id", () => {
    walk(
      MENU_MODEL.flatMap((s) => s.children),
      (n) => {
        if (n.kind === "command") expect(COMMANDS[n.command]).toBeDefined();
      },
    );
  });

  it("has the expected top-level sections in order", () => {
    expect(MENU_MODEL.map((s) => s.id)).toEqual([
      "app",
      "file",
      "edit",
      "format",
      "view",
      "window",
      "help",
    ]);
  });

  it.each<Platform>(["mac", "win", "linux"])("lists each command in one menu only (%s)", (p) => {
    // Close sat in File and Window, Toggle Theme in the app menu and View.
    // About is the one command placed per platform: app menu on macOS, Help elsewhere.
    const seen: string[] = [];
    walk(
      MENU_MODEL.flatMap((s) => s.children),
      (n) => {
        if (n.kind === "command" && (!n.platforms || n.platforms.includes(p))) {
          seen.push(n.command);
        }
      },
    );
    expect(seen.filter((id, index) => seen.indexOf(id) !== index)).toEqual([]);
  });

  it("puts About in the app menu on macOS and in Help on Windows/Linux", () => {
    const placement = (p: Platform) =>
      MENU_MODEL.filter((s) =>
        s.children.some(
          (n) => n.kind === "command" && n.command === "about" && n.platforms?.includes(p),
        ),
      ).map((s) => s.id);
    expect(placement("mac")).toEqual(["app"]);
    expect(placement("win")).toEqual(["help"]);
    expect(placement("linux")).toEqual(["help"]);
  });
});
