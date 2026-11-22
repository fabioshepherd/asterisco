import { Command } from "cmdk";
import { Info } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  COMMAND_GROUPS,
  COMMANDS,
  type CommandDef,
  type CommandGroup,
  type CommandId,
} from "@/app/menu/commands";
import { MENU_MODEL, type MenuNode } from "@/app/menu/menu-model";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { openPath } from "@/features/file-ops/file-ops";
import { openRecentFolder } from "@/features/file-tree/workspace-ops";
import { commandCombo, formatCombo, useKeybindings } from "@/features/settings/keybindings";
import { tabLabels } from "@/features/tabs/tab-labels";
import { useSettings } from "@/stores/settings";
import { listMarkdownFiles, type MarkdownFile } from "@/lib/tauri/workspace";
import { useDocuments } from "@/stores/document";
import { useRecents } from "@/stores/recents";
import { useWorkspace, workspaceName } from "@/stores/workspace";

import { useCommandPalette } from "./use-command-palette";
import { useRecentCommands } from "./recent-commands";
import "./command-palette.css";

type Translate = (key: string) => string;

interface PaletteCommand {
  id: string;
  group: CommandGroup;
  label: string;
  hint?: string;
  run: () => void | Promise<void>;
}

/**
 * Each menu command's palette group: the menu it sits in, so a user fluent in
 * the menubar finds commands where they expect them. Export has a group of its
 * own; Help joins the app group.
 */
function menuGroups(): Map<string, CommandGroup> {
  const groups = new Map<string, CommandGroup>();
  const walk = (nodes: readonly MenuNode[], group: CommandGroup) => {
    for (const node of nodes) {
      if (node.kind === "command") groups.set(node.command, group);
      if (node.kind === "submenu") walk(node.children, node.id === "export" ? "export" : group);
    }
  };
  for (const section of MENU_MODEL) {
    const group = COMMAND_GROUPS.find((id) => id === section.id) ?? "app";
    walk(section.children, group);
  }
  return groups;
}

const MENU_GROUPS = menuGroups();

/** Every command but the palette's own toggle, which would only close it. */
const PALETTE_COMMANDS: readonly CommandDef[] = Object.values(COMMANDS).filter(
  (command) => command.id !== ("command-palette" satisfies CommandId),
);

