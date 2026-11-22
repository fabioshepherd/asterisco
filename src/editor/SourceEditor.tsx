import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { replaceAll } from "@milkdown/kit/utils";
import { useEffect, useRef } from "react";

import { refreshActiveSearch } from "@/features/find-replace/use-find-replace";
import { consumePendingJumpLine } from "@/features/search/jump";
import { markdownToPlainText } from "@/features/status-bar/word-count";
import { useDocuments } from "@/stores/document";
import { useSelection } from "@/stores/selection";

import { getEditorsForDoc } from "./active-editor";
import { tokenHighlighting } from "./code-theme";
import { clearSearchControllerIf, setSearchController } from "./editor-search";
import { createSourceSearchController, findField } from "./source-search";

/**
 * Raw-Markdown "source mode" editor (CodeMirror 6), shown in place of the Crepe
 * WYSIWYG view while `ui.viewMode === "source"`. Markdown is the single source of
 * truth: the editor is seeded from the live Crepe instance's current markdown,
 * writes every edit straight into the document store, and on unmount pushes the
 * edited markdown back into the still-mounted Crepe editor via `replaceAll` (so
 * undo history and document state survive the round-trip without a remount).
 */

/** CodeMirror theme mapped onto our design tokens (follows light/dark). */
const tokenTheme = EditorView.theme({
  "&": { backgroundColor: "var(--bg)", color: "var(--fg)", height: "100%" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    fontFamily: "var(--font-mono)",
    // Same measure and line-height settings as the WYSIWYG views (one text
    // column); `ch` counts characters in this view's own (mono) face.
    lineHeight: "var(--editor-line-height, 1.7)",
    padding: "2rem max(1.5rem, calc((100% - var(--editor-measure, 66ch)) / 2))",
  },
  ".cm-content": { caretColor: "var(--fg)" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--fg)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    // Match the WYSIWYG selection (accent step-4 tint) so the two views agree.
    backgroundColor: "var(--selection)",
  },
  ".cm-gutters": {
    backgroundColor: "var(--bg)",
    color: "var(--muted-fg)",
    border: "none",
  },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "transparent" },
  ".cm-find-match": {
    backgroundColor: "color-mix(in oklab, var(--accent) 22%, transparent)",
    borderRadius: "var(--find-match-radius)",
  },
  ".cm-find-current": {
    backgroundColor: "color-mix(in oklab, var(--accent) 48%, transparent)",
    borderRadius: "var(--find-match-radius)",
    boxShadow: "0 0 0 1px var(--accent)",
  },
});

export function SourceEditor({ id, ariaLabel }: { id: string; ariaLabel: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  // Read by the content-attributes facet on every view update.
  const ariaLabelRef = useRef(ariaLabel);
  ariaLabelRef.current = ariaLabel;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const { setMarkdown } = useDocuments.getState();
    // Freshest markdown comes from THIS document's live Crepe instance (kept
    // mounted), resolved by doc id — not the global active slot, which may still
    // belong to another document's editor. Fall back to the store.
    const initial =
      getEditorsForDoc(id)[0]?.getMarkdown() ??
      useDocuments.getState().documents.find((doc) => doc.id === id)?.markdown ??
      "";

    const view = new EditorView({
      parent: container,
      state: EditorState.create({
        doc: initial,
        extensions: [
          lineNumbers(),
          history(),
          keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
          markdown(),
          // Token colours, shared with code blocks (light-only defaults failed AA in dark).
          tokenHighlighting,
          EditorView.lineWrapping,
          findField,
          tokenTheme,
          // Accessible name of the editing surface (WCAG 4.1.2).
          EditorView.contentAttributes.of(() => ({ "aria-label": ariaLabelRef.current })),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) setMarkdown(id, update.state.doc.toString());
            if (update.docChanged || update.selectionSet) {
              const range = update.state.selection.main;
              if (range.empty) useSelection.getState().clear();
              else {
                useSelection
                  .getState()
                  .setText(markdownToPlainText(update.state.sliceDoc(range.from, range.to)));
              }
              // Caret coordinates for the status line. CodeMirror counts lines
              // from 1; the column is the 1-based offset inside its line.
              const line = update.state.doc.lineAt(range.head);
              useSelection
                .getState()
                .setCaret({ line: line.number, column: range.head - line.from + 1 });
            }
          }),
        ],
      }),
    });
    viewRef.current = view;
    view.focus();

    // If we arrived here from a workspace-search result, jump to that line.
    const jumpLine = consumePendingJumpLine();
    if (jumpLine != null) {
      const lineNumber = Math.min(Math.max(jumpLine, 1), view.state.doc.lines);
      const pos = view.state.doc.line(lineNumber).from;
      view.dispatch({
        selection: { anchor: pos },
        effects: EditorView.scrollIntoView(pos, { y: "center" }),
      });
    }

    // Drive in-document Find against this CodeMirror view while it's visible.
    const searchController = createSourceSearchController(view);
    setSearchController(searchController);
    refreshActiveSearch();

    return () => {
      clearSearchControllerIf(searchController);
      useSelection.getState().clear();
      // The only view that knows line/column is going away; the status line must
      // not keep showing the last position of an editor that no longer exists.
      useSelection.getState().setCaret(null);
      const edited = view.state.doc.toString();
      setMarkdown(id, edited);
      // Push the edited markdown back into THIS document's still-mounted WYSIWYG
      // editor(s), resolved by doc id so it never writes into another document's
      // editor. Guarded per instance: on a tab switch an editor may be
      // mid-unmount; the store stays authoritative either way. An unchanged
      // source is skipped: replaceAll would still add an undo step and move the
      // caret to the end.
      for (const editor of getEditorsForDoc(id)) {
        try {
          if (edited === editor.getMarkdown()) continue;
          editor.editor.action(replaceAll(edited));
        } catch {
          // ignore — the document store already holds the edited markdown.
        }
      }
      viewRef.current = null;
      view.destroy();
    };
  }, [id]);

  // A renamed document renames its editor: an empty update re-reads attributes.
  useEffect(() => {
    viewRef.current?.dispatch({});
  }, [ariaLabel]);

  return <div ref={containerRef} className="source-editor h-full" data-editor-scroll />;
}
