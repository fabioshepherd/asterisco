import type { TFunction } from "i18next";
import { ChevronRight, FileTerminal, FileText, Folder } from "lucide-react";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { openPath } from "@/features/file-ops/file-ops";
import { log } from "@/lib/log";
import { revealInScroller } from "@/lib/reveal";
import { errorMessage } from "@/lib/tauri/errors";
import { readDir, type DirEntry } from "@/lib/tauri/fs";
import { appErrorDetail, localizeAppError } from "@/lib/tauri/localize-error";
import { cn } from "@/lib/utils";
import { selectActiveDocument, useDocuments } from "@/stores/document";
import { useSettings } from "@/stores/settings";
import { useWorkspace, workspaceName } from "@/stores/workspace";

import { deleteEntry } from "./file-actions";
import { FilteredRow } from "./FilteredFiles";
import { useTreeFocus } from "./focus-tree";
import { useTreeExpansion } from "./tree-expansion";
import { TreeLoadingRow, TreeStateRow } from "./TreeStateRow";
import {
  documentKind,
  filterDocuments,
  indentStyle,
  relativeTo,
  treeItemClass,
  visibleEntries,
  type DocumentMatches,
} from "./tree-utils";
import { useDocumentIndex } from "./use-document-index";
import { useTreeMenu } from "./use-tree-menu";

/**
 * Roving-tabindex coordination for the tree: exactly one node is a tab stop at
 * a time, and arrow keys (handled by the container in `FileTree`) move focus
 * between rendered nodes — the WAI-ARIA `tree` keyboard contract.
 */
interface TreeNav {
  focusedPath: string;
  focus: (path: string) => void;
  /** The workspace root: no row of its own, so while it holds the tab stop the
   *  first top-level row stands in for it. */
  rootPath: string;
}
const TreeNavContext = createContext<TreeNav | null>(null);

/**
 * What a directory's children turned out to be. `null` is "not read yet" — the
 * loading state is the absence of a result, deliberately: setting a loading
 * value here would re-run the effect below, whose cleanup would then cancel the
 * very read it just started.
 */
type Children =
  | { state: "error"; message: string; detail: string; title?: string }
  | { state: "ready"; entries: DirEntry[]; total: number; scanned: number };

interface TreeNodeProps {
  entry: DirEntry;
  level: number;
  defaultExpanded?: boolean;
  /** The workspace root: always open, rendering its children without a row of
   *  its own — the sidebar header already names the folder. */
  isRoot?: boolean;
  /** The first top-level row, which takes the tab stop while no row has it. */
  isFirst?: boolean;
}

