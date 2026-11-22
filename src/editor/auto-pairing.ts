/**
 * Auto-pairing: as the user types an opening character, insert its closing
 * partner and keep the caret between them — markdown-aware so it never fights
 * apostrophes or raw-text contexts. The
 * keystroke→action decision is the pure `decideInput` function; the ProseMirror
 * `$prose` plugin below is a thin adapter over it. Scope: brackets, backtick,
 * and quotes. `*` and `_` are intentionally excluded (handled by Crepe's
 * emphasis input rules).
 */
import type { ResolvedPos } from "@milkdown/kit/prose/model";
import { Plugin, TextSelection, type EditorState } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";

import { useSettings } from "@/stores/settings";

import { isRawTextContext } from "./editor-view";
import { LINK_MARKDOWN_RE } from "./link-input-rule";

/** Bracket openers → their closer. Quotes/backtick are resolved separately. */
const BRACKETS: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
const BRACKET_CLOSERS = new Set([")", "]", "}"]);

/** Every glyph that counts as "a closing character" for the suppression gate. */
const CLOSE_CHARS = new Set([")", "]", "}", '"', "'", "`", "”", "’"]);

/** Glyph sets per quote kind, used for type-over (matches curly or straight). */
const DOUBLE_GLYPHS = new Set(['"', "“", "”"]);
const SINGLE_GLYPHS = new Set(["'", "‘", "’"]);

/** All valid empty-pair (before, after) combinations, for Backspace deletion. */
const EMPTY_PAIRS = new Set(["()", "[]", "{}", "``", '""', "''", "“”", "‘’"]);

export interface InputContext {
  /** The single character just typed. */
  char: string;
  /** Character immediately before the caret, or null at block start. */
  charBefore: string | null;
  /** Character immediately after the caret, or null at block end. */
  charAfter: string | null;
  /** Whether there is a non-empty selection to wrap. */
  hasSelection: boolean;
}

export type PairAction =
  | { kind: "none" }
  | { kind: "typeOver" }
  | { kind: "pair"; open: string; close: string }
  | { kind: "wrap"; open: string; close: string };

