import { toggleLinkCommand } from "@milkdown/kit/component/link-tooltip";
import {
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleStrongCommand,
  turnIntoTextCommand,
  wrapInHeadingCommand,
} from "@milkdown/kit/preset/commonmark";
import { toggleStrikethroughCommand } from "@milkdown/kit/preset/gfm";

import { runInsertFootnote } from "@/editor/footnotes";
import { runFormatCommand } from "@/editor/run-format-command";
import { useAboutDialog } from "@/features/about/use-about-dialog";
import { useCommandPalette } from "@/features/command-palette/use-command-palette";
import { closeWindowIfConfirmed } from "@/features/file-ops/close-window";
import { toggleAutoSave } from "@/features/file-sync/toggle-auto-save";
import {
  closeTab,
  newFile,
  openFile,
  saveActiveDocument,
  saveActiveDocumentAs,
} from "@/features/file-ops/file-ops";
import { useFileActions } from "@/features/file-tree/file-actions";
import { focusFileTree, revealActiveDocument } from "@/features/file-tree/focus-tree";
import { openFolder } from "@/features/file-tree/workspace-ops";
import { useFindReplace } from "@/features/find-replace/use-find-replace";
import { focusNewestToast } from "@/features/notifications/focus-toast";
import { useWorkspaceSearch } from "@/features/search/use-workspace-search";
import { useNoticesDialog } from "@/features/settings/use-notices-dialog";
import { useSettingsPanel } from "@/features/settings/use-settings-panel";
import { checkForUpdates } from "@/features/updates/check-updates";
import i18n from "@/i18n";
import { localizeAppError } from "@/lib/tauri/localize-error";
import { useDocuments } from "@/stores/document";
import { notify } from "@/stores/notifications";
import { useSettings } from "@/stores/settings";
import { resolveTheme } from "@/stores/theme";
import { useUi } from "@/stores/ui";
import { useWorkspace } from "@/stores/workspace";

/**
 * The export path (marked, the export CSS and font inlining) is only reached
 * from these commands, so it loads on the first export instead of at startup.
 */
function runExport(
  run: (ops: typeof import("@/features/export/export-ops")) => Promise<void>,
): void {
  import("@/features/export/export-ops")
    .then(run)
    // A chunk that fails to load would otherwise be a silent unhandled rejection.
    .catch((error: unknown) => {
      notify.error(i18n.t("notify.exportFailed", { ns: "editor", error: localizeAppError(error) }));
    });
}

/** Command palette groups, in display order. */
export const COMMAND_GROUPS = ["file", "edit", "format", "view", "export", "app"] as const;
export type CommandGroup = (typeof COMMAND_GROUPS)[number];

/** i18n key in the `menu` namespace + the action to run. */
export interface CommandDef {
  id: string;
  /** Key into the `menu` i18n namespace (e.g. "file.new"); one name everywhere. */
  labelKey: string;
  run: () => void | Promise<void>;
  /**
   * Palette group of a command the menu does not list; a menu command takes the
   * group of the menu it sits in.
   */
  group?: CommandGroup;
  /** Offered in the palette only while this holds. */
  when?: () => boolean;
}

function toggleTheme() {
  const { themePreference, setThemePreference } = useSettings.getState();
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  setThemePreference(resolveTheme(themePreference, systemDark) === "dark" ? "light" : "dark");
}

function closeActiveTab() {
  const { activeId } = useDocuments.getState();
  if (activeId) void closeTab(activeId);
}

/**
 * Single source of truth for invokable commands: one id, one name and one body
 * each. The menu model (menu-model.ts), the native menu bridge, the command
 * palette and the keymap (`KEY_ACTIONS[].command`) all reference these ids.
 */
