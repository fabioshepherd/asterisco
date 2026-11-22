import { create } from "zustand";

import type { CommandId } from "@/app/menu/commands";
import { FORMAT_COMMAND_HINTS, milkdownToAppCombo } from "@/editor/formatting-keymap";

/**
 * Customizable keyboard shortcuts. Each one names the `COMMANDS` entry it runs,
 * so a key, the menu and the palette share one body. File/app ones included: on
 * macOS the native menu registers those as its key-equivalents (`keyEquivalent`
 * in the menu model), elsewhere the window handler in `use-global-shortcuts`
 * dispatches every binding. A combo is a normalized string like "mod+shift+k",
 * where `mod` is Cmd on macOS and Ctrl elsewhere.
 */

/**
 * Section a shortcut belongs to. Fourteen rows in one flat scroll is a list to
 * search, not a list to read; the groups are what turn it back into a reference.
 */
export type KeyActionGroup = "file" | "navigate" | "view" | "app";

export interface KeyAction {
  /** Persisted in `keybindings`: never rename one. */
  id: string;
  /** Translation key under `editor.shortcuts.actions.*`. */
  labelKey: string;
  group: KeyActionGroup;
  defaultCombo: string;
  /** The command this shortcut runs. */
  command: CommandId;
}

/** One keymap entry; its label key is its id. Literal types are kept (see below). */
function keyAction<const Id extends string, const Group extends KeyActionGroup>(
  id: Id,
  group: Group,
  defaultCombo: string,
  command: CommandId,
) {
  return { id, labelKey: id, group, defaultCombo, command };
}

/**
 * Declaration order is display order; keep each group contiguous.
 *
 * `as const satisfies` rather than a widening annotation: it keeps `id`,
 * `labelKey` and `group` as literals, so `t("shortcuts.actions." + labelKey)`
 * typechecks against the generated resource keys. That is what lets the labels
 * be *derived* here — a hand-written label map is how one row ended up
 * rendering its raw identifier.
 */
export const KEY_ACTIONS = [
  keyAction("newFile", "file", "mod+n", "new-file"),
  keyAction("openFile", "file", "mod+o", "open-file"),
  keyAction("openFolder", "file", "mod+shift+o", "open-folder"),
  keyAction("save", "file", "mod+s", "save-file"),
  keyAction("saveAs", "file", "mod+shift+s", "save-file-as"),
  keyAction("print", "file", "mod+p", "print"),
  keyAction("closeTab", "file", "mod+w", "close"),
  keyAction("commandPalette", "navigate", "mod+shift+p", "command-palette"),
  keyAction("find", "navigate", "mod+f", "find"),
  keyAction("searchWorkspace", "navigate", "mod+shift+f", "search-workspace"),
  // Showing the panel and being *in* it are different things: the sidebar
  // toggle leaves the caret in the document, so the tree was reachable only by
  // walking Tab through the chrome.
  keyAction("focusFileTree", "navigate", "mod+shift+e", "focus-file-tree"),
  keyAction("moveTabLeft", "navigate", "mod+shift+pageup", "move-tab-left"),
  keyAction("moveTabRight", "navigate", "mod+shift+pagedown", "move-tab-right"),
  keyAction("sourceMode", "view", "mod+/", "source-mode"),
  keyAction("readingMode", "view", "mod+shift+r", "reading-mode"),
  keyAction("distractionFree", "view", "mod+shift+enter", "distraction-free"),
  keyAction("outline", "view", "mod+shift+k", "toggle-outline"),
  keyAction("sidebar", "view", "mod+shift+l", "toggle-sidebar"),
  keyAction("settings", "app", "mod+comma", "settings"),
  // Unbound by default: a stray chord must not silently flip auto-save from
  // anywhere. The status bar and the palette toggle it; a user may bind it here.
  keyAction("toggleAutoSave", "app", "", "toggle-auto-save"),
  keyAction("quit", "app", "mod+q", "quit"),
] as const satisfies readonly KeyAction[];

/** A single entry of {@link KEY_ACTIONS}, with its literal ids preserved. */
export type KeyActionDef = (typeof KEY_ACTIONS)[number];

const ACTION_BY_ID = new Map<string, KeyActionDef>(
  KEY_ACTIONS.map((action) => [action.id, action]),
);

