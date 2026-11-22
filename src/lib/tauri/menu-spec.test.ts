import { describe, expect, it } from "vitest";

import { KEY_ACTIONS } from "@/features/settings/keybindings";

import { buildMenuSpec, comboToAccelerator, type SpecNode } from "./menu-spec";

const DEFAULTS = Object.fromEntries(KEY_ACTIONS.map((action) => [action.id, action.defaultCombo]));

describe("comboToAccelerator", () => {
  it("writes a keymap combo in Tauri accelerator syntax", () => {
    expect(comboToAccelerator("mod+n")).toBe("CmdOrCtrl+N");
    expect(comboToAccelerator("mod+alt+shift+o")).toBe("CmdOrCtrl+Alt+Shift+O");
    expect(comboToAccelerator("mod+comma")).toBe("CmdOrCtrl+,");
  });
});

describe("buildMenuSpec", () => {
  const t = (key: string) => `T:${key}`;

  it("resolves labels and keeps canonical ids", () => {
    const spec = buildMenuSpec("mac", t, DEFAULTS);
    const file = spec.find((s) => s.id === "file")!;
    expect(file.label).toBe("T:file.title");
    const newFile = file.children.find((c) => c.kind === "command" && c.id === "new-file")!;
    expect(newFile).toMatchObject({
      kind: "command",
      id: "new-file",
      label: "T:file.new",
      accelerator: "CmdOrCtrl+N",
    });
  });

  it("gives Format commands native key-equivalents on macOS (right-aligned by the OS)", () => {
    const spec = buildMenuSpec("mac", t, DEFAULTS);
    const format = spec.find((s) => s.id === "format")!;
    const bold = format.children.find((c) => c.kind === "command" && c.id === "format-bold")!;
    // Plain label + a real accelerator (Mod-b -> CmdOrCtrl+B); no tab-hint text.
    expect(bold).toMatchObject({
      kind: "command",
      id: "format-bold",
      label: "T:format.bold",
      accelerator: "CmdOrCtrl+B",
    });
    const strike = format.children.find(
      (c) => c.kind === "command" && c.id === "format-strikethrough",
    )!;
    expect((strike as { accelerator: string }).accelerator).toBe("CmdOrCtrl+Shift+X");
    const h2 = format.children
      .flatMap((c) => (c.kind === "submenu" ? c.children : [c]))
      .find((c) => c.kind === "command" && c.id === "format-h2")!;
    expect((h2 as { accelerator: string }).accelerator).toBe("CmdOrCtrl+2");
  });

  it("leaves Format commands without a native accelerator off macOS (editor keymap owns them)", () => {
    const spec = buildMenuSpec("win", t, DEFAULTS);
    const format = spec.find((s) => s.id === "format")!;
    const bold = format.children.find((c) => c.kind === "command" && c.id === "format-bold")!;
    expect(bold).toMatchObject({
      kind: "command",
      id: "format-bold",
      label: "T:format.bold",
      accelerator: undefined,
    });
  });

  it("puts the app's own About command in the macOS app menu, not the native panel", () => {
    const app = buildMenuSpec("mac", t, DEFAULTS).find((s) => s.id === "app")!;
    expect(app.children[0]).toMatchObject({ kind: "command", id: "about", label: "T:app.about" });
    expect(app.children).not.toContainEqual({ kind: "predefined", role: "about" });
  });

  it("drops macOS-only predefined roles on win/linux", () => {
    const spec = buildMenuSpec("win", t, DEFAULTS);
    const app = spec.find((s) => s.id === "app")!;
    const roles = app.children
      .filter((c) => c.kind === "predefined")
      .map((c) => (c as { role: string }).role);
    expect(roles).not.toContain("services");
    expect(roles).not.toContain("hideOthers");
    expect(roles).not.toContain("showAll");
  });

  it("takes the File/app key-equivalents from the keymap, so a remap moves them", () => {
    const fileItem = (bindings: Record<string, string>, id: string) =>
      buildMenuSpec("mac", t, bindings)
        .find((s) => s.id === "file")!
        .children.find(
          (c): c is Extract<SpecNode, { kind: "command" }> => c.kind === "command" && c.id === id,
        );

    expect(fileItem(DEFAULTS, "save-file-as")?.accelerator).toBe("CmdOrCtrl+Shift+S");
    expect(fileItem({ ...DEFAULTS, newFile: "mod+alt+n" }, "new-file")?.accelerator).toBe(
      "CmdOrCtrl+Alt+N",
    );
    expect(fileItem({ ...DEFAULTS, newFile: "" }, "new-file")?.accelerator).toBeUndefined();
  });

  it("gives no native key-equivalent to a keymap command outside the File/app set", () => {
    // Toggle Sidebar stays a webview shortcut on macOS, as it always was.
    const view = buildMenuSpec("mac", t, DEFAULTS).find((s) => s.id === "view")!;
    const sidebar = view.children.find((c) => c.kind === "command" && c.id === "toggle-sidebar");
    expect(sidebar).toMatchObject({ accelerator: undefined });
  });
});
