import {
  ChevronDown,
  ChevronRight,
  FilePlus,
  FolderOpen,
  ListCollapse,
  PanelLeftClose,
  Search,
  X,
} from "lucide-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { openPath } from "@/features/file-ops/file-ops";
import { Outline } from "@/features/outline/Outline";
import { selectActiveDocument, useDocuments } from "@/stores/document";
import { useUi } from "@/stores/ui";
import { parentFolder, useWorkspace, workspaceName } from "@/stores/workspace";

import { FileTree, FILTER_SUMMARY_ID } from "./FileTree";
import { useFileActions } from "./file-actions";
import { NameDialog } from "./NameDialog";
import { SidebarResizer } from "./SidebarResizer";
import { hasOpenBranches, useTreeExpansion } from "./tree-expansion";
import { TreeContextMenu } from "./TreeContextMenu";
import { useTreeMenu } from "./use-tree-menu";
import { openFolder } from "./workspace-ops";

const SIDEBAR_ID = "workspace-sidebar";

/** Workspace sidebar: open a folder and browse its markdown files. */
export function Sidebar() {
  const { t } = useTranslation("editor");
  const reduceMotion = useReducedMotion();
  const rootPath = useWorkspace((state) => state.rootPath);
  const hasDocument = useDocuments((state) => selectActiveDocument(state) != null);
  const outlineVisible = useUi((state) => state.outlineVisible);
  const toggleOutline = useUi((state) => state.toggleOutline);
  const sidebarVisible = useUi((state) => state.sidebarVisible);
  const toggleSidebar = useUi((state) => state.toggleSidebar);
  const startNewFile = useFileActions((state) => state.startNewFile);
  const openTreeMenu = useTreeMenu((state) => state.open);
  const sidebarWidth = useUi((state) => state.sidebarWidth);
  const expanded = useTreeExpansion((state) => state.expanded);
  const collapseAll = useTreeExpansion((state) => state.collapseAll);
  const parentName = workspaceName(parentFolder(rootPath));
  const [filter, setFilter] = useState("");

  // The root always stays open (its children are the top-level rows), so the
  // action is dead until something below it is actually open.
  const canCollapse = useMemo(
    () => (rootPath ? hasOpenBranches(expanded, rootPath) : false),
    [expanded, rootPath],
  );

  return (
    <aside
      id={SIDEBAR_ID}
      aria-label={t("fileTree.label")}
      style={{ width: sidebarWidth }}
      className="relative flex shrink-0 flex-col bg-surface"
    >
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <div className="flex min-w-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            onClick={toggleSidebar}
            aria-label={t("fileTree.toggleSidebar")}
            title={t("fileTree.toggleSidebar")}
            aria-pressed={sidebarVisible}
            className="shrink-0 text-muted-fg"
          >
            <PanelLeftClose className="size-4" />
          </Button>
          {/* Which project am I in? The basename alone can't tell two checkouts
              apart, so the parent folder rides along as machine data, and the
              full path is one hover away. */}
          <span className="flex min-w-0 flex-col" title={rootPath ?? undefined}>
            <span className="truncate text-xs font-medium text-muted-fg">
              {rootPath ? workspaceName(rootPath) : t("fileTree.title")}
            </span>
            {parentName ? (
              <span className="truncate text-data leading-tight text-muted-fg" dir="ltr">
                {parentName}
              </span>
            ) : null}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {rootPath ? (
            <Button
              variant="ghost"
              size="icon-sm"
              type="button"
              onClick={() => startNewFile(rootPath)}
              aria-label={t("fileActions.newFile")}
              title={t("fileActions.newFile")}
              className="text-muted-fg"
            >
              <FilePlus className="size-4" />
            </Button>
          ) : null}
          {/* "Show ignored folders" lives in Settings ▸ Workspace only: a
              preference set once does not earn a permanent header button. */}
          {/* "Close folder" used to be a fifth icon here, indistinguishable
              from the rest and used about once a session. It lives in the File
              menu and the command palette now — the same rule the status bar
              follows: a command with a home elsewhere doesn't also earn a
              permanent button. */}
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            onClick={() => void openFolder()}
            aria-label={t("fileTree.openFolder")}
            title={t("fileTree.openFolder")}
            className="text-muted-fg"
          >
            <FolderOpen className="size-4" />
          </Button>
        </div>
      </div>

      {/* Tree-scoped controls, kept out of the header: the header acts on the
          workspace, this row acts on what is below it. */}
      {rootPath ? (
        <div className="flex items-center gap-1 px-3 pb-2">
          <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-border bg-bg ps-2 focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-[var(--ring)]">
            <Search className="size-3.5 shrink-0 text-muted-fg" />
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              // The results are one keystroke away, the way they are in
              // workspace search: typing two letters and then Tabbing three
              // times to reach what they found is not a filter.
              onKeyDown={(event) => {
                if (event.key === "Escape" && filter !== "") {
                  event.preventDefault();
                  event.stopPropagation();
                  setFilter("");
                  return;
                }
                if (event.key !== "ArrowDown" && event.key !== "Enter") return;
                const panel = document.getElementById(SIDEBAR_ID);
                const first = panel?.querySelector<HTMLElement>("[data-tree-item]");
                if (!first) return;
                event.preventDefault();
                // Enter opens the first match; every other row is one arrow key
                // away once focus is in the tree.
                const path = first.dataset.treePath;
                if (event.key === "Enter" && path) void openPath(path);
                else first.focus();
              }}
              placeholder={t("fileTree.filter")}
              aria-label={t("fileTree.filter")}
              aria-describedby={filter.trim() ? FILTER_SUMMARY_ID : undefined}
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-muted-fg"
            />
            {filter !== "" ? (
              <button
                type="button"
                onClick={() => setFilter("")}
                aria-label={t("fileTree.clearFilter")}
                title={t("fileTree.clearFilter")}
                className="me-1 shrink-0 rounded-sm p-0.5 text-muted-fg transition-colors duration-(--motion-duration-fast) ease-snappy hover:text-fg"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            onClick={() => collapseAll(rootPath)}
            disabled={!canCollapse}
            aria-label={t("fileTree.collapseAll")}
            title={t("fileTree.collapseAll")}
            className="shrink-0 text-muted-fg"
          >
            <ListCollapse className="size-4" />
          </Button>
        </div>
      ) : null}

      <div
        className="min-h-0 flex-1 overflow-auto py-1"
        // The root has no row of its own (the header names it), so the space
        // around the rows is where its context menu opens. Rows stop the event.
        onContextMenu={(event) => {
          if (!rootPath) return;
          event.preventDefault();
          openTreeMenu({ x: event.clientX, y: event.clientY, path: rootPath, isDir: true });
        }}
      >
        {rootPath ? (
          <FileTree rootPath={rootPath} filter={filter} />
        ) : (
          <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
            <p className="text-sm text-muted-fg">{t("fileTree.empty")}</p>
            <Button variant="outline" size="sm" onClick={() => void openFolder()}>
              {t("fileTree.openFolder")}
            </Button>
          </div>
        )}
      </div>

      {/* No document, no headings to outline: the section waits for one. */}
      {hasDocument ? (
        <div className="flex max-h-[45%] min-h-0 flex-col border-t border-border">
          {/* `outlineVisible` toggles the body; the header strip is always shown
            so the section can be re-opened after collapsing. Its name is the
            visible "Outline" whatever the state (APG Button): `aria-expanded`
            says whether it is open. */}
          <button
            type="button"
            onClick={toggleOutline}
            title={outlineVisible ? t("outline.hide") : t("outline.show")}
            aria-expanded={outlineVisible}
            aria-controls="sidebar-outline"
            className="flex w-full shrink-0 items-center gap-1.5 px-4 py-2 text-muted-fg transition-colors duration-(--motion-duration-fast) ease-snappy hover:text-fg"
          >
            {outlineVisible ? (
              <ChevronDown className="size-3.5 shrink-0" />
            ) : (
              <ChevronRight className="size-3.5 shrink-0" />
            )}
            <span className="truncate text-xs font-medium">{t("outline.title")}</span>
          </button>
          {/* Accordion body: height is the documented layout-animation exception;
            overflow-hidden clips the outline as it collapses. */}
          <AnimatePresence initial={false}>
            {outlineVisible && (
              <m.div
                key="outline-body"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                // motion's reducedMotion="user" only snaps transforms, not height;
                // collapse the layout animation explicitly when reduced motion is on.
                transition={{ duration: reduceMotion ? 0 : 0.18, ease: [0.2, 0, 0, 1] }}
                className="flex min-h-0 flex-col overflow-hidden"
              >
                <div id="sidebar-outline" className="min-h-0 flex-1 overflow-auto">
                  <Outline />
                </div>
              </m.div>
            )}
          </AnimatePresence>
        </div>
      ) : null}

      <SidebarResizer controls={SIDEBAR_ID} />
      <TreeContextMenu />
      <NameDialog />
    </aside>
  );
}
