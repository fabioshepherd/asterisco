import { COMMANDS, type CommandId } from "@/app/menu/commands";
import {
  MENU_MODEL,
  type MenuNode,
  type Platform,
  type PredefinedRole,
} from "@/app/menu/menu-model";
import { currentPlatform } from "@/app/platform";
import { FORMAT_COMMAND_HINTS, milkdownToAppCombo } from "@/editor/formatting-keymap";

import { FIXED_SHORTCUTS, type FixedShortcutLabelKey } from "./fixed-shortcuts";

/**
 * Combos something else already owns, per platform.
 *
 * Three owners, for the same reason. A platform menu role wins before the keymap
 * ever sees the keystroke, a Format command's key (Bold, Heading 1–6, …) is the
 * editor's on every platform (a native key-equivalent on macOS, the Milkdown
 * keymap elsewhere), and a fixed app shortcut (`fixed-shortcuts.ts`) is
 * consulted after the keymap but implements a gesture the keymap cannot hold —
 * either way a binding recorded onto one of these is stored, persisted,
 * exported, and then never fires. The recorder refuses them and names the owner
 * instead of failing silently.
 *
 * Combos are normalized to the same shape `eventToCombo` produces (`mod`, then
 * `alt`, then `shift`, then the key), which is the contract that lets the two
 * sets be compared at all; `reserved-combos.test.ts` pins it.
 */
/**
 * Accelerators the platform attaches to predefined roles. These carry no
 * accelerator in the menu model — the platform supplies both the label and the
 * key — so the ones that would collide with an in-app binding are listed here.
 *
 * The edit roles' keys belong to the text surfaces everywhere. Minimize and Hide
 * are keys only where the OS menu registers them (`macOnly`): off macOS nothing
 * listens for Ctrl+M or Ctrl+H, so a user may bind them.
 *
 * The File/app commands are not here: their combos are keymap bindings
 * (`KEY_ACTIONS`), so the recorder treats them as an action conflict it can
 * reassign, not as a reserved key.
 */
const PREDEFINED_ACCELERATORS = {
  undo: { combo: "mod+z", labelKey: "edit.undo" },
  redo: { combo: "mod+shift+z", labelKey: "edit.redo" },
  cut: { combo: "mod+x", labelKey: "edit.cut" },
  copy: { combo: "mod+c", labelKey: "edit.copy" },
  paste: { combo: "mod+v", labelKey: "edit.paste" },
  selectAll: { combo: "mod+a", labelKey: "edit.selectAll" },
  minimize: { combo: "mod+m", labelKey: "window.controls.minimize", macOnly: true },
  hide: { combo: "mod+h", labelKey: "app.hide", macOnly: true },
} as const satisfies Partial<
  Record<PredefinedRole, { combo: string; labelKey: string; macOnly?: true }>
>;

/**
 * Every `menu`-namespace key a reserved combo can point at, kept literal so the
 * conflict message can be translated without a cast.
 */
export type MenuLabelKey =
  | (typeof COMMANDS)[CommandId]["labelKey"]
  | (typeof PREDEFINED_ACCELERATORS)[keyof typeof PREDEFINED_ACCELERATORS]["labelKey"];

/**
 * A claimed combo and who claims it. `owner` picks the i18n namespace its
 * `labelKey` belongs to, so the refusal message can name either kind of owner.
 */
export type ReservedCombo =
  | { combo: string; owner: "menu"; labelKey: MenuLabelKey }
  | { combo: string; owner: "app"; labelKey: FixedShortcutLabelKey };

function collect(nodes: readonly MenuNode[], platform: Platform, out: ReservedCombo[]): void {
  for (const node of nodes) {
    if (node.kind === "submenu") {
      collect(node.children, platform, out);
    } else if (node.kind === "predefined") {
      if (node.platforms && !node.platforms.includes(platform)) continue;
      // Most roles carry no accelerator worth reserving (about, services, …).
      const reserved =
        node.role in PREDEFINED_ACCELERATORS
          ? PREDEFINED_ACCELERATORS[node.role as keyof typeof PREDEFINED_ACCELERATORS]
          : undefined;
      if (!reserved || ("macOnly" in reserved && platform !== "mac")) continue;
      out.push({ combo: reserved.combo, labelKey: reserved.labelKey, owner: "menu" });
    }
  }
}

/** Every claimed combo on `platform`, derived from the registries so it cannot drift. */
export function reservedCombos(platform: Platform): ReservedCombo[] {
  const out: ReservedCombo[] = [];
  for (const section of MENU_MODEL) collect(section.children, platform, out);
  for (const [id, combo] of Object.entries(FORMAT_COMMAND_HINTS)) {
    const command = COMMANDS[id as CommandId];
    out.push({ combo: milkdownToAppCombo(combo), owner: "menu", labelKey: command.labelKey });
  }
  for (const shortcut of FIXED_SHORTCUTS) {
    for (const combo of shortcut.combos) {
      out.push({ combo, owner: "app", labelKey: shortcut.labelKey });
    }
  }
  return out;
}

/** The menu item or fixed shortcut that owns a combo on `platform`, if any. */
export function reservedForCombo(
  combo: string,
  platform: Platform = currentPlatform(),
): ReservedCombo | undefined {
  return reservedCombos(platform).find((entry) => entry.combo === combo);
}

/**
 * Persisted bindings minus any whose combo something else now owns.
 *
 * The recorder refuses reserved combos, but a binding recorded before something
 * claimed its combo is already on disk: it would never fire, or fire alongside
 * the owner. Dropping it on load lets the action fall back to its default, which
 * `reserved-combos.test.ts` keeps free of every reserved combo.
 */
export function withoutReservedCombos(
  bindings: Record<string, string>,
  platform: Platform = currentPlatform(),
): Record<string, string> {
  const reserved = new Set(reservedCombos(platform).map((entry) => entry.combo));
  return Object.fromEntries(Object.entries(bindings).filter(([, combo]) => !reserved.has(combo)));
}
