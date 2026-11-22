import { prosePluginsCtx } from "@milkdown/kit/core";
import type { Ctx } from "@milkdown/kit/ctx";
import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey, TextSelection } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet, type EditorView } from "@milkdown/kit/prose/view";

import { findMatches, replaceAllMatches, type FindMatch } from "@/features/find-replace/find-utils";

import { getActiveEditor } from "./active-editor";
import type { EditorSearchController, FindQuery } from "./editor-search";
import { viewFromCtx } from "./editor-view";

/** A match range in ProseMirror document coordinates. */
export interface PmRange {
  from: number;
  to: number;
}

/**
 * The visible text of a ProseMirror document, plus a map back to PM positions.
 *
 * Find operates on what the user sees (rendered text), not the markdown source,
 * so matches and the displayed count stay consistent with the highlights. The
 * doc's text nodes are concatenated; a `"\n"` separator is inserted between text
 * nodes that are not contiguous (block boundaries, inline atoms) so a match can
 * never silently span a gap.
 */
interface TextSegment {
  /** Index of this segment's first char within `SearchText.text`. */
  offset: number;
  /** PM position of this segment's first char. */
  from: number;
  /** Number of chars in this segment. */
  len: number;
}

export interface SearchText {
  text: string;
  segments: TextSegment[];
}

const SEPARATOR = "\n";

/** Build the searchable visible text + offset→PM-position map for a doc. */
export function buildSearchText(doc: ProseNode): SearchText {
  let text = "";
  const segments: TextSegment[] = [];
  let prevEnd = -1; // PM position just after the previous text node

  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      // A gap before this text node (different block, or an inline atom between
      // them) breaks contiguity — insert a separator so matches can't bridge it.
      if (segments.length > 0 && pos !== prevEnd) text += SEPARATOR;
      const offset = text.length;
      text += node.text;
      segments.push({ offset, from: pos, len: node.text.length });
      prevEnd = pos + node.text.length;
      return false; // text nodes have no children
    }
    return true;
  });

  return { text, segments };
}

/** PM position for a char-offset acting as a range START (inside a segment). */
function posForStart(segments: TextSegment[], offset: number): number | null {
  const seg = segments.find((s) => offset >= s.offset && offset < s.offset + s.len);
  return seg ? seg.from + (offset - seg.offset) : null;
}

/** PM position for a char-offset acting as a range END (one past a char). */
function posForEnd(segments: TextSegment[], offset: number): number | null {
  const seg = segments.find((s) => offset > s.offset && offset <= s.offset + s.len);
  return seg ? seg.from + (offset - seg.offset) : null;
}

/**
 * Map a string match to a PM range, or null when degenerate: zero-length, or
 * spanning a separator gap (in which case the PM span would be longer than the
 * matched text). Contiguous text nodes split only by marks map cleanly — PM's
 * inline decorations re-split across the mark boundaries on their own.
 */
export function mapMatchToPmRange(searchText: SearchText, match: FindMatch): PmRange | null {
  if (match.length <= 0) return null;
  const from = posForStart(searchText.segments, match.index);
  const to = posForEnd(searchText.segments, match.index + match.length);
  if (from == null || to == null) return null;
  if (to - from !== match.length) return null; // crossed a separator gap
  return { from, to };
}

/** Find every match in the doc's visible text as PM ranges (degenerate ones dropped). */
export function findPmMatches(doc: ProseNode, query: FindQuery): PmRange[] {
  const searchText = buildSearchText(doc);
  const matches = findMatches(searchText.text, query.query, query.options);
  const ranges: PmRange[] = [];
  for (const match of matches) {
    const range = mapMatchToPmRange(searchText, match);
    if (range) ranges.push(range);
  }
  return ranges;
}

// --- Decoration plugin -----------------------------------------------------

interface FindDecoState {
  deco: DecorationSet;
  current: number;
}

interface FindDecoMeta {
  ranges: PmRange[];
  current: number;
}

const findDecoKey = new PluginKey<FindDecoState>("asterisco-find-deco");

function buildDeco(doc: ProseNode, ranges: PmRange[], current: number): DecorationSet {
  const decos = ranges
    .filter((r) => r.to > r.from)
    .map((r, i) =>
      Decoration.inline(r.from, r.to, { class: i === current ? "find-current" : "find-match" }),
    );
  return DecorationSet.create(doc, decos);
}