/** True when the caret sits where a NEW quote/bracket should open. */
function isOpeningContext(charBefore: string | null): boolean {
  return charBefore === null || /[\s([{]/.test(charBefore);
}

/** True when auto-close is allowed before `charAfter` (VS Code-style gate). */
function pairAllowedAfter(charAfter: string | null): boolean {
  return charAfter === null || /\s/.test(charAfter) || CLOSE_CHARS.has(charAfter);
}

/** Decide what auto-pairing should do for a single typed character. Pure. */
export function decideInput(ctx: InputContext): PairAction {
  const { char, charBefore, charAfter, hasSelection } = ctx;

  // Closing brackets: only ever type over a matching closer.
  if (BRACKET_CLOSERS.has(char)) {
    return !hasSelection && charAfter === char ? { kind: "typeOver" } : { kind: "none" };
  }

  // Opening brackets.
  const close = BRACKETS[char];
  if (close !== undefined) {
    if (hasSelection) return { kind: "wrap", open: char, close };
    return pairAllowedAfter(charAfter) ? { kind: "pair", open: char, close } : { kind: "none" };
  }

  // Backtick (self-pairing).
  if (char === "`") {
    if (!hasSelection && charAfter === "`") return { kind: "typeOver" };
    if (hasSelection) return { kind: "wrap", open: "`", close: "`" };
    return pairAllowedAfter(charAfter) ? { kind: "pair", open: "`", close: "`" } : { kind: "none" };
  }

  // Double quotes (always pair at an empty caret).
  if (char === '"') {
    const open = '"';
    const close = '"';
    if (!hasSelection && charAfter !== null && DOUBLE_GLYPHS.has(charAfter)) {
      return { kind: "typeOver" };
    }
    if (hasSelection) return { kind: "wrap", open, close };
    return { kind: "pair", open, close };
  }

  // Single quotes (context-aware: pair only in opening position).
  if (char === "'") {
    const open = "'";
    const close = "'";
    if (!hasSelection && charAfter !== null && SINGLE_GLYPHS.has(charAfter)) {
      return { kind: "typeOver" };
    }
    if (hasSelection) return { kind: "wrap", open, close };
    return isOpeningContext(charBefore) ? { kind: "pair", open, close } : { kind: "none" };
  }

  return { kind: "none" };
}

/** True when (before, after) form an auto-inserted empty pair (for Backspace). */
export function isEmptyPair(before: string | null, after: string | null): boolean {
  if (before === null || after === null) return false;
  return EMPTY_PAIRS.has(before + after);
}

/**
 * Char immediately before `$pos` within its textblock, or null at block start.
 * An empty `textBetween` (the neighbour is a non-text inline atom — image, inline
 * math, hard-break) also maps to null, so an adjacent atom reads like a block
 * edge rather than the contract-violating empty string.
 */
function charBeforeCaret($pos: ResolvedPos): string | null {
  if ($pos.parentOffset === 0) return null;
  const char = $pos.parent.textBetween($pos.parentOffset - 1, $pos.parentOffset);
  return char === "" ? null : char;
}

/** Char immediately after `$pos` within its textblock, or null at block end. */
function charAfterCaret($pos: ResolvedPos): string | null {
  if ($pos.parentOffset === $pos.parent.content.size) return null;
  const char = $pos.parent.textBetween($pos.parentOffset, $pos.parentOffset + 1);
  return char === "" ? null : char;
}

/**
 * When the caret sits just before an auto-paired closing `` ` `` or `)` and the
 * user types that same closer, a plain type-over would move the caret past it —
 * but that swallows the keystroke the commonmark inline-code rule and our link
 * input rule need to fire, leaving `` `code` `` / `[text](url)` as literal text.
 * So before typing over, try to complete the markdown token spanning up to the
 * closer (which is already in the doc at `[from, from+1]`) and apply the real
 * mark. Returns the transaction to dispatch, or null to fall back to type-over.
 */
function completeInlineToken(state: EditorState, text: string, from: number) {
  const end = from + 1; // include the closer being typed over
  const blockStart = state.doc.resolve(from).start();
  if (blockStart >= end) return null;
  const before = state.doc.textBetween(blockStart, end);

  const applyMark = (
    pattern: RegExp,
    markName: string,
    hrefFrom?: (m: RegExpExecArray) => string | undefined,
  ) => {
    const match = pattern.exec(before);
    const label = match?.[1];
    if (!match || label == null) return null;
    const markType = state.schema.marks[markName];
    if (!markType) return null;
    let attrs: { href: string } | undefined;
    if (hrefFrom) {
      const href = hrefFrom(match);
      if (href == null) return null;
      attrs = { href };
    }
    const start = end - match[0].length;
    // Positions == chars only when the matched span is plain text; bail if an
    // inline atom (image, math) sits inside it and would shift the offsets.
    if (start < blockStart || state.doc.textBetween(start, end) !== match[0]) return null;
    return state.tr
      .replaceWith(start, end, state.schema.text(label, [markType.create(attrs)]))
      .removeStoredMark(markType);
  };

  if (text === "`") return applyMark(/`([^`]+)`$/, "inlineCode");
  if (text === ")") return applyMark(LINK_MARKDOWN_RE, "link", (m) => m[2]);
  return null;
}

function handleTextInput(view: EditorView, from: number, to: number, text: string): boolean {
  if (!useSettings.getState().autoPairing) return false;
  if (text.length !== 1 || view.composing) return false;
  const { state } = view;
  if (isRawTextContext(state)) return false;

  // Resolve once from the handler's `from`, so the context that drives the
  // decision and the positions that drive the dispatched transaction share a
  // single source of truth (these can diverge from `state.selection` on
  // ProseMirror's DOM-flush input path). For a collapsed caret from === to.
  const $from = state.doc.resolve(from);
  const action = decideInput({
    char: text,
    charBefore: charBeforeCaret($from),
    charAfter: charAfterCaret($from),
    hasSelection: from !== to,
  });

  switch (action.kind) {
    case "none":
      return false;
    case "typeOver": {
      const completed = completeInlineToken(state, text, from);
      if (completed) {
        view.dispatch(completed.scrollIntoView());
        return true;
      }
      const tr = state.tr.setSelection(TextSelection.create(state.doc, to + 1));
      view.dispatch(tr.scrollIntoView());
      return true;
    }
    case "pair": {
      const tr = state.tr.insertText(action.open + action.close, from, to);
      tr.setSelection(TextSelection.create(tr.doc, from + action.open.length));
      view.dispatch(tr.scrollIntoView());
      return true;
    }
    case "wrap": {
      // Cross-block guard: a selection that spans two different textblocks would
      // land the open/close glyphs in different parents, producing a malformed
      // transaction. Bail out and let ProseMirror handle the keystroke normally.
      if (!$from.sameParent(state.doc.resolve(to))) return false;
      // Insert close at the end first, then open at the start (back-to-front so
      // positions stay valid), and reselect the wrapped inner text.
      const tr = state.tr.insertText(action.close, to, to);
      tr.insertText(action.open, from, from);
      tr.setSelection(
        TextSelection.create(tr.doc, from + action.open.length, to + action.open.length),
      );
      view.dispatch(tr.scrollIntoView());
      return true;
    }
  }
}

function handleKeyDown(view: EditorView, event: KeyboardEvent): boolean {
  if (event.key !== "Backspace") return false;
  if (!useSettings.getState().autoPairing) return false;
  const { state } = view;
  const { $from, empty, from } = state.selection;
  if (!empty || isRawTextContext(state)) return false;
  if (!isEmptyPair(charBeforeCaret($from), charAfterCaret($from))) return false;
  const tr = state.tr.delete(from - 1, from + 1);
  view.dispatch(tr);
  return true;
}

/**
 * Auto-pairing ProseMirror plugin. Lives at the PM level so it only fires in the
 * WYSIWYG editor (source mode is a separate CodeMirror instance). The setting is
 * read live in the handlers so toggling it takes effect without a remount.
 */
export const autoPairingPlugin = $prose(
  () => new Plugin({ props: { handleTextInput, handleKeyDown } }),
);