/**
 * Former defaults that were retired. Every binding is persisted, defaults
 * included, so a stored combo equal to its retired default is dropped on
 * hydrate (falling back to the current default) — a user-chosen combo stays.
 */
const RETIRED_DEFAULTS: Readonly<Record<string, string>> = { toggleAutoSave: "mod+shift+a" };

function defaultBindings(): Record<string, string> {
  return Object.fromEntries(KEY_ACTIONS.map((action) => [action.id, action.defaultCombo]));
}

/** Normalize a keyboard event into a combo string, or null for modifier-only. */
export function eventToCombo(event: KeyboardEvent): string | null {
  const key = event.key.toLowerCase();
  if (["control", "meta", "alt", "shift"].includes(key)) return null;
  const parts: string[] = [];
  if (event.metaKey || event.ctrlKey) parts.push("mod");
  if (event.altKey) parts.push("alt");
  if (event.shiftKey) parts.push("shift");
  const normalized = key === " " ? "space" : key === "," ? "comma" : key;
  parts.push(normalized);
  return parts.join("+");
}

const IS_MAC = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);

/** Human-readable combo, e.g. "⌘⇧K" on macOS or "Ctrl+Shift+K" elsewhere. */
export function formatCombo(combo: string): string {
  const labels: Record<string, string> = {
    mod: IS_MAC ? "⌘" : "Ctrl",
    shift: IS_MAC ? "⇧" : "Shift",
    alt: IS_MAC ? "⌥" : "Alt",
    comma: ",",
    space: "Space",
    tab: "Tab",
    enter: IS_MAC ? "↵" : "Enter",
  };
  const join = IS_MAC ? "" : "+";
  return combo
    .split("+")
    .map((part) => labels[part] ?? part.toUpperCase())
    .join(join);
}

interface KeybindingsState {
  bindings: Record<string, string>;
  setBinding: (actionId: string, combo: string) => void;
  /** Leave an action unbound — used when a combo is reassigned away from it. */
  clearBinding: (actionId: string) => void;
  resetBinding: (actionId: string) => void;
  resetAll: () => void;
  hydrate: (bindings: Record<string, string>) => void;
}

export const useKeybindings = create<KeybindingsState>()((set) => ({
  bindings: defaultBindings(),
  setBinding: (actionId, combo) =>
    set((state) => ({ bindings: { ...state.bindings, [actionId]: combo } })),
  clearBinding: (actionId) => set((state) => ({ bindings: { ...state.bindings, [actionId]: "" } })),
  resetBinding: (actionId) =>
    set((state) => ({
      bindings: { ...state.bindings, [actionId]: ACTION_BY_ID.get(actionId)?.defaultCombo ?? "" },
    })),
  resetAll: () => set({ bindings: defaultBindings() }),
  // Persisted ids of actions that no longer exist (e.g. the removed `splitEditor`)
  // are dropped, so a stale combo can neither linger nor shadow a live action;
  // so is a stored combo that is only a retired default (see RETIRED_DEFAULTS).
  hydrate: (bindings) =>
    set((state) => ({
      bindings: {
        ...state.bindings,
        ...Object.fromEntries(
          Object.entries(bindings).filter(
            ([id, combo]) => ACTION_BY_ID.has(id) && RETIRED_DEFAULTS[id] !== combo,
          ),
        ),
      },
    })),
}));

/**
 * The combo that runs a command, for every surface that prints one (menubar,
 * native menu, palette): its editor Format key, else its keymap binding.
 */
export function commandCombo(
  command: string,
  bindings: Record<string, string>,
): string | undefined {
  const format = FORMAT_COMMAND_HINTS[command];
  if (format) return milkdownToAppCombo(format);
  const action = KEY_ACTIONS.find((entry) => entry.command === command);
  return (action && bindings[action.id]) || undefined;
}

/** Find the action bound to a combo (the first match), if any. */
export function actionForCombo(combo: string): KeyActionDef | undefined {
  // An unbound action stores "", which must never be matched by a real keystroke.
  if (!combo) return undefined;
  const { bindings } = useKeybindings.getState();
  const id = Object.keys(bindings).find((actionId) => bindings[actionId] === combo);
  return id ? ACTION_BY_ID.get(id) : undefined;
}
