import { FilePlus, Pencil, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ContextMenu, ContextMenuItem } from "@/components/ui/context-menu";
import { useWorkspace } from "@/stores/workspace";

import { deleteEntry, useFileActions } from "./file-actions";
import { useTreeMenu } from "./use-tree-menu";

/** The tree row for `path`, so focus can return to it when the menu closes.
 *  The root has no row of its own: it falls back to the tree's tab stop. */
function rowFor(path: string): HTMLElement | undefined {
  return (
    Array.from(document.querySelectorAll<HTMLElement>("[data-tree-path]")).find(
      (el) => el.dataset.treePath === path,
    ) ??
    document.querySelector<HTMLElement>('[data-tree-item][tabindex="0"]') ??
    undefined
  );
}

/** Right-click context menu for file-tree entries (new / rename / delete). */
export function TreeContextMenu() {
  const { t } = useTranslation("editor");
  const target = useTreeMenu((state) => state.target);
  const close = useTreeMenu((state) => state.close);
  const startNewFile = useFileActions((state) => state.startNewFile);
  const startRename = useFileActions((state) => state.startRename);
  const rootPath = useWorkspace((state) => state.rootPath);
  const closeWorkspace = useWorkspace((state) => state.closeWorkspace);

  const path = target?.path;

  return (
    <ContextMenu
      at={target ? { x: target.x, y: target.y } : null}
      label={t("fileActions.menuLabel")}
      onDismiss={close}
      returnFocus={() => (path ? rowFor(path) : undefined)}
    >
      {target?.isDir ? (
        <ContextMenuItem
          label={t("fileActions.newFile")}
          icon={<FilePlus />}
          onSelect={() => startNewFile(target.path)}
        />
      ) : null}
      {target ? (
        <ContextMenuItem
          label={t("fileActions.rename")}
          icon={<Pencil />}
          onSelect={() => startRename(target.path)}
        />
      ) : null}
      {/* The workspace root is not an entry to throw away: it is the folder you
          are in. Closing it is what someone means, and it has a home in the File
          menu and the palette. */}
      {target?.path === rootPath ? (
        <ContextMenuItem
          label={t("commands.closeFolder")}
          icon={<X />}
          onSelect={() => closeWorkspace()}
        />
      ) : target ? (
        <ContextMenuItem
          label={t("fileActions.delete")}
          icon={<Trash2 />}
          danger
          onSelect={() => void deleteEntry(target.path, target.isDir)}
        />
      ) : null}
    </ContextMenu>
  );
}
