import { act, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The palette pulls in the editor commands and every file operation at module
// load; none of them are what these tests are about.
vi.mock("@/lib/tauri/workspace", () => ({ listMarkdownFiles: vi.fn() }));
vi.mock("@/editor/run-format-command", () => ({ runFormatCommand: vi.fn() }));
vi.mock("@/editor/footnotes", () => ({ runInsertFootnote: vi.fn() }));
vi.mock("@/features/file-ops/file-ops", () => ({
  newFile: vi.fn(),
  openFile: vi.fn(),
  openPath: vi.fn(),
  saveActiveDocument: vi.fn(),
  saveActiveDocumentAs: vi.fn(),
}));
vi.mock("@/features/file-tree/workspace-ops", () => ({
  openFolder: vi.fn(),
  openRecentFolder: vi.fn(),
}));
vi.mock("@/features/updates/check-updates", () => ({ checkForUpdates: vi.fn() }));
vi.mock("@/features/notifications/focus-toast", () => ({ focusNewestToast: vi.fn() }));
vi.mock("@/features/file-sync/toggle-auto-save", () => ({ toggleAutoSave: vi.fn() }));
vi.mock("@/features/export/export-ops", () => ({
  copyActiveDocumentAsHtml: vi.fn(),
  copyActiveDocumentAsMarkdown: vi.fn(),
  exportActiveDocumentHtml: vi.fn(),
  printActiveDocument: vi.fn(),
}));

import i18n from "@/i18n";
import { COMMANDS } from "@/app/menu/commands";
import { KEY_ACTIONS, formatCombo, useKeybindings } from "@/features/settings/keybindings";
import { focusNewestToast } from "@/features/notifications/focus-toast";
import { listMarkdownFiles } from "@/lib/tauri/workspace";
import { useFileActions } from "@/features/file-tree/file-actions";
import { useDocuments } from "@/stores/document";
import { useWorkspace } from "@/stores/workspace";

import { CommandPalette } from "./CommandPalette";
import { useRecentCommands } from "./recent-commands";
import { useCommandPalette } from "./use-command-palette";

/**
 * The truncation note shipped untested because nothing here ever mounted the
 * palette — and it is the one line standing between a capped index and a list
 * that ends at "m" while looking like the whole workspace.
 */
describe("CommandPalette quick-open", () => {
  const files = [
    { name: "README.md", path: "/root/README.md" },
    { name: "docs/guide.md", path: "/root/docs/guide.md" },
  ];

  const openPalette = async () => {
    render(<CommandPalette />);
    await act(async () => {
      useCommandPalette.getState().open();
      await Promise.resolve();
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useCommandPalette.setState({ isOpen: false });
    useWorkspace.setState({ rootPath: "/root" });
  });

  it("says the index stopped at its cap instead of implying it is the workspace", async () => {
    vi.mocked(listMarkdownFiles).mockResolvedValue({ files, truncated: true, skipped: 0 });

    await openPalette();

    await waitFor(() => expect(screen.getByText("README.md")).toBeInTheDocument());
    const note = screen.getByRole("note");
    expect(note).toHaveTextContent(/first 2/i);
  });

  it("stays quiet when the index is the whole workspace", async () => {
    vi.mocked(listMarkdownFiles).mockResolvedValue({ files, truncated: false, skipped: 0 });

    await openPalette();

    await waitFor(() => expect(screen.getByText("README.md")).toBeInTheDocument());
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });
});

describe("CommandPalette recent commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCommandPalette.setState({ isOpen: false });
    useWorkspace.setState({ rootPath: null });
  });

  it("skips recent ids of commands that no longer exist", async () => {
    // `splitEditor` was removed with the split editor; a recency list that still
    // names it must render the live commands and nothing else.
    useRecentCommands.setState({ recent: ["splitEditor", "toggle-sidebar"] });

    render(<CommandPalette />);
    await act(async () => {
      useCommandPalette.getState().open();
      await Promise.resolve();
    });

    expect(await screen.findByText("Toggle Sidebar")).toBeInTheDocument();
    expect(screen.queryByText("Split editor")).not.toBeInTheDocument();
  });

  it("offers no accent picker (Settings owns the accent)", async () => {
    useRecentCommands.setState({ recent: ["changeAccent", "toggle-sidebar"] });

    render(<CommandPalette />);
    await act(async () => {
      useCommandPalette.getState().open();
      await Promise.resolve();
    });

    expect(await screen.findByText("Toggle Sidebar")).toBeInTheDocument();
    expect(screen.queryByText(/accent/i)).not.toBeInTheDocument();
  });

  it("reaches the notifications from the keyboard", async () => {
    render(<CommandPalette />);
    await act(async () => {
      useCommandPalette.getState().open();
      await Promise.resolve();
    });

    (await screen.findByText("Focus Notifications")).click();

    expect(focusNewestToast).toHaveBeenCalledOnce();
  });
});