function TreeNode({
  entry,
  level,
  defaultExpanded = false,
  isRoot = false,
  isFirst = false,
}: TreeNodeProps) {
  const { t } = useTranslation("editor");
  // Expansion is kept outside the component: collapsing a folder unmounts its
  // whole subtree, and with the flag in local state that threw away every
  // descendant's shape. See `tree-expansion.ts`.
  const expanded = useTreeExpansion(
    (state) => isRoot || (state.expanded[entry.path] ?? defaultExpanded),
  );
  const toggleExpanded = useTreeExpansion((state) => state.toggle);
  const setExpanded = useTreeExpansion((state) => state.setExpanded);
  const [children, setChildren] = useState<Children | null>(null);
  const showIgnored = useSettings((state) => state.showIgnoredFolders);
  const activePath = useDocuments((state) => selectActiveDocument(state)?.path ?? null);
  const treeVersion = useWorkspace((state) => state.treeVersion);
  // The workspace root, so Rust can assemble the `.gitignore` files between it
  // and this folder — a single `read_dir` has no walk to carry them along.
  const rootPath = useWorkspace((state) => state.rootPath);
  const revealPaths = useWorkspace((state) => state.revealPaths);
  const revealToken = useWorkspace((state) => state.revealToken);
  const revealForce = useWorkspace((state) => state.revealForce);
  const expandIfUnset = useTreeExpansion((state) => state.expandIfUnset);
  const openMenu = useTreeMenu((state) => state.open);
  const nav = useContext(TreeNavContext);
  const rowRef = useRef<HTMLLIElement>(null);

  const isActive = !entry.isDir && entry.path === activePath;

  // Open the branches leading to a revealed file, and scroll the file itself
  // into view. `revealToken` re-runs this when the same path is revealed twice.
  useEffect(() => {
    if (revealToken === 0 || !revealPaths.has(entry.path)) return;
    if (entry.isDir) {
      // Following the active document only opens folders nobody has decided
      // about: a branch the user closed by hand stays closed, instead of
      // springing back open on every tab switch beneath it. An explicit
      // "reveal" is a decision of its own and overrides that.
      if (revealForce) setExpanded(entry.path, true);
      else expandIfUnset(entry.path);
    } else if (rowRef.current) {
      // Not `scrollIntoView`: it would move Chromium's Tab starting point here.
      revealInScroller(rowRef.current, "y");
    }
  }, [revealToken, revealPaths, revealForce, entry.path, entry.isDir, setExpanded, expandIfUnset]);

  useEffect(() => {
    if (!entry.isDir || !expanded || children !== null) return;
    let cancelled = false;
    readDir(entry.path, rootPath)
      .then((listing) => {
        if (cancelled) return;
        // `total` counts what is on disk, ignored folders included, so a folder
        // holding only `node_modules` is never reported as empty.
        setChildren({
          state: "ready",
          entries: listing.entries,
          total: listing.total,
          scanned: listing.scanned,
        });
      })
      .catch((error: unknown) => {
        // A folder we cannot read is not an empty folder. Saying so would be a
        // false statement about the user's disk, one keystroke from Delete —
        // so the row names the folder and the reason, and offers to try again.
        if (cancelled) return;
        log.warn("read_dir failed", errorMessage(error));
        setChildren({
          state: "error",
          message: t("fileTree.folderError", {
            name: entry.name,
            reason: localizeAppError(error),
          }),
          // Where it happened, in the panel's own terms. The absolute path and
          // the errno stay on hover.
          detail: relativeTo(rootPath, entry.path),
          title: appErrorDetail(error),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [entry.isDir, entry.path, entry.name, expanded, children, rootPath, t]);

  // Reload children after a workspace mutation (create/rename/delete).
  useEffect(() => {
    setChildren(null);
  }, [treeVersion]);

  // The setting only decides what is shown, so it re-filters what was already
  // read — no second trip to disk.
  const visible = useMemo(
    () => (children?.state === "ready" ? visibleEntries(children.entries, showIgnored) : null),
    [children, showIgnored],
  );

  const onContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    openMenu({ x: event.clientX, y: event.clientY, path: entry.path, isDir: entry.isDir });
  };

  // Shared per-row wiring. The treeitem itself is the tab stop (WAI-ARIA APG):
  // putting focus on an inner button would hide level, position and expanded
  // state from screen readers, which read them off the focused element.
  const sharedProps = {
    role: "treeitem" as const,
    tabIndex:
      nav?.focusedPath === entry.path || (isFirst && nav?.focusedPath === nav?.rootPath) ? 0 : -1,
    // Treeitems nest (a folder's group lives inside its own `<li>`) and focus
    // events bubble, so a node claims the tab stop only when it is itself the
    // target — otherwise every ancestor would steal it back on the way up.
    onFocus: (event: React.FocusEvent) => {
      if (event.target === event.currentTarget) nav?.focus(entry.path);
    },
    // `data-tree-item` marks a row arrow navigation may land on; `data-tree-path`
    // marks one that points at something on disk. They are not the same set —
    // an error or "no documents" row is navigable but has no path, and Delete
    // must never read one as if it did.
    "data-tree-item": "",
    "data-tree-path": entry.path,
    "data-tree-level": level,
    "data-tree-dir": entry.isDir,
    // The name typeahead matches on. It used to read `title`, which also has to
    // serve as the hover tooltip and — for a row that says what a file is *for*
    // — no longer holds the name on its own.
    "data-tree-name": entry.name,
    title: entry.name,
    dir: "ltr" as const,
    onContextMenu,
  };

  const indent = indentStyle(level);

  // The focusable element is the treeitem `<li>`, which also contains the
  // nested group — so the global `:focus-visible` outline would ring the whole
  // subtree. Suppress it there and draw the ring on the row instead, inset so a
  // full-width row can't have its ring clipped by the sidebar's scroll box. The
  // `>div` child combinator rings only this item's own row: a group variant
  // would also match every descendant row, since they sit inside the same `<li>`.
  const rowClass =
    "flex w-full items-center gap-1.5 py-1.5 pe-2 text-sm transition-colors duration-(--motion-duration-fast) ease-snappy";
  const itemClass = treeItemClass;

  // The root lists its children at its own level: it has no row to nest under.
  const childLevel = isRoot ? level : level + 1;
  const childRows =
    children === null ? (
      <TreeLoadingRow label={t("fileTree.loadingFolder")} level={childLevel} tabStop={isRoot} />
    ) : children.state === "error" ? (
      <TreeStateRow
        message={children.message}
        detail={children.detail}
        title={children.title}
        level={childLevel}
        tone="danger"
        onRetry={() => setChildren(null)}
        retryLabel={t("fileTree.retry")}
        tabStop={isRoot}
      />
    ) : (
      <>
        {visible?.map((child, index) => (
          <TreeNode
            key={child.path}
            entry={child}
            level={childLevel}
            isFirst={isRoot && index === 0}
          />
        ))}
        {/* A folder holding files this app doesn't open — or nothing
            but build output — is not an empty folder. Neither claim is
            safe once the listing stopped early, so the cap speaks
            instead of the count. */}
        {(visible?.length ?? 0) === 0 && children.scanned >= children.total ? (
          <TreeStateRow
            message={children.total === 0 ? t("fileTree.emptyFolder") : t("fileTree.noDocuments")}
            level={childLevel}
            tabStop={isRoot}
          />
        ) : null}
        {children.scanned < children.total ? (
          <TreeStateRow
            message={t("fileTree.folderTruncated", {
              scanned: children.scanned,
              total: children.total,
            })}
            level={childLevel}
            tabStop={isRoot && (visible?.length ?? 0) === 0}
          />
        ) : null}
      </>
    );

  if (isRoot) return childRows;

  if (entry.isDir) {
    return (
      <li
        {...sharedProps}
        ref={rowRef}
        aria-expanded={expanded}
        aria-label={entry.name}
        aria-busy={expanded && children === null}
        className={itemClass}
        onKeyDown={(event) => {
          // Expand/collapse here; sibling/parent movement bubbles to the
          // container. stopPropagation only when we actually act, so the
          // container still moves focus on the no-op directions.
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            toggleExpanded(entry.path, defaultExpanded);
          } else if (event.key === "ArrowRight" && !expanded) {
            event.preventDefault();
            event.stopPropagation();
            setExpanded(entry.path, true);
          } else if (event.key === "ArrowLeft" && expanded) {
            event.preventDefault();
            event.stopPropagation();
            setExpanded(entry.path, false);
          }
        }}
      >
        {/* Folders are the scaffolding you scan past; the documents are what the
            panel is for, so they carry the ink and folders step back. */}
        <div
          style={indent}
          onClick={() => toggleExpanded(entry.path, defaultExpanded)}
          className={cn(rowClass, "text-muted-fg hover:bg-muted")}
        >
          <ChevronRight
            className={cn(
              "size-3.5 shrink-0 text-muted-fg transition-transform",
              expanded && "rotate-90",
            )}
          />
          <Folder className="size-4 shrink-0 text-muted-fg" />
          <span className="truncate">{entry.name}</span>
        </div>
        {expanded ? <ul role="group">{childRows}</ul> : null}
      </li>
    );
  }

  // What the file is for, as far as its name says. An agent brief and a note
  // were the same row with the same glyph, in a panel whose folder policy is
  // built around telling them apart.
  const kind = documentKind(entry.name, entry.path);

  return (
    <li
      {...sharedProps}
      ref={rowRef}
      // The icon is the only thing carrying the distinction on screen, so the
      // accessible name has to carry it in words. A README needs no such
      // suffix: its name already is the announcement.
      aria-label={kind === "agent" ? t("fileTree.agentFile", { name: entry.name }) : entry.name}
      // "The file you are reading", not "the row you selected" — roving focus
      // owns selection, so aria-selected would contradict it on every arrow.
      // `"true"` rather than `"page"`: a file in a tree is not a page in a set
      // of pages, and the generic token is the honest one for it.
      aria-current={isActive ? "true" : undefined}
      className={itemClass}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          void openPath(entry.path);
        }
      }}
    >
      <div
        style={indent}
        onClick={() => void openPath(entry.path)}
        className={cn(
          rowClass,
          // "Current" reads as the outline's current heading does: the muted
          // surface and medium weight, not a signal fill (DESIGN.md §2, the
          // Signal Rule; §5 Menus). `aria-current` carries the state to AT.
          isActive ? "bg-muted font-medium text-fg" : "text-fg hover:bg-muted",
        )}
      >
        {/* Glyph and weight, never colour: the signal belongs to the current
            row (DESIGN.md, the Signal Rule), and a panel that tints files by
            category is a category tool, not a file selector. */}
        {kind === "agent" ? (
          <FileTerminal className="ms-3.5 size-4 shrink-0" />
        ) : (
          <FileText className="ms-3.5 size-4 shrink-0" />
        )}
        <span className={cn("truncate", kind === "readme" && "font-medium")}>{entry.name}</span>
      </div>
    </li>
  );
}

