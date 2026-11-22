import { COMMANDS } from "@/app/menu/commands";
import {
  MENU_MODEL,
  type MenuNode,
  type Platform,
  type PredefinedRole,
} from "@/app/menu/menu-model";
import { FORMAT_COMMAND_HINTS } from "@/editor/formatting-keymap";
import { commandCombo } from "@/features/settings/keybindings";

/** Flat, serializable node the Rust `set_app_menu` command consumes. */
export type SpecNode =
  | { kind: "command"; id: string; label: string; accelerator?: string }
  | { kind: "predefined"; role: PredefinedRole }
  | { kind: "submenu"; id: string; label: string; children: SpecNode[] }
  | { kind: "separator" };

export interface SpecSection {
  id: string;
  label: string;
  children: SpecNode[];
}

type T = (key: string) => string;

function allowed(platforms: Platform[] | undefined, target: Platform): boolean {
  return !platforms || platforms.includes(target);
}

/** "mod+shift+o" -> "CmdOrCtrl+Shift+O" (Tauri accelerator syntax). */
export function comboToAccelerator(combo: string): string {
  const names: Record<string, string> = {
    mod: "CmdOrCtrl",
    alt: "Alt",
    shift: "Shift",
    comma: ",",
    space: "Space",
  };
  return combo
    .split("+")
    .map((part) => names[part] ?? part.toUpperCase())
    .join("+");
}

function toSpec(
  node: MenuNode,
  target: Platform,
  t: T,
  bindings: Record<string, string>,
): SpecNode | null {
  switch (node.kind) {
    case "separator":
      return { kind: "separator" };
    case "predefined":
      return allowed(node.platforms, target) ? { kind: "predefined", role: node.role } : null;
    case "command": {
      if (!allowed(node.platforms, target)) return null;
      const def = COMMANDS[node.command];
      // On macOS the native menu owns formatting shortcuts as real key-equivalents
      // (right-aligned by the OS; the webview keymap is disabled there). On
      // Windows/Linux the editor keymap handles them and the DOM menubar shows the
      // hint, so we leave those native-menu items without an accelerator.
      // File/app items take their combo from the keymap, so a remap moves the
      // native key-equivalent with it.
      const native =
        node.keyEquivalent || (target === "mac" && FORMAT_COMMAND_HINTS[def.id] !== undefined);
      const combo = native ? commandCombo(def.id, bindings) : undefined;
      const accelerator = combo ? comboToAccelerator(combo) : undefined;
      return { kind: "command", id: def.id, label: t(def.labelKey), accelerator };
    }
    case "submenu": {
      const children = node.children
        .map((c) => toSpec(c, target, t, bindings))
        .filter((c): c is SpecNode => c !== null);
      return { kind: "submenu", id: node.id, label: t(node.labelKey), children };
    }
  }
}

/** Build the localized, platform-filtered menu spec sent to Rust. */
export function buildMenuSpec(
  target: Platform,
  t: T,
  bindings: Record<string, string>,
): SpecSection[] {
  return MENU_MODEL.map((section) => ({
    id: section.id,
    label: section.labelKey ? t(section.labelKey) : "",
    children: section.children
      .map((c) => toSpec(c, target, t, bindings))
      .filter((c): c is SpecNode => c !== null),
  }));
}
