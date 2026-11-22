import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { ClipboardCopy, FolderTree, Pencil, X, XSquare } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ContextMenu, ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu";
import { closeTabs } from "@/features/file-ops/file-ops";
import { revealInTree } from "@/features/file-tree/focus-tree";
import { useDocuments } from "@/stores/document";
import { notify } from "@/stores/notifications";
import { ancestorsWithin, useWorkspace } from "@/stores/workspace";

export interface TabMenuTarget {
  id: string;
  x: number;
  y: number;
}

interface TabContextMenuProps {
  target: TabMenuTarget | null;
  onRename: () => void;
  onClose: () => void;
  onDismiss: () => void;
}

/**
 * Right-click menu for a tab.
 *
 * Two groups: what to do with *this* file (rename, find it,
 * copy its path) and what to close. The bulk closes are what a tab strip needs
 * once it has filled up — closing fifteen tabs one X at a time is not a
 * workflow — and each one routes through the same unsaved-changes prompt as a
 * single close, so nothing shuts silently on unsaved work.
 *
 * Positioning, dismissal, roving and focus-return all come from the shared
 * context menu.
 */
export function TabContextMenu({ target, onRename, onClose, onDismiss }: TabContextMenuProps) {
  const { t } = useTranslation("editor");
  const id = target?.id;

  const path = useDocuments((state) => state.documents.find((doc) => doc.id === id)?.path ?? null);
  const tabs = useDocuments((state) => state.tabs);
  const rootPath = useWorkspace((state) => state.rootPath);

  const others = id ? tabs.filter((tab) => tab !== id) : [];
  const index = id ? tabs.indexOf(id) : -1;
  const toTheRight = index < 0 ? [] : tabs.slice(index + 1);
  // `revealPath` no-ops outside the workspace, and a row that silently does
  // nothing is worse than a row that isn't there.
  const canReveal = path !== null && rootPath !== null && ancestorsWithin(path, rootPath).size > 0;

  const copyPath = async (value: string) => {
    try {
      await writeText(value);
      notify.success(t("notify.copiedPath"));
    } catch {
      notify.error(t("notify.copyPathFailed"));
    }
  };

  return (
    <ContextMenu
      at={target ? { x: target.x, y: target.y } : null}
      label={t("tabs.menuLabel")}
      onDismiss={onDismiss}
      returnFocus={() => (id ? (document.getElementById(`tab-${id}`) ?? undefined) : undefined)}
    >
      <ContextMenuItem label={t("tabs.rename.action")} icon={<Pencil />} onSelect={onRename} />
      {canReveal ? (
        <ContextMenuItem
          label={t("commands.revealInFileTree")}
          icon={<FolderTree />}
          onSelect={() => revealInTree(path)}
        />
      ) : null}
      {path !== null ? (
        <ContextMenuItem
          label={t("tabs.copyPath")}
          icon={<ClipboardCopy />}
          onSelect={() => void copyPath(path)}
        />
      ) : null}
      <ContextMenuSeparator />
      <ContextMenuItem label={t("tabs.closeAction")} icon={<X />} onSelect={onClose} />
      <ContextMenuItem
        label={t("tabs.closeOthers")}
        icon={<XSquare />}
        disabled={others.length === 0}
        onSelect={() => void closeTabs(others)}
      />
      <ContextMenuItem
        label={t("tabs.closeToTheRight")}
        icon={<XSquare />}
        disabled={toTheRight.length === 0}
        onSelect={() => void closeTabs(toTheRight)}
      />
      <ContextMenuItem
        label={t("tabs.closeAll")}
        icon={<XSquare />}
        // The clicked tab last: the prompts walk the strip in order and end on
        // the one the menu was opened from.
        onSelect={() => void closeTabs([...others, ...(id ? [id] : [])])}
      />
    </ContextMenu>
  );
}
