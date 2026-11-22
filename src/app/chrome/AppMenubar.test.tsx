import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/file-ops/file-ops", () => ({
  newFile: vi.fn(),
  openFile: vi.fn(),
  closeTab: vi.fn(),
  saveActiveDocument: vi.fn(),
  saveActiveDocumentAs: vi.fn(),
}));
vi.mock("@/editor/edit-commands", () => ({
  trackEditableFocus: () => () => undefined,
  undo: vi.fn(),
  redo: vi.fn(),
  cut: vi.fn(),
  copy: vi.fn(),
  paste: vi.fn(),
  selectAll: vi.fn(),
}));

import i18n from "@/i18n";
import { paste, undo } from "@/editor/edit-commands";
import { useAboutDialog } from "@/features/about/use-about-dialog";
import { newFile } from "@/features/file-ops/file-ops";
import { useKeybindings } from "@/features/settings/keybindings";

import { AppMenubar } from "./AppMenubar";

describe("AppMenubar", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    useKeybindings.getState().resetAll();
    await i18n.changeLanguage("en");
  });

  it("renders the top-level section triggers", () => {
    render(<AppMenubar />);
    expect(screen.getByRole("menuitem", { name: "File" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "View" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Help" })).toBeInTheDocument();
  });

  it("opens the app's About panel from Help on Windows/Linux", async () => {
    const user = userEvent.setup();
    useAboutDialog.setState({ isOpen: false });
    render(<AppMenubar />);

    await user.click(screen.getByRole("menuitem", { name: "Help" }));
    await user.click(await screen.findByRole("menuitem", { name: "About Asterisco" }));

    expect(useAboutDialog.getState().isOpen).toBe(true);
  });

  it("runs the command behind an item when selected", async () => {
    const user = userEvent.setup();
    render(<AppMenubar />);

    await user.click(screen.getByRole("menuitem", { name: "File" }));
    await user.click(await screen.findByRole("menuitem", { name: /^New/ }));

    expect(newFile).toHaveBeenCalledTimes(1);
  });

  // With the native menu gated to macOS, these items are the only Edit menu
  // Windows/Linux have. Before, `predefinedItem` returned null for every role
  // except minimize/maximize and the whole section quietly collapsed to Find.
  it("renders the edit roles the native menu used to carry", async () => {
    const user = userEvent.setup();
    render(<AppMenubar />);

    await user.click(screen.getByRole("menuitem", { name: "Edit" }));

    for (const label of ["Undo", "Redo", "Cut", "Copy", "Paste", "Select All"]) {
      expect(await screen.findByRole("menuitem", { name: label })).toBeInTheDocument();
    }
  });

  it("routes an edit role to the edit-commands router", async () => {
    const user = userEvent.setup();
    render(<AppMenubar />);

    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    await user.click(await screen.findByRole("menuitem", { name: "Paste" }));

    expect(paste).toHaveBeenCalledTimes(1);
    expect(undo).not.toHaveBeenCalled();
  });

  it("renders Fullscreen in the View menu", async () => {
    const user = userEvent.setup();
    render(<AppMenubar />);

    await user.click(screen.getByRole("menuitem", { name: "View" }));

    expect(await screen.findByRole("menuitem", { name: "Toggle Full Screen" })).toBeInTheDocument();
  });

  // Off macOS there is no native menu: every combo printed here must be one the
  // webview keymap (`use-global-shortcuts`) really dispatches.
  describe("accelerator hints", () => {
    const FILE_ACCELERATORS = [
      { label: "New", combo: "Ctrl+N" },
      { label: "Open…", combo: "Ctrl+O" },
      { label: "Open Folder…", combo: "Ctrl+Shift+O" },
      { label: "Save", combo: "Ctrl+S" },
      { label: "Save As…", combo: "Ctrl+Shift+S" },
      { label: "Print…", combo: "Ctrl+P" },
      { label: "Close Tab", combo: "Ctrl+W" },
    ];

    it.each(FILE_ACCELERATORS)("shows $combo beside $label", async ({ label, combo }) => {
      const user = userEvent.setup();
      render(<AppMenubar />);

      await user.click(screen.getByRole("menuitem", { name: "File" }));
      const item = await screen.findByRole("menuitem", { name: `${label} ${combo}` });

      expect(item.textContent).toBe(`${label}${combo}`);
    });

    it("shows Ctrl+Q beside Quit", async () => {
      const user = userEvent.setup();
      render(<AppMenubar />);

      await user.click(screen.getByRole("menuitem", { name: /Asterisco|Menu/ }));
      const item = await screen.findByRole("menuitem", { name: "Quit Ctrl+Q" });

      expect(item.textContent).toBe("QuitCtrl+Q");
    });

    it("follows a remapped shortcut", async () => {
      useKeybindings.getState().setBinding("newFile", "mod+alt+n");
      const user = userEvent.setup();
      render(<AppMenubar />);

      await user.click(screen.getByRole("menuitem", { name: "File" }));

      expect(await screen.findByRole("menuitem", { name: "New Ctrl+Alt+N" })).toBeInTheDocument();
    });

    // Format items are the other half of the rule: their combos live in the
    // Milkdown keymap, which runs in the webview on every platform, so they are
    // real off macOS and must keep their hint.
    it("keeps the editor-keymap hint on a Format item", async () => {
      const user = userEvent.setup();
      render(<AppMenubar />);

      await user.click(screen.getByRole("menuitem", { name: "Format" }));
      const item = await screen.findByRole("menuitem", { name: /^Bold/ });

      expect(item.textContent).toContain("Ctrl+B");
    });
  });

  it("F10 moves focus to the first menubar trigger", () => {
    render(<AppMenubar />);

    fireEvent.keyDown(window, { key: "F10" });

    const triggers = screen.getAllByRole("menuitem");
    expect(document.activeElement).toBe(triggers[0]);
  });

  it("Escape hands focus back to where it was before F10", () => {
    render(
      <>
        <button type="button">Tree row</button>
        <AppMenubar />
      </>,
    );
    const before = screen.getByRole("button", { name: "Tree row" });
    before.focus();

    fireEvent.keyDown(window, { key: "F10" });
    expect(document.activeElement).toBe(screen.getAllByRole("menuitem")[0]);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(before).toHaveFocus();
  });

  it("Escape falls back to the visible editor when the origin is gone", () => {
    const view = (withOrigin: boolean) => (
      <>
        {withOrigin ? <button type="button">Gone</button> : null}
        <AppMenubar />
        <div id="document-panel" data-view="source">
          {/* The hidden rich editor under Source view must not win. */}
          <div className="milkdown">
            <div className="ProseMirror" contentEditable suppressContentEditableWarning />
          </div>
          <div className="cm-content" tabIndex={-1} data-testid="source" />
        </div>
      </>
    );
    const { rerender } = render(view(true));
    screen.getByRole("button", { name: "Gone" }).focus();
    fireEvent.keyDown(window, { key: "F10" });

    rerender(view(false));
    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.getByTestId("source")).toHaveFocus();
  });
});