/** Id of the line that reports what the filter matched, for `aria-describedby`. */
export const FILTER_SUMMARY_ID = "file-tree-filter-summary";

/**
 * How long a typeahead prefix survives between keystrokes.
 *
 * 500 ms was below what it takes to type "CHANGELOG" while reading the rows, so
 * the buffer kept resetting mid-word and the jump landed on the wrong branch.
 * A second is what desktop file lists use, and it is the value WAI-ARIA's
 * typeahead guidance describes as a timeout the user can rely on.
 *
 * Typeahead deliberately still only visits rendered rows: reaching into a
 * collapsed branch is what the filter field above the tree does, over the whole
 * indexed workspace, and two different answers to one keystroke would be worse
 * than one honest one.
 */
const TYPEAHEAD_RESET_MS = 1000;

/** Lazy-loaded markdown file tree rooted at the workspace folder. */
export function FileTree({ rootPath, filter = "" }: { rootPath: string; filter?: string }) {
  const { t } = useTranslation("editor");
  const listRef = useRef<HTMLUListElement>(null);
  const openMenu = useTreeMenu((state) => state.open);
  const [focusedPath, setFocusedPath] = useState(rootPath);
  const activePath = useDocuments((state) => selectActiveDocument(state)?.path ?? null);
  const revealPath = useWorkspace((state) => state.revealPath);
  const followActive = useSettings((state) => state.revealActiveFile);
  const focusToken = useTreeFocus((state) => state.token);
  const resetExpansion = useTreeExpansion((state) => state.reset);

  // Filtering answers "where is that file" from the whole workspace, not from
  // the branches that happen to be open — a filter over the mounted rows would
  // look complete while hiding everything still collapsed. The index is the one
  // quick-open uses, on the same policy.
  const query = filter.trim();
  const index = useDocumentIndex(rootPath, query !== "");
  const matches = useMemo(
    () => (query === "" ? null : filterDocuments(index.files, query)),
    [index.files, query],
  );

  // Typeahead ("type-to-jump") buffer, reset after a short idle.
  const typeBuffer = useRef("");
  const typeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(typeTimer.current), []);

  // Reset the tab stop to the root whenever the workspace changes.
  useEffect(() => setFocusedPath(rootPath), [rootPath]);

  // A different folder is a different tree, so its expansion starts over —
  // but only on an actual change. The panel unmounts when it is hidden, and
  // reopening it is not a reason to throw away the shape the user built.
  const previousRoot = useRef(rootPath);
  useEffect(() => {
    if (previousRoot.current === rootPath) return;
    previousRoot.current = rootPath;
    resetExpansion();
  }, [rootPath, resetExpansion]);

  // Someone asked for the tree by keyboard: land on the current tab stop, or on
  // the first row when it is gone (a filter just replaced the whole list).
  useEffect(() => {
    if (focusToken === 0) return;
    const root = listRef.current;
    const target =
      root?.querySelector<HTMLElement>('[data-tree-item][tabindex="0"]') ??
      root?.querySelector<HTMLElement>("[data-tree-item]");
    target?.focus();
  }, [focusToken]);

  // Every other way into a document — a tab, quick-open, search, recents, a
  // double click in Finder — used to leave the tree collapsed and the current
  // file unlocated. Follow it instead, unless the user turned that off: some
  // people want the panel to stay where they put it.
  useEffect(() => {
    if (activePath && followActive) revealPath(activePath);
  }, [activePath, followActive, revealPath]);

  const nav = useMemo<TreeNav>(
    () => ({ focusedPath, focus: setFocusedPath, rootPath }),
    [focusedPath, rootPath],
  );

  const rootEntry: DirEntry = {
    name: workspaceName(rootPath) ?? rootPath,
    path: rootPath,
    isDir: true,
  };

  // Container-level keyboard nav across the rendered (visible) nodes, in DOM
  // order. Sibling/parent/edge movement lives here; a node only owns its own
  // expand/collapse (see `TreeNode`).
  const onKeyDown = (event: React.KeyboardEvent) => {
    const root = listRef.current;
    if (!root) return;

    if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
      const active = document.activeElement as HTMLElement | null;
      const path = active?.dataset.treePath;
      if (active && path) {
        const rect = active.getBoundingClientRect();
        openMenu({
          x: rect.left + 8,
          y: rect.bottom,
          path,
          isDir: active.dataset.treeDir === "true",
        });
        event.preventDefault();
      }
      return;
    }

    // Move the focused entry to the trash (confirmation handled downstream).
    // Delete only: Backspace edits the typeahead buffer below, and a stray
    // Backspace should never be one confirmation away from the trash.
    if (event.key === "Delete") {
      const active = document.activeElement as HTMLElement | null;
      const path = active?.dataset.treePath;
      if (path) {
        void deleteEntry(path, active?.dataset.treeDir === "true");
        event.preventDefault();
      }
      return;
    }

    if (event.key === "Backspace") {
      typeBuffer.current = typeBuffer.current.slice(0, -1);
      event.preventDefault();
      return;
    }

    // Type-to-jump: focus the next node whose name starts with the typed prefix.
    if (
      event.key.length === 1 &&
      event.key !== " " &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey
    ) {
      const items = Array.from(root.querySelectorAll<HTMLElement>("[data-tree-item]"));
      if (items.length === 0) return;
      typeBuffer.current += event.key.toLowerCase();
      clearTimeout(typeTimer.current);
      typeTimer.current = setTimeout(() => (typeBuffer.current = ""), TYPEAHEAD_RESET_MS);
      const prefix = typeBuffer.current;
      const active = document.activeElement as HTMLElement | null;
      const start = active ? items.indexOf(active) : -1;
      for (let k = 1; k <= items.length; k++) {
        const el = items[(start + k) % items.length];
        if (el && (el.dataset.treeName?.toLowerCase() ?? "").startsWith(prefix)) {
          el.focus();
          event.preventDefault();
          break;
        }
      }
      return;
    }

    const NAV_KEYS = ["ArrowDown", "ArrowUp", "Home", "End", "ArrowRight", "ArrowLeft"];
    if (!NAV_KEYS.includes(event.key)) return;

    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-tree-item]"));
    if (items.length === 0) return;
    const active = document.activeElement as HTMLElement | null;
    const i = active ? items.indexOf(active) : -1;
    const focusAt = (index: number) => {
      const clamped = Math.max(0, Math.min(items.length - 1, index));
      items[clamped]?.focus();
      event.preventDefault();
    };

    switch (event.key) {
      case "ArrowDown":
        focusAt(i + 1);
        break;
      case "ArrowUp":
        focusAt(i - 1);
        break;
      case "Home":
        focusAt(0);
        break;
      case "End":
        focusAt(items.length - 1);
        break;
      case "ArrowRight": {
        // Reaches here only for an already-expanded dir (node handled collapse)
        // or a file: step into the first child if one is rendered below.
        const level = Number(active?.dataset.treeLevel ?? "0");
        const next = items[i + 1];
        if (next && Number(next.dataset.treeLevel) > level) {
          next.focus();
          event.preventDefault();
        }
        break;
      }
      case "ArrowLeft": {
        // Reaches here only when there is nothing to collapse: move to parent.
        const level = Number(active?.dataset.treeLevel ?? "0");
        for (let j = i - 1; j >= 0; j--) {
          const candidate = items[j];
          if (candidate && Number(candidate.dataset.treeLevel) < level) {
            candidate.focus();
            event.preventDefault();
            break;
          }
        }
        break;
      }
    }
  };

  // The tab stop follows the tree; in filter mode the previously focused path is
  // usually gone, so the first match takes it rather than leaving the panel
  // unreachable by Tab.
  const filterTabStop =
    matches?.rows.some((file) => file.path === focusedPath) === true
      ? focusedPath
      : matches?.rows[0]?.path;

  return (
    <TreeNavContext.Provider value={nav}>
      {matches ? (
        // Referenced by the filter field's `aria-describedby` and polite, so the
        // count is heard where it is typed instead of only being visible.
        <p
          id={FILTER_SUMMARY_ID}
          aria-live="polite"
          className="px-4 pb-1 text-data text-muted-fg"
          dir="ltr"
        >
          {index.status === "loading"
            ? t("fileTree.indexing")
            : index.status === "error"
              ? index.message
              : filterSummary(t, matches, index)}
        </p>
      ) : null}
      <ul
        ref={listRef}
        role="tree"
        aria-label={t("fileTree.label")}
        onKeyDown={onKeyDown}
        className="select-none"
      >
        {matches ? (
          index.status === "error" ? (
            /* The same recovery the tree offers for one folder: an index that
               failed is not a workspace without documents. */
            <TreeStateRow
              message={index.message}
              level={0}
              tone="danger"
              onRetry={index.retry}
              retryLabel={t("fileTree.retry")}
            />
          ) : index.status === "loading" ? (
            <TreeStateRow message={t("fileTree.indexing")} level={0} />
          ) : matches.rows.length === 0 ? (
            <TreeStateRow message={t("fileTree.filterEmpty")} level={0} />
          ) : (
            matches.rows.map((file) => (
              <FilteredRow
                key={file.path}
                file={file}
                isActive={file.path === activePath}
                isTabStop={file.path === filterTabStop}
                onFocus={setFocusedPath}
              />
            ))
          )
        ) : (
          /* Keyed by root: opening another folder must not reconcile onto the
             previous one's loaded children, or the header would name workspace B
             while the rows — and Delete — still pointed at A. */
          <TreeNode key={rootPath} entry={rootEntry} level={0} isRoot />
        )}
      </ul>
    </TreeNavContext.Provider>
  );
}

/**
 * What the filter matched, in numbers. Everything that can shorten this list
 * says so: the render limit here, the index cap in Rust, and the folders the
 * walk could not open.
 */
function filterSummary(
  t: TFunction<"editor">,
  matches: DocumentMatches,
  index: { truncated: boolean; skipped: number },
): string {
  const counted = matches.capped
    ? t("fileTree.filterCapped", { shown: matches.rows.length, total: matches.total })
    : t("fileTree.filterCount", { total: matches.total });
  const notes = [
    index.truncated ? t("fileTree.indexTruncated") : null,
    index.skipped > 0 ? t("fileTree.indexSkipped", { count: index.skipped }) : null,
  ].filter(Boolean);
  return [counted, ...notes].join(" · ");
}
