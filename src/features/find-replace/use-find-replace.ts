import { replaceAll as crepeReplaceAll } from "@milkdown/kit/utils";
import { create } from "zustand";

import { getActiveEditor } from "@/editor/active-editor";
import { getSearchController } from "@/editor/editor-search";
import { selectActiveDocument, useDocuments } from "@/stores/document";

import {
  countMatches,
  findMatches,
  isInvalidRegex,
  replaceAllMatches,
  type FindMatch,
  type FindOptions,
} from "./find-utils";

interface FindReplaceState extends FindOptions {
  isOpen: boolean;
  showReplace: boolean;
  query: string;
  replacement: string;
  /**
   * Markdown matches of the current query/options. Drives the count and replace
   * only when no editor controller is mounted (tests / headless); otherwise the
   * live editor is the source of truth via `total`.
   */
  matches: FindMatch[];
  /** Total match count: from the active editor controller when mounted, else `matches.length`. */
  total: number;
  /** Index of the active match; -1 when there are none. */
  current: number;
  /** True when regex mode is on and the current query is not a valid expression. */
  invalidRegex: boolean;
  /**
   * How many matches the most recent replace action changed, surfaced as a
   * transient confirmation ("Replaced N · ⌘Z to undo"). `null` when there is
   * nothing to announce; cleared as soon as the query, options, replacement or
   * open state change so a stale count never lingers.
   */
  lastReplacement: number | null;
  open: (mode: "find" | "replace") => void;
  close: () => void;
  setQuery: (query: string) => void;
  setReplacement: (replacement: string) => void;
  setShowReplace: (showReplace: boolean) => void;
  toggleOption: (key: keyof FindOptions) => void;
  /** Recompute matches against the active document and clamp `current`. */
  recomputeMatches: () => void;
  /** Advance to the next match, wrapping around. */
  next: () => void;
  /** Step to the previous match, wrapping around. */
  prev: () => void;
}

function currentOptions(state: FindReplaceState): FindOptions {
  return {
    regex: state.regex,
    caseSensitive: state.caseSensitive,
    wholeWord: state.wholeWord,
  };
}

/**
 * Element focused right before the panel opened, restored on close so keyboard
 * users return to the editor instead of `<body>` (WCAG 2.2 focus management).
 * Module-level rather than reactive state — it never drives a render.
 */
let previousFocus: HTMLElement | null = null;

function captureFocusOrigin(): void {
  previousFocus =
    typeof document !== "undefined" && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
}

function restoreFocusOrigin(): void {
  const target = previousFocus;
  previousFocus = null;
  // Only if it's still in the document: when Find is opened from the command
  // palette, the palette (the focused element) unmounts, so there is nothing to
  // restore — leave focus where it landed rather than throw.
  if (target?.isConnected) target.focus();
}

export const useFindReplace = create<FindReplaceState>()((set, get) => ({
  isOpen: false,
  showReplace: false,
  query: "",
  replacement: "",
  regex: false,
  caseSensitive: false,
  wholeWord: false,
  matches: [],
  total: 0,
  current: -1,
  invalidRegex: false,
  lastReplacement: null,
  open: (mode) => {
    // Capture the focus origin only on a fresh open; re-triggering the shortcut
    // while open must not record the panel itself as the return target.
    if (!get().isOpen) captureFocusOrigin();
    set({ isOpen: true, showReplace: mode === "replace", lastReplacement: null });
    get().recomputeMatches();
  },
  close: () => {
    set({ isOpen: false, lastReplacement: null });
    getSearchController()?.clear();
    restoreFocusOrigin();
  },
  setQuery: (query) => {
    set({ query, lastReplacement: null });
    get().recomputeMatches();
  },
  setReplacement: (replacement) => set({ replacement, lastReplacement: null }),
  setShowReplace: (showReplace) => set({ showReplace }),
  toggleOption: (key) => {
    set((state) => ({ [key]: !state[key], lastReplacement: null }));
    get().recomputeMatches();
  },
  recomputeMatches: () => {
    const state = get();
    const options = currentOptions(state);
    const doc = selectActiveDocument(useDocuments.getState());
    const matches = doc ? findMatches(doc.markdown, state.query, options) : [];
    // While the panel is open, the live editor owns matching/highlighting so the
    // count and highlights reflect what the user actually sees; markdown matches
    // are the fallback (no editor mounted, e.g. tests).
    const controller = state.isOpen ? getSearchController() : null;
    const total = controller
      ? controller.search({ query: state.query, options }, state.current)
      : matches.length;
    // Keep the active match in range; default to the first when there are any.
    const current = total === 0 ? -1 : Math.min(Math.max(state.current, 0), total - 1);
    set({ matches, total, current, invalidRegex: isInvalidRegex(state.query, options) });
    if (controller) {
      if (current >= 0) controller.reveal(current);
      else controller.clear();
    }
  },
  next: () => {
    const { total, current } = get();
    if (total === 0) return;
    const next = (current + 1) % total;
    set({ current: next });
    getSearchController()?.reveal(next);
  },
  prev: () => {
    const { total, current } = get();
    if (total === 0) return;
    const prev = (current - 1 + total) % total;
    set({ current: prev });
    getSearchController()?.reveal(prev);
  },
}));

