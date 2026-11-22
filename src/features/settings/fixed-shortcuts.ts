/**
 * Shortcuts the app owns and does not let the user remap.
 *
 * Three sets of keys exist in this app, and this is the third. `keybindings.ts`
 * holds everything remappable; the native menu owns its accelerators
 * (`reserved-combos.ts`); and these are the gestures the frontend implements
 * directly, because the keymap cannot express them — its dispatcher fires one
 * action per keystroke, and `Ctrl+Tab` needs a whole press-hold-release walk to
 * know when it ended.
 *
 * They are declared here so the two surfaces that need them cannot drift apart:
 * the settings list prints them, so they are discoverable at all, and the
 * shortcut recorder refuses them, so nobody records a binding that would be
 * shadowed by one of these and then never fire.
 */

export interface FixedShortcut {
  /** Translation key under `editor.shortcuts.fixed.*`. */
  labelKey: string;
  /** Every combo it owns, in `eventToCombo`'s shape. */
  combos: readonly string[];
}

/** Declaration order is display order. */
export const FIXED_SHORTCUTS = [
  { labelKey: "cycleRecent", combos: ["mod+tab"] },
  { labelKey: "cycleRecentBack", combos: ["mod+shift+tab"] },
] as const satisfies readonly FixedShortcut[];

/** A single entry of {@link FIXED_SHORTCUTS}, with its literal ids preserved. */
export type FixedShortcutDef = (typeof FIXED_SHORTCUTS)[number];

/** Every `shortcuts.fixed.*` key a reserved combo can point at, kept literal. */
export type FixedShortcutLabelKey = FixedShortcutDef["labelKey"];
