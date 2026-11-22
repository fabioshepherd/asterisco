import type { Ctx } from "@milkdown/kit/ctx";
import { commandsCtx } from "@milkdown/kit/core";
import { toggleLinkCommand } from "@milkdown/kit/component/link-tooltip";
import { headingKeymap, paragraphKeymap } from "@milkdown/kit/preset/commonmark";
import { strikethroughKeymap } from "@milkdown/kit/preset/gfm";
import { $useKeymap } from "@milkdown/kit/utils";

import { runInsertFootnote } from "./footnotes";

/**
 * Formatting keyboard shortcuts as Milkdown keymap overrides. These live at the
 * ProseMirror level so they only fire when the WYSIWYG editor has focus (source
 * mode and code blocks own their own keys). FORMAT_KEYMAP is the single source
 * of truth for the shortcut strings; the palette hint map derives from it.
 */
export const FORMAT_KEYMAP = {
  heading: ["Mod-1", "Mod-2", "Mod-3", "Mod-4", "Mod-5", "Mod-6"],
  paragraph: "Mod-0",
  strikethrough: "Mod-Shift-x",
  link: "Mod-k",
  footnote: "Mod-Alt-f",
} as const;

/** "Mod-Shift-x" -> "mod+shift+x" (the notation used by formatCombo). */
export function milkdownToAppCombo(combo: string): string {
  return combo.toLowerCase().replace(/-/g, "+");
}

/**
 * Milkdown combos for each Format command, keyed by its `COMMANDS` id. The
 * native menu and palette append these as display-only hints (the real binding
 * lives in the keymap above — a native accelerator would double-fire / fire in
 * code blocks). Bold/italic/code keep Milkdown's commonmark preset defaults.
 */
export const FORMAT_COMMAND_HINTS: Record<string, string> = {
  "format-bold": "Mod-b",
  "format-italic": "Mod-i",
  "format-code": "Mod-e",
  "format-strikethrough": FORMAT_KEYMAP.strikethrough,
  "format-link": FORMAT_KEYMAP.link,
  "format-h1": FORMAT_KEYMAP.heading[0],
  "format-h2": FORMAT_KEYMAP.heading[1],
  "format-h3": FORMAT_KEYMAP.heading[2],
  "format-h4": FORMAT_KEYMAP.heading[3],
  "format-h5": FORMAT_KEYMAP.heading[4],
  "format-h6": FORMAT_KEYMAP.heading[5],
  "format-paragraph": FORMAT_KEYMAP.paragraph,
  "format-footnote": FORMAT_KEYMAP.footnote,
};

/**
 * Override the preset keymaps in place. `ctx.set` replaces the whole config
 * object, so every entry must be listed — notably DowngradeHeading, which keeps
 * Delete/Backspace downgrading a heading. Run inside crepe.editor.config().
 *
 * When `disabled` is true (macOS) the mark/heading/paragraph combos are cleared
 * (`[]`): the native Format menu owns those key-equivalents there, so a webview
 * keymap would double-fire. Clearing them also removes Milkdown's default
 * `Mod-Alt-…` heading bindings. DowngradeHeading (Backspace/Delete) always stays.
 */
export function configFormattingShortcuts(ctx: Ctx, disabled = false): void {
  const [h1, h2, h3, h4, h5, h6] = FORMAT_KEYMAP.heading;
  ctx.set(headingKeymap.key, {
    TurnIntoH1: { shortcuts: disabled ? [] : h1 },
    TurnIntoH2: { shortcuts: disabled ? [] : h2 },
    TurnIntoH3: { shortcuts: disabled ? [] : h3 },
    TurnIntoH4: { shortcuts: disabled ? [] : h4 },
    TurnIntoH5: { shortcuts: disabled ? [] : h5 },
    TurnIntoH6: { shortcuts: disabled ? [] : h6 },
    DowngradeHeading: { shortcuts: ["Delete", "Backspace"] },
  });
  ctx.set(paragraphKeymap.key, {
    TurnIntoText: { shortcuts: disabled ? [] : FORMAT_KEYMAP.paragraph },
  });
  ctx.set(strikethroughKeymap.key, {
    ToggleStrikethrough: { shortcuts: disabled ? [] : FORMAT_KEYMAP.strikethrough },
  });
}

/**
 * New keymap: Cmd/Ctrl+K toggles a link via the link-tooltip command, which
 * wraps the selection and opens the href editor (or unlinks if already linked).
 */
export const linkShortcutKeymap = $useKeymap("formatLink", {
  ToggleLink: {
    shortcuts: FORMAT_KEYMAP.link,
    command: (ctx: Ctx) => () => ctx.get(commandsCtx).call(toggleLinkCommand.key),
  },
});

/**
 * New keymap: Cmd/Ctrl+Alt+F inserts a footnote (a `footnote_reference` at the
 * caret + an empty `footnote_definition` at the end, with the caret moved into
 * it). The action is guarded inside `runInsertFootnote`, mirroring linkShortcutKeymap.
 */
export const footnoteKeymap = $useKeymap("insertFootnote", {
  InsertFootnote: {
    shortcuts: FORMAT_KEYMAP.footnote,
    command: () => () => {
      runInsertFootnote();
      return true;
    },
  },
});
