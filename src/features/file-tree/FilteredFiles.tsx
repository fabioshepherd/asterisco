import { FileTerminal, FileText } from "lucide-react";
import { useTranslation } from "react-i18next";

import { openPath } from "@/features/file-ops/file-ops";
import type { MarkdownFile } from "@/lib/tauri/workspace";
import { cn } from "@/lib/utils";

import { baseName, documentKind, parentSegments, treeItemClass } from "./tree-utils";
import { useTreeMenu } from "./use-tree-menu";

interface FilteredRowProps {
  file: MarkdownFile;
  isActive: boolean;
  isTabStop: boolean;
  onFocus: (path: string) => void;
}

/**
 * One document in the filtered list.
 *
 * A match can be anywhere in the workspace, so the row shows where it lives:
 * the folders in mono at label size (a path is machine data — DESIGN.md's
 * Machine-Data Rule) and the name in the panel's own voice. Rows stay
 * `treeitem`s inside the same `tree`, so arrow keys, typeahead, the context
 * menu and Delete keep working without a second keyboard model.
 */
export function FilteredRow({ file, isActive, isTabStop, onFocus }: FilteredRowProps) {
  const { t } = useTranslation("editor");
  const openMenu = useTreeMenu((state) => state.open);
  const folders = parentSegments(file.name);
  const name = baseName(file.name);
  const kind = documentKind(name, file.path);

  return (
    <li
      role="treeitem"
      tabIndex={isTabStop ? 0 : -1}
      data-tree-item=""
      data-tree-path={file.path}
      data-tree-level={0}
      data-tree-name={name}
      // The whole relative path: the row renders it and truncates it, so the
      // basename alone was a tooltip for the part already on screen.
      title={file.name}
      dir="ltr"
      aria-label={kind === "agent" ? t("fileTree.agentFile", { name: file.name }) : file.name}
      aria-current={isActive ? "true" : undefined}
      className={treeItemClass}
      onFocus={(event) => {
        if (event.target === event.currentTarget) onFocus(file.path);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        openMenu({ x: event.clientX, y: event.clientY, path: file.path, isDir: false });
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          void openPath(file.path);
        }
      }}
    >
      <div
        onClick={() => void openPath(file.path)}
        className={cn(
          "flex w-full items-center gap-1.5 py-1.5 pe-2 ps-2 text-sm transition-colors duration-(--motion-duration-fast) ease-snappy",
          isActive ? "bg-muted font-medium text-fg" : "text-fg hover:bg-muted",
        )}
      >
        {kind === "agent" ? (
          <FileTerminal className="size-4 shrink-0" />
        ) : (
          <FileText className="size-4 shrink-0" />
        )}
        <span className="truncate">
          {folders ? <span className="text-data text-muted-fg">{folders}</span> : null}
          <span className={cn(kind === "readme" && "font-medium")}>{name}</span>
        </span>
      </div>
    </li>
  );
}