function buildFindDecoPlugin(): Plugin<FindDecoState> {
  return new Plugin<FindDecoState>({
    key: findDecoKey,
    state: {
      init: () => ({ deco: DecorationSet.empty, current: -1 }),
      apply(tr, value) {
        const meta = tr.getMeta(findDecoKey) as FindDecoMeta | undefined;
        if (meta) {
          return { deco: buildDeco(tr.doc, meta.ranges, meta.current), current: meta.current };
        }
        // No new search this transaction: keep highlights pinned to the text as
        // it shifts under live edits between recomputes.
        if (tr.docChanged) {
          return { deco: value.deco.map(tr.mapping, tr.doc), current: value.current };
        }
        return value;
      },
    },
    props: {
      decorations(state) {
        return findDecoKey.getState(state)?.deco ?? null;
      },
    },
  });
}

/** Register the find-highlight decoration plugin on the editor (call before create). */
export function registerFindDecorations(ctx: Ctx): void {
  ctx.update(prosePluginsCtx, (plugins) => plugins.concat(buildFindDecoPlugin()));
}

// --- Controller ------------------------------------------------------------

/**
 * Find controller for the WYSIWYG (Crepe/ProseMirror) view. Stateless about the
 * view itself — every method re-reads it through the active editor, so it keeps
 * working across Crepe re-renders and source-mode round-trips.
 */
export function createWysiwygSearchController(): EditorSearchController {
  let ranges: PmRange[] = [];

  function withView<T>(fn: (view: EditorView) => T, fallback: T): T {
    const editor = getActiveEditor();
    if (!editor) return fallback;
    let result = fallback;
    editor.editor.action((ctx) => {
      const view = viewFromCtx(ctx);
      if (!view?.state) return;
      result = fn(view);
    });
    return result;
  }

  return {
    search(query, current) {
      return withView((view) => {
        ranges = findPmMatches(view.state.doc, query);
        view.dispatch(view.state.tr.setMeta(findDecoKey, { ranges, current }));
        return ranges.length;
      }, 0);
    },
    reveal(index) {
      withView((view) => {
        const range = ranges[index];
        if (!range) return;
        const selection = TextSelection.create(view.state.doc, range.from, range.to);
        view.dispatch(
          view.state.tr.setSelection(selection).setMeta(findDecoKey, { ranges, current: index }),
        );
        // Scroll the highlighted match into view ourselves rather than via the
        // transaction's `scrollIntoView()`. ProseMirror scrolls relative to the
        // DOM selection's focus node, but while the user is typing in the Find
        // panel the focus (and DOM selection) lives in that input — outside the
        // editor — so PM walks the wrong DOM branch and never scrolls the editor
        // view. Scrolling the current decoration element is focus-independent.
        view.dom.querySelector(".find-current")?.scrollIntoView({
          block: "center",
          inline: "nearest",
        });
      }, undefined);
    },
    clear() {
      ranges = [];
      withView((view) => {
        view.dispatch(view.state.tr.setMeta(findDecoKey, { ranges: [], current: -1 }));
      }, undefined);
    },
    replaceCurrent(query, replacement) {
      return withView((view) => {
        const fresh = findPmMatches(view.state.doc, query);
        const { from, to } = view.state.selection;
        const target = fresh.find((r) => r.from === from && r.to === to);
        if (!target) return false;
        const slice = view.state.doc.textBetween(target.from, target.to);
        const replaced = replaceAllMatches(slice, query.query, replacement, query.options);
        view.dispatch(view.state.tr.insertText(replaced, target.from, target.to));
        return true;
      }, false);
    },
    replaceAll(query, replacement) {
      withView((view) => {
        const fresh = findPmMatches(view.state.doc, query);
        if (fresh.length === 0) return;
        let tr = view.state.tr;
        // Back-to-front: edits at higher positions don't shift the lower ones.
        for (let i = fresh.length - 1; i >= 0; i--) {
          const range = fresh[i];
          if (!range) continue;
          const slice = view.state.doc.textBetween(range.from, range.to);
          const replaced = replaceAllMatches(slice, query.query, replacement, query.options);
          tr = tr.insertText(replaced, range.from, range.to);
        }
        view.dispatch(tr);
      }, undefined);
    },
  };
}
