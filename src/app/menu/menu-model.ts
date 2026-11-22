import type { CommandId } from "./commands";

export type Platform = "mac" | "win" | "linux";

/** Native predefined item roles (mapped to Tauri PredefinedMenuItem in Rust,
 *  and to editor/window commands or omission on Windows/Linux). */
export type PredefinedRole =
  | "about"
  | "services"
  | "hide"
  | "hideOthers"
  | "showAll"
  | "quit"
  | "undo"
  | "redo"
  | "cut"
  | "copy"
  | "paste"
  | "selectAll"
  | "fullscreen"
  | "minimize"
  | "maximize"
  | "closeWindow";

export type MenuNode =
  | {
      kind: "command";
      command: CommandId;
      /**
       * Register the command's keymap binding (`KEY_ACTIONS`) as a native macOS
       * key-equivalent. The combo itself lives in the keymap — remappable, and
       * dispatched in the webview on Windows/Linux — never here.
       */
      keyEquivalent?: true;
      platforms?: Platform[];
    }
  | { kind: "predefined"; role: PredefinedRole; platforms?: Platform[] }
  | { kind: "submenu"; id: string; labelKey: string; children: MenuNode[] }
  | { kind: "separator" };

export interface MenuSection {
  id: string;
  /** i18n key in the `menu` namespace; the app section label is "" → Rust uses the product name */
  labelKey: string;
  children: MenuNode[];
}

export type MenuModel = MenuSection[];

const MAC: Platform[] = ["mac"];
/** Windows and Linux keep About in Help, where their apps put it. */
const WIN_LINUX: Platform[] = ["win", "linux"];

/** Mirrors today's native menu exactly. Only the File/app items carry a native
 *  key-equivalent; every other keymap combo stays a webview shortcut on macOS. */
export const MENU_MODEL: MenuModel = [
  {
    id: "app",
    labelKey: "", // Rust falls back to the built-in product name
    children: [
      // The app's own About panel, not the native one (owner decision, 2026-11-20).
      { kind: "command", command: "about", platforms: MAC },
      { kind: "command", command: "settings" },
      { kind: "command", command: "check-updates" },
      { kind: "separator" },
      { kind: "predefined", role: "services", platforms: MAC },
      { kind: "separator" },
      { kind: "predefined", role: "hide", platforms: MAC },
      { kind: "predefined", role: "hideOthers", platforms: MAC },
      { kind: "predefined", role: "showAll", platforms: MAC },
      { kind: "separator" },
      { kind: "command", command: "quit", keyEquivalent: true },
    ],
  },
  {
    id: "file",
    labelKey: "file.title",
    children: [
      { kind: "command", command: "new-file", keyEquivalent: true },
      { kind: "command", command: "open-file", keyEquivalent: true },
      { kind: "command", command: "open-folder", keyEquivalent: true },
      { kind: "command", command: "close-folder" },
      { kind: "separator" },
      {
        kind: "submenu",
        id: "export",
        labelKey: "file.export.title",
        children: [
          // No shortcut: CmdOrCtrl+Shift+E is the explorer/file-tree combo this
          // audience arrives with, and the native menu was winning it silently from
          // the "focus file tree" binding. Exporting is a deliberate, occasional act
          // reached from this submenu or the command palette; focusing the tree is
          // navigation, twenty times a day.
          { kind: "command", command: "export-html" },
          { kind: "separator" },
          { kind: "command", command: "copy-html" },
          { kind: "command", command: "copy-markdown" },
        ],
      },
      { kind: "separator" },
      { kind: "command", command: "save-file", keyEquivalent: true },
      { kind: "command", command: "save-file-as", keyEquivalent: true },
      { kind: "separator" },
      { kind: "command", command: "print", keyEquivalent: true },
      { kind: "separator" },
      { kind: "command", command: "close", keyEquivalent: true },
    ],
  },
  {
    id: "edit",
    labelKey: "edit.title",
    children: [
      { kind: "predefined", role: "undo" },
      { kind: "predefined", role: "redo" },
      { kind: "separator" },
      { kind: "predefined", role: "cut" },
      { kind: "predefined", role: "copy" },
      { kind: "predefined", role: "paste" },
      { kind: "predefined", role: "selectAll" },
      { kind: "separator" },
      { kind: "command", command: "find" },
      { kind: "command", command: "replace" },
      { kind: "command", command: "search-workspace" },
    ],
  },
  {
    id: "format",
    labelKey: "format.title",
    children: [
      { kind: "command", command: "format-bold" },
      { kind: "command", command: "format-italic" },
      { kind: "command", command: "format-strikethrough" },
      { kind: "command", command: "format-code" },
      { kind: "separator" },
      { kind: "command", command: "format-link" },
      { kind: "command", command: "format-footnote" },
      { kind: "separator" },
      {
        kind: "submenu",
        id: "format-headings",
        labelKey: "format.headings",
        children: [
          { kind: "command", command: "format-h1" },
          { kind: "command", command: "format-h2" },
          { kind: "command", command: "format-h3" },
          { kind: "command", command: "format-h4" },
          { kind: "command", command: "format-h5" },
          { kind: "command", command: "format-h6" },
        ],
      },
      { kind: "command", command: "format-paragraph" },
    ],
  },
  {
    id: "view",
    labelKey: "view.title",
    children: [
      { kind: "command", command: "toggle-theme" },
      { kind: "separator" },
      { kind: "predefined", role: "fullscreen" },
      { kind: "separator" },
      { kind: "command", command: "command-palette" },
      { kind: "command", command: "toggle-sidebar" },
      { kind: "command", command: "toggle-outline" },
      { kind: "separator" },
      { kind: "command", command: "source-mode" },
      { kind: "command", command: "edit-view" },
      { kind: "command", command: "reading-mode" },
      { kind: "separator" },
      { kind: "command", command: "distraction-free" },
    ],
  },
  {
    id: "window",
    labelKey: "window.title",
    children: [
      { kind: "predefined", role: "minimize" },
      { kind: "predefined", role: "maximize" },
    ],
  },
  {
    id: "help",
    labelKey: "help.title",
    children: [
      { kind: "command", command: "help-shortcuts" },
      { kind: "separator" },
      { kind: "command", command: "help-licenses" },
      { kind: "separator" },
      { kind: "command", command: "about", platforms: WIN_LINUX },
    ],
  },
];
