import { Check, Save } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { toggleAutoSave } from "@/features/file-sync/toggle-auto-save";
import { cn } from "@/lib/utils";
import { selectActiveDocument, useDocuments } from "@/stores/document";
import { useSelection } from "@/stores/selection";
import { useSettings } from "@/stores/settings";
import { useUi } from "@/stores/ui";
import { useWorkspace } from "@/stores/workspace";

import { countMarkdownWords, countWords } from "./word-count";
import { ViewModeControl } from "./ViewModeControl";

/** A thin rule, not a box: the status line separates with lines (DESIGN.md §4). */
function Rule() {
  return <span className="h-4 w-px shrink-0 bg-border" aria-hidden />;
}

/**
 * The path as the user thinks of it: relative to the open folder when the file
 * lives inside it, absolute otherwise (a file opened on its own, the common case
 * for this product, has no folder to be relative to).
 */
function displayPath(path: string, root: string | null): string {
  if (!root || !path.startsWith(root)) return path;
  return path.slice(root.length).replace(/^[/\\]+/, "");
}

/**
 * Split at the last separator so the directory can truncate while the file name
 * stays whole: a running foot that ellipsises the file name has lost the one word
 * the reader came for.
 */
function splitPath(path: string): { dir: string; base: string } {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i < 0 ? { dir: "", base: path } : { dir: path.slice(0, i + 1), base: path.slice(i + 1) };
}

/**
 * The manual's running foot (DESIGN.md §5, "The Status Line"): the document view
 * on the left, the file's path in the middle, machine truth on the right — the
 * latter set in mono at label size per "The Machine-Data Rule". What the app
 * *says* (saved, auto-save) stays in chrome sans; what the machine *knows*
 * (path, word count, cursor position) is data.
 *
 * The bar carries state that must be *seen*, not every command that must be
 * *reachable*: the remaining view commands (distraction-free) live in the View
 * menu, the command palette and a keybinding, and none of them is a state this
 * bar can report — distraction-free hides the bar itself.
 */
export function StatusBar() {
  const { t } = useTranslation("editor");
  const markdown = useDocuments((state) => selectActiveDocument(state)?.markdown ?? "");
  const hasDocument = useDocuments((state) => selectActiveDocument(state) != null);
  const path = useDocuments((state) => selectActiveDocument(state)?.path ?? null);
  const rootPath = useWorkspace((state) => state.rootPath);
  const isDirty = useDocuments((state) => selectActiveDocument(state)?.isDirty ?? false);
  const autoSave = useSettings((state) => state.autoSave);
  const selectionText = useSelection((state) => state.text);
  const storedCaret = useSelection((state) => state.caret);
  // Only source mode has lines to count; the WYSIWYG and reading views have nodes.
  const caret = useUi((state) => state.viewMode === "source") ? storedCaret : null;

  const words = useMemo(() => countMarkdownWords(markdown), [markdown]);
  const selectionWords = useMemo(() => countWords(selectionText), [selectionText]);
  const shownPath = useMemo(
    () => (path ? splitPath(displayPath(path, rootPath)) : null),
    [path, rootPath],
  );

  return (
    // Wraps rather than clips on a narrow window (SC 1.4.10): the path line
    // shrinks first, then the persistence group moves to a second line.
    <footer className="@container flex flex-wrap items-center justify-between gap-x-4 gap-y-1 overflow-hidden bg-surface px-4 py-1.5 text-xs text-muted-fg">
      {/* With no document there is no document state to report (DESIGN.md §5):
          the view switch, auto-save and the counts wait for one. */}
      {hasDocument ? <ViewModeControl /> : null}

      {/* The file's identity. Absent for an unsaved document — there is no path
          to state yet, and an invented one would not be machine truth. */}
      {shownPath ? (
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Rule />
          <span className="flex min-w-0 items-center text-data" title={path ?? undefined} dir="ltr">
            {/* The folder gives way first, then the name truncates — never over "Saved". */}
            <span className="shrink-1000 truncate">{shownPath.dir}</span>
            <span className="min-w-0 truncate text-fg">{shownPath.base}</span>
          </span>
        </div>
      ) : null}

      {hasDocument ? (
        <div className="flex min-w-0 shrink-0 items-center gap-3">
          {/* Persistence: the save result and the auto-save policy read as one unit. */}
          <div className="flex items-center gap-2">
            {isDirty ? (
              <span className="flex items-center gap-1 text-muted-fg">
                <span className="size-1.5 rounded-full bg-primary" aria-hidden />
                {t("status.unsaved")}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-muted-fg">
                <Check className="size-3.5" />
                {t("status.saved")}
              </span>
            )}
            {/* A toggle keeps one name whatever its state (APG Button); the
                state is `aria-pressed`. The name is the visible text, so it
                satisfies Label in Name; the pressed styling and `title` show
                the state. */}
            <button
              type="button"
              aria-pressed={autoSave}
              title={autoSave ? t("status.autoSaveOn") : t("status.autoSaveOff")}
              onClick={toggleAutoSave}
              className={cn(
                "flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-[color,background-color,transform] duration-(--motion-duration-fast) ease-snappy hover:bg-muted hover:text-fg active:scale-[0.98]",
                autoSave && "bg-muted text-fg",
              )}
            >
              <Save className="size-3.5" />
              {/* Icon-only when narrow, but the name stays the visible word. */}
              <span className="sr-only @5xl:not-sr-only">{t("status.autoSave")}</span>
            </button>
          </div>
          <Rule />
          {caret ? (
            <>
              {/* `aria-label` on a generic span is prohibited (ARIA 1.2) and
                  ignored, so the abbreviation is hidden and spelled out. */}
              <span className="whitespace-nowrap text-data">
                <span aria-hidden>
                  {t("status.caret", { line: caret.line, column: caret.column })}
                </span>
                <span className="sr-only">
                  {t("status.caretLabel", { line: caret.line, column: caret.column })}
                </span>
              </span>
              <Rule />
            </>
          ) : null}
          {selectionWords > 0 ? (
            <span className="whitespace-nowrap text-data text-fg">
              {t("status.selectionWords", { count: selectionWords })}
            </span>
          ) : null}
          <span className="whitespace-nowrap text-data text-fg">
            {t("status.words", { count: words })}
          </span>
        </div>
      ) : null}
    </footer>
  );
}
