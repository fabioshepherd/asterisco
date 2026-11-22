import { RangeSetBuilder, StateEffect, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView } from "@codemirror/view";

import { findMatches, replaceAllMatches, type FindMatch } from "@/features/find-replace/find-utils";

import type { EditorSearchController, FindQuery } from "./editor-search";

/** Effect carrying the current match set + active index into the decoration field. */
const setFindMatches = StateEffect.define<{ matches: FindMatch[]; current: number }>();

/** Build the highlight decorations for a match set (current marked distinctly). */
export function buildCmDecorations(matches: FindMatch[], current: number): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  matches.forEach((match, i) => {
    if (match.length <= 0) return; // zero-length ranges aren't valid decorations
    builder.add(
      match.index,
      match.index + match.length,
      Decoration.mark({ class: i === current ? "cm-find-current" : "cm-find-match" }),
    );
  });
  return builder.finish();
}

/** Decoration field holding the find highlights, surviving edits via `map`. */
export const findField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(setFindMatches))
        deco = buildCmDecorations(effect.value.matches, effect.value.current);
    }
    return deco;
  },
  provide: (field) => EditorView.decorations.from(field),
});

function nonEmptyMatches(view: EditorView, query: FindQuery): FindMatch[] {
  return findMatches(view.state.doc.toString(), query.query, query.options).filter(
    (match) => match.length > 0,
  );
}

/**
 * Find controller for source mode (CodeMirror). The CM document text is the
 * markdown verbatim, so string offsets map straight to CM positions.
 */
export function createSourceSearchController(view: EditorView): EditorSearchController {
  let matches: FindMatch[] = [];

  return {
    search(query, current) {
      matches = nonEmptyMatches(view, query);
      view.dispatch({ effects: setFindMatches.of({ matches, current }) });
      return matches.length;
    },
    reveal(index) {
      const match = matches[index];
      if (!match) return;
      const from = match.index;
      const to = match.index + match.length;
      view.dispatch({
        selection: { anchor: from, head: to },
        effects: [
          setFindMatches.of({ matches, current: index }),
          EditorView.scrollIntoView(from, { y: "center" }),
        ],
      });
    },
    clear() {
      matches = [];
      view.dispatch({ effects: setFindMatches.of({ matches: [], current: -1 }) });
    },
    replaceCurrent(query, replacement) {
      const { from, to } = view.state.selection.main;
      const target = nonEmptyMatches(view, query).find(
        (match) => match.index === from && match.index + match.length === to,
      );
      if (!target) return false;
      const slice = view.state.sliceDoc(target.index, target.index + target.length);
      const replaced = replaceAllMatches(slice, query.query, replacement, query.options);
      view.dispatch({
        changes: { from: target.index, to: target.index + target.length, insert: replaced },
      });
      return true;
    },
    replaceAll(query, replacement) {
      const next = replaceAllMatches(
        view.state.doc.toString(),
        query.query,
        replacement,
        query.options,
      );
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: next } });
    },
  };
}