const COMMAND_DEFS = {
  "new-file": { labelKey: "file.new", run: () => void newFile() },
  "open-file": { labelKey: "file.open", run: () => void openFile() },
  "open-folder": { labelKey: "file.openFolder", run: () => void openFolder() },
  // Closing the workspace used to exist only as an icon button in the sidebar
  // header, where it sat undifferentiated beside four others. A command with a
  // home in the menu and the palette does not also need a permanent button.
  "close-folder": {
    labelKey: "file.closeFolder",
    run: () => useWorkspace.getState().closeWorkspace(),
  },
  // The tree has no root row to rename from, so this is its keyboard path.
  "rename-folder": {
    labelKey: "file.renameFolder",
    group: "file",
    when: () => useWorkspace.getState().rootPath !== null,
    run: () => {
      const { rootPath } = useWorkspace.getState();
      if (rootPath) useFileActions.getState().startRename(rootPath);
    },
  },
  "save-file": { labelKey: "file.save", run: () => void saveActiveDocument() },
  "save-file-as": {
    labelKey: "file.saveAs",
    run: () => void saveActiveDocumentAs(),
  },
  close: { labelKey: "file.close", run: closeActiveTab },
  quit: { labelKey: "app.quit", run: () => void closeWindowIfConfirmed() },
  "export-html": {
    labelKey: "file.export.html",
    run: () => runExport((ops) => ops.exportActiveDocumentHtml()),
  },
  print: {
    labelKey: "file.print",
    run: () => runExport((ops) => ops.printActiveDocument()),
  },
  "copy-html": {
    labelKey: "file.export.copyHtml",
    run: () => runExport((ops) => ops.copyActiveDocumentAsHtml()),
  },
  "copy-markdown": {
    labelKey: "file.export.copyMarkdown",
    run: () => runExport((ops) => ops.copyActiveDocumentAsMarkdown()),
  },
  about: {
    labelKey: "app.about",
    run: () => useAboutDialog.getState().open(),
  },
  settings: {
    labelKey: "app.settings",
    run: () => useSettingsPanel.getState().open(),
  },
  "check-updates": {
    labelKey: "app.checkUpdates",
    run: () => void checkForUpdates(),
  },
  "toggle-theme": { labelKey: "view.toggleTheme", run: toggleTheme },
  find: { labelKey: "edit.find", run: () => useFindReplace.getState().open("find") },
  replace: {
    labelKey: "edit.replace",
    run: () => useFindReplace.getState().open("replace"),
  },
  "search-workspace": {
    labelKey: "edit.findInFiles",
    run: () => useWorkspaceSearch.getState().open(),
  },
  "command-palette": {
    labelKey: "view.commandPalette",
    run: () => useCommandPalette.getState().toggle(),
  },
  "toggle-sidebar": {
    labelKey: "view.toggleSidebar",
    run: () => useUi.getState().toggleSidebar(),
  },
  "toggle-outline": {
    labelKey: "view.toggleOutline",
    run: () => useUi.getState().toggleOutline(),
  },
  "edit-view": {
    labelKey: "view.editMode",
    run: () => useUi.getState().setViewMode("edit"),
  },
  "reading-mode": {
    labelKey: "view.readingMode",
    run: () => useUi.getState().toggleReading(),
  },
  "source-mode": {
    labelKey: "view.sourceMode",
    run: () => useUi.getState().toggleSource(),
  },
  "distraction-free": {
    labelKey: "view.distractionFree",
    run: () => useUi.getState().toggleDistractionFree(),
  },
  "focus-file-tree": {
    labelKey: "view.focusFileTree",
    group: "view",
    run: () => focusFileTree(),
  },
  "focus-notifications": {
    labelKey: "view.focusNotifications",
    group: "view",
    run: () => focusNewestToast(),
  },
  // Deliberate, so it opens folders even when following the active document is
  // off or the user closed the branch by hand.
  "reveal-in-file-tree": {
    labelKey: "view.revealInFileTree",
    group: "view",
    run: () => revealActiveDocument(),
  },
  "move-tab-left": {
    labelKey: "view.moveTabLeft",
    group: "view",
    run: () => useDocuments.getState().moveActiveTab(-1),
  },
  "move-tab-right": {
    labelKey: "view.moveTabRight",
    group: "view",
    run: () => useDocuments.getState().moveActiveTab(1),
  },
  "toggle-auto-save": {
    labelKey: "app.toggleAutoSave",
    group: "app",
    run: () => toggleAutoSave(),
  },
  "help-shortcuts": {
    labelKey: "help.keyboardShortcuts",
    // The panel's own deep-link argument exists for exactly this: without it the
    // app's only documentation entry point lands on Appearance.
    run: () => useSettingsPanel.getState().open("shortcuts"),
  },
  "help-licenses": {
    labelKey: "help.licenses",
    run: () => useNoticesDialog.getState().open(),
  },
  "format-bold": {
    labelKey: "format.bold",
    run: () => runFormatCommand(toggleStrongCommand.key),
  },
  "format-italic": {
    labelKey: "format.italic",
    run: () => runFormatCommand(toggleEmphasisCommand.key),
  },
  "format-strikethrough": {
    labelKey: "format.strikethrough",
    run: () => runFormatCommand(toggleStrikethroughCommand.key),
  },
  "format-code": {
    labelKey: "format.code",
    run: () => runFormatCommand(toggleInlineCodeCommand.key),
  },
  "format-link": {
    labelKey: "format.link",
    run: () => runFormatCommand(toggleLinkCommand.key),
  },
  "format-footnote": {
    labelKey: "format.footnote",
    run: () => runInsertFootnote(),
  },
  "format-h1": {
    labelKey: "format.heading1",
    run: () => runFormatCommand(wrapInHeadingCommand.key, 1),
  },
  "format-h2": {
    labelKey: "format.heading2",
    run: () => runFormatCommand(wrapInHeadingCommand.key, 2),
  },
  "format-h3": {
    labelKey: "format.heading3",
    run: () => runFormatCommand(wrapInHeadingCommand.key, 3),
  },
  "format-h4": {
    labelKey: "format.heading4",
    run: () => runFormatCommand(wrapInHeadingCommand.key, 4),
  },
  "format-h5": {
    labelKey: "format.heading5",
    run: () => runFormatCommand(wrapInHeadingCommand.key, 5),
  },
  "format-h6": {
    labelKey: "format.heading6",
    run: () => runFormatCommand(wrapInHeadingCommand.key, 6),
  },
  "format-paragraph": {
    labelKey: "format.paragraph",
    run: () => runFormatCommand(turnIntoTextCommand.key),
  },
} as const satisfies Record<string, Omit<CommandDef, "id">>;

/** The registry: each definition above, with its key as its `id`. The cast is sound because `id === key` by construction (commands.test.ts enforces it). */
export const COMMANDS = Object.fromEntries(
  Object.entries(COMMAND_DEFS).map(([id, def]) => [id, { ...def, id }]),
) as { [K in keyof typeof COMMAND_DEFS]: (typeof COMMAND_DEFS)[K] & { id: K } };

export type CommandId = keyof typeof COMMANDS;