export function CommandPalette() {
  const { t } = useTranslation("editor");
  // labelKeys come from the command registry; the typed `t` can't see they're valid.
  const tMenu = useTranslation("menu").t as unknown as Translate;
  const isOpen = useCommandPalette((s) => s.isOpen);
  const close = useCommandPalette((s) => s.close);
  const rootPath = useWorkspace((s) => s.rootPath);
  const recentFolders = useRecents((s) => s.recentFolders);
  const documents = useDocuments((s) => s.documents);
  const tabs = useDocuments((s) => s.tabs);
  const setActiveDocument = useDocuments((s) => s.setActiveDocument);
  const bindings = useKeybindings((s) => s.bindings);
  const recentIds = useRecentCommands((s) => s.recent);
  const recordCommand = useRecentCommands((s) => s.record);

  // Quick-open indexes exactly what the tree lists — same axis, one setting.
  const showIgnoredFolders = useSettings((s) => s.showIgnoredFolders);

  const [files, setFiles] = useState<MarkdownFile[]>([]);
  // The index stopped at its cap: the A→Z list below is a prefix, not the
  // workspace, and it has to say so rather than look complete.
  const [filesTruncated, setFilesTruncated] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isOpen) {
      // Reset transient palette state so a reopen always lands on the root list.
      setFiles([]);
      setFilesTruncated(false);
      setLoadingFiles(false);
      setSearch("");
      return;
    }
    if (!rootPath) {
      setFiles([]);
      setFilesTruncated(false);
      return;
    }
    let cancelled = false;
    setLoadingFiles(true);
    listMarkdownFiles(rootPath, showIgnoredFolders)
      .then((index) => {
        if (cancelled) return;
        setFiles(index.files);
        setFilesTruncated(index.truncated);
      })
      .catch(() => {
        if (cancelled) return;
        setFiles([]);
        setFilesTruncated(false);
      })
      .finally(() => !cancelled && setLoadingFiles(false));
    return () => {
      cancelled = true;
    };
  }, [isOpen, rootPath, showIgnoredFolders]);

  const untitled = t("untitled");
  const documentLabels = useMemo(() => tabLabels(documents, untitled), [documents, untitled]);
  // "Open documents" follows the tab strip the user arranged, not creation order.
  const openDocuments = useMemo(
    () =>
      tabs.flatMap((id) => {
        const doc = documents.find((candidate) => candidate.id === id);
        return doc ? [doc] : [];
      }),
    [tabs, documents],
  );

  const runAndClose = (action: () => void | Promise<void>) => {
    close();
    void action();
  };

  const runCommand = (command: PaletteCommand) => {
    recordCommand(command.id);
    runAndClose(command.run);
  };

  // Built on every render, not memoized: `when` reads the workspace, which this
  // component already subscribes to (`rootPath`), so a render is the right cue.
  const commands: PaletteCommand[] = PALETTE_COMMANDS.flatMap((command) => {
    const group = command.group ?? MENU_GROUPS.get(command.id);
    if (!group || (command.when && !command.when())) return [];
    const combo = commandCombo(command.id, bindings);
    return [
      {
        id: command.id,
        group,
        label: tMenu(command.labelKey),
        hint: combo ? formatCombo(combo) : undefined,
        run: command.run,
      },
    ];
  });
  const commandsById = new Map(commands.map((command) => [command.id, command]));

  // Recently-used commands, in recency order, shown only on the empty root list.
  const recentCommands = recentIds
    .map((id) => commandsById.get(id))
    .filter((command): command is PaletteCommand => command !== undefined);
  const showRecent = search === "" && recentCommands.length > 0;
  // While the Recent group is up (empty query), hide those same ids from their
  // home groups so each command appears once, not twice.
  const recentSet = showRecent ? new Set(recentCommands.map((command) => command.id)) : null;

  const renderCommandItem = (command: PaletteCommand, valuePrefix: string) => (
    <Command.Item
      key={`${valuePrefix}-${command.id}`}
      value={`${valuePrefix} ${command.label}`}
      keywords={[command.label]}
      onSelect={() => runCommand(command)}
    >
      {command.label}
      {command.hint ? <span className="cmdk-hint">{command.hint}</span> : null}
    </Command.Item>
  );

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent
        placement="top"
        className="flex max-h-[70vh] w-[min(36rem,92vw)] flex-col overflow-hidden"
      >
        <DialogTitle className="sr-only">{t("palette.label")}</DialogTitle>
        <DialogDescription className="sr-only">{t("palette.description")}</DialogDescription>
        <Command label={t("palette.label")} className="flex min-h-0 flex-1 flex-col">
          <div className="cmdk-input-row">
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder={t("palette.placeholder")}
            />
          </div>

          <Command.List>
            <Command.Empty>
              {rootPath ? t("palette.empty") : t("palette.noWorkspace")}
            </Command.Empty>

            <>
              {showRecent ? (
                <Command.Group heading={t("palette.recent")}>
                  {recentCommands.map((command) => renderCommandItem(command, "recent"))}
                </Command.Group>
              ) : null}

              {COMMAND_GROUPS.map((groupId) => {
                const items = commands.filter(
                  (command) => command.group === groupId && !recentSet?.has(command.id),
                );
                if (items.length === 0) return null;
                return (
                  <Command.Group key={groupId} heading={t(`palette.groups.${groupId}`)}>
                    {items.map((command) => renderCommandItem(command, "command"))}
                  </Command.Group>
                );
              })}

              {openDocuments.length > 0 ? (
                <Command.Group heading={t("palette.openDocuments")}>
                  {openDocuments.map((doc) => {
                    // Same labels the tab strip shows: a list of four identical
                    // `README.md` rows is not a list you can choose from.
                    const label = documentLabels.get(doc.id);
                    const name = label?.name ?? untitled;
                    const context = label?.context ?? null;
                    return (
                      <Command.Item
                        key={doc.id}
                        value={`document ${name} ${context ?? ""} ${doc.id}`}
                        keywords={context ? [name, context] : [name]}
                        onSelect={() => runAndClose(() => setActiveDocument(doc.id))}
                      >
                        {name}
                        {context ? (
                          <span className="cmdk-hint" aria-hidden>
                            {context}
                          </span>
                        ) : null}
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              ) : null}

              {loadingFiles ? (
                <Command.Group heading={t("palette.files")}>
                  <Command.Loading label={t("palette.loadingFiles")}>
                    <div className="cmdk-skeleton" style={{ width: "70%" }} />
                    <div className="cmdk-skeleton" style={{ width: "55%" }} />
                    <div className="cmdk-skeleton" style={{ width: "62%" }} />
                  </Command.Loading>
                </Command.Group>
              ) : files.length > 0 ? (
                <Command.Group heading={t("palette.files")}>
                  {files.map((file) => (
                    <Command.Item
                      key={file.path}
                      value={`file ${file.name}`}
                      keywords={[file.name]}
                      onSelect={() => runAndClose(() => openPath(file.path))}
                    >
                      {file.name}
                    </Command.Item>
                  ))}
                  {/* The index is sorted after the cap truncates it, so without
                    this the list ends at "m" and looks like the whole
                    workspace. Not a Command.Item: it is a fact, not a choice. */}
                  {filesTruncated ? (
                    <div className="cmdk-note" role="note">
                      <Info className="size-3.5 shrink-0" aria-hidden />
                      {/* `shown`, not `count`: `count` would send i18next looking
                        for plural variants of a key that has none. */}
                      <span>{t("palette.filesTruncated", { shown: files.length })}</span>
                    </div>
                  ) : null}
                </Command.Group>
              ) : null}

              {recentFolders.length > 0 ? (
                <Command.Group heading={t("palette.recentFolders")}>
                  {recentFolders.map((path) => (
                    <Command.Item
                      key={path}
                      value={`folder ${workspaceName(path) ?? path} ${path}`}
                      keywords={[workspaceName(path) ?? path]}
                      onSelect={() => runAndClose(() => openRecentFolder(path))}
                    >
                      {workspaceName(path) ?? path}
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}
            </>
          </Command.List>

          <div className="cmdk-footer" aria-hidden>
            <span>
              <kbd>↑↓</kbd> {t("palette.kbd.navigate")}
            </span>
            <span>
              <kbd>↵</kbd> {t("palette.kbd.select")}
            </span>
            <span className="cmdk-footer-end">
              <kbd>esc</kbd> {t("palette.kbd.close")}
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