/**
 * Re-run the current search against the freshly-registered editor controller.
 * Called when the visible editor changes (mode switch / mount) so highlights and
 * scroll follow into the new view while the Find panel stays open.
 */
export function refreshActiveSearch(): void {
  if (useFindReplace.getState().isOpen) useFindReplace.getState().recomputeMatches();
}

/** Replace every match in the active document and push the result to the editor. */
export function replaceAllInActiveDocument(): void {
  const state = useFindReplace.getState();
  const controller = getSearchController();
  if (controller) {
    // The live editor owns the count while mounted; `total` mirrors what the
    // user sees, and replace-all changes exactly those matches.
    const count = state.total;
    controller.replaceAll(
      { query: state.query, options: currentOptions(state) },
      state.replacement,
    );
    useFindReplace.getState().recomputeMatches();
    if (count > 0) useFindReplace.setState({ lastReplacement: count });
    return;
  }

  const doc = selectActiveDocument(useDocuments.getState());
  if (!doc) return;

  const count = countMatches(doc.markdown, state.query, currentOptions(state));
  const next = replaceAllMatches(
    doc.markdown,
    state.query,
    state.replacement,
    currentOptions(state),
  );
  if (next === doc.markdown) return;

  useDocuments.getState().setMarkdown(doc.id, next);
  getActiveEditor()?.editor.action(crepeReplaceAll(next));
  useFindReplace.getState().recomputeMatches();
  if (count > 0) useFindReplace.setState({ lastReplacement: count });
}

/** Replace only the currently selected match and push the result to the editor. */
export function replaceCurrentInActiveDocument(): void {
  const state = useFindReplace.getState();
  const controller = getSearchController();
  if (controller) {
    const applied = controller.replaceCurrent(
      { query: state.query, options: currentOptions(state) },
      state.replacement,
    );
    useFindReplace.getState().recomputeMatches();
    if (applied) useFindReplace.setState({ lastReplacement: 1 });
    return;
  }

  const doc = selectActiveDocument(useDocuments.getState());
  if (!doc) return;

  const match = state.matches[state.current];
  if (!match) return;

  // Run the same replacement logic on just the matched slice so behaviour
  // matches Replace All: literal-`$` escaping in plain mode and group-ref
  // expansion (`$1`, `$2`, …) in regex mode. The slice is exactly one match,
  // so `replaceAllMatches` replaces that single occurrence.
  const start = match.index;
  const end = match.index + match.length;
  const slice = doc.markdown.slice(start, end);
  const replaced = replaceAllMatches(slice, state.query, state.replacement, currentOptions(state));
  const next = doc.markdown.slice(0, start) + replaced + doc.markdown.slice(end);
  if (next === doc.markdown) {
    useFindReplace.getState().recomputeMatches();
    return;
  }

  useDocuments.getState().setMarkdown(doc.id, next);
  getActiveEditor()?.editor.action(crepeReplaceAll(next));
  useFindReplace.getState().recomputeMatches();
  useFindReplace.setState({ lastReplacement: 1 });
}