describe("CommandPalette rename folder", () => {
  const openPalette = async () => {
    render(<CommandPalette />);
    await act(async () => {
      useCommandPalette.getState().open();
      await Promise.resolve();
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useCommandPalette.setState({ isOpen: false });
    useRecentCommands.setState({ recent: [] });
  });

  it("renames the workspace root from the keyboard", async () => {
    vi.mocked(listMarkdownFiles).mockResolvedValue({ files: [], truncated: false, skipped: 0 });
    useWorkspace.setState({ rootPath: "/root" });
    const startRename = vi.spyOn(useFileActions.getState(), "startRename");

    await openPalette();
    (await screen.findByText("Rename Folder")).click();

    expect(startRename).toHaveBeenCalledWith("/root");
  });

  it("is offered only when a workspace is open", async () => {
    useWorkspace.setState({ rootPath: null });

    await openPalette();

    expect(await screen.findByText("Toggle Sidebar")).toBeInTheDocument();
    expect(screen.queryByText("Rename Folder")).not.toBeInTheDocument();
  });
});

describe("CommandPalette shortcut hints", () => {
  const tMenu = i18n.getFixedT("en", "menu") as unknown as (key: string) => string;
  const openPalette = async () => {
    render(<CommandPalette />);
    await act(async () => {
      useCommandPalette.getState().open();
      await Promise.resolve();
    });
  };
  const optionText = async (labelKey: string) => {
    const label = tMenu(labelKey);
    // The label, then its hint if any: "Save" must not find "Save As…".
    const option = await screen.findByRole("option", {
      name: new RegExp(`^${label}( Ctrl\\S*)?$`),
    });
    return { label, text: option.textContent };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useCommandPalette.setState({ isOpen: false });
    useRecentCommands.setState({ recent: [] });
    useWorkspace.setState({ rootPath: null });
    useKeybindings.getState().resetAll();
  });

  it("shows each command's keymap binding as its hint", async () => {
    // The hints used to come from a hand-copied table that had drifted (V1-11).
    await openPalette();

    const { bindings } = useKeybindings.getState();
    for (const action of KEY_ACTIONS) {
      if (action.command === "command-palette") continue; // not offered in itself
      const { label, text } = await optionText(COMMANDS[action.command].labelKey);
      const combo = bindings[action.id];
      expect(text, action.id).toBe(combo ? `${label}${formatCombo(combo)}` : label);
    }
  });

  it("does not advertise the focus-file-tree key on Export HTML", async () => {
    await openPalette();

    const exportHtml = await optionText("file.export.html");
    expect(exportHtml.text).toBe(exportHtml.label);
    const focusTree = await optionText("view.focusFileTree");
    expect(focusTree.text).toBe(`${focusTree.label}${formatCombo("mod+shift+e")}`);
  });

  it("follows a remapped shortcut", async () => {
    useKeybindings.getState().setBinding("sidebar", "mod+alt+b");
    await openPalette();

    const { label, text } = await optionText("view.toggleSidebar");
    expect(text).toBe(`${label}${formatCombo("mod+alt+b")}`);
  });
});

describe("CommandPalette open documents (SHELL-10)", () => {
  beforeEach(() => {
    useCommandPalette.setState({ isOpen: false });
    useWorkspace.setState({ rootPath: null });
    useDocuments.setState({ documents: [], activeId: null, tabs: [] });
  });

  it("lists open documents in the tab strip's order, not creation order", async () => {
    const { createDocument, reorderTab } = useDocuments.getState();
    createDocument({ path: "/w/alpha.md", markdown: "" });
    createDocument({ path: "/w/beta.md", markdown: "" });
    const gamma = createDocument({ path: "/w/gamma.md", markdown: "" });
    reorderTab(gamma, 0);

    render(<CommandPalette />);
    await act(async () => {
      useCommandPalette.getState().open();
      await Promise.resolve();
    });

    const group = screen.getByRole("group", { name: i18n.t("editor:palette.openDocuments") });
    const names = within(group)
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(names).toEqual(["gamma.md", "alpha.md", "beta.md"]);
  });
});
