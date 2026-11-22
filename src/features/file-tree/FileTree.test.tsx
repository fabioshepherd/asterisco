import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/tauri/fs", () => ({
  readDir: vi.fn(),
  moveToTrash: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/tauri/workspace", () => ({ listMarkdownFiles: vi.fn() }));
vi.mock("@/features/file-ops/file-ops", () => ({ openPath: vi.fn() }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ confirm: vi.fn().mockResolvedValue(true) }));

import "@/i18n";
import { openPath } from "@/features/file-ops/file-ops";
import { moveToTrash, readDir, type DirEntry, type DirListing } from "@/lib/tauri/fs";
import { listMarkdownFiles } from "@/lib/tauri/workspace";
import { useDocuments } from "@/stores/document";
import { useSettings } from "@/stores/settings";
import { useWorkspace } from "@/stores/workspace";

import { FileTree } from "./FileTree";
import { revealActiveDocument, useTreeFocus } from "./focus-tree";
import { useTreeExpansion } from "./tree-expansion";
import { useTreeMenu } from "./use-tree-menu";

/** The focusable element is the treeitem itself (WAI-ARIA APG), not an inner button. */
const rowFor = (label: string) =>
  screen.getByText(label).closest('[role="treeitem"]') as HTMLElement;

/**
 * What `read_dir` answers with: the rows, plus how much of the folder they are.
 * `total` defaults to the rows themselves — the ordinary case, where nothing was
 * dropped and nothing was left unexamined.
 */
const listing = (entries: DirEntry[], extra?: Partial<DirListing>): DirListing => ({
  entries,
  total: entries.length,
  scanned: entries.length,
  ...extra,
});

const renderTree = (rootPath: string, filter?: string) =>
  render(<FileTree rootPath={rootPath} filter={filter} />);

beforeEach(() => {
  vi.clearAllMocks();
  useSettings.setState({ showIgnoredFolders: false, revealActiveFile: true });
  useTreeMenu.setState({ target: null });
  useWorkspace.setState({ rootPath: "/root", revealPaths: new Set(), revealToken: 0 });
  useDocuments.setState({ documents: [], activeId: null });
  // Expansion now lives outside the components so it survives an unmount; that
  // makes it shared state a test has to clear like any other store.
  useTreeExpansion.setState({ expanded: {} });
  useTreeFocus.setState({ token: 0 });
});

describe("FileTree", () => {
  it("lists markdown files and folders, hiding others, and opens a file on click", async () => {
    vi.mocked(readDir).mockResolvedValue(
      listing([
        { name: "notes.md", path: "/root/notes.md", isDir: false },
        { name: "sub", path: "/root/sub", isDir: true },
        { name: "image.png", path: "/root/image.png", isDir: false },
      ]),
    );

    renderTree("/root");

    await waitFor(() => expect(screen.getByText("notes.md")).toBeInTheDocument());
    expect(screen.getByText("sub")).toBeInTheDocument();
    expect(screen.queryByText("image.png")).not.toBeInTheDocument();
    // The root travels with the request: a single directory listing has no walk
    // to carry the `.gitignore` files between the workspace and this folder.
    expect(readDir).toHaveBeenCalledWith("/root", "/root");

    await userEvent.setup().click(screen.getByText("notes.md"));
    expect(openPath).toHaveBeenCalledWith("/root/notes.md");
  });

  it("hides folders Rust flagged as ignored, and re-filters in memory when the setting flips", async () => {
    vi.mocked(readDir).mockResolvedValue(
      listing([
        { name: "node_modules", path: "/root/node_modules", isDir: true, ignored: true },
        { name: ".github", path: "/root/.github", isDir: true, ignored: false },
        { name: "notes.md", path: "/root/notes.md", isDir: false, ignored: false },
      ]),
    );

    renderTree("/root");
    await waitFor(() => expect(screen.getByText("notes.md")).toBeInTheDocument());
    // Agent folders are dot-prefixed and must stay: they are the product's scope.
    expect(screen.getByText(".github")).toBeInTheDocument();
    expect(screen.queryByText("node_modules")).not.toBeInTheDocument();
    expect(readDir).toHaveBeenCalledTimes(1);

    await act(async () => {
      useSettings.setState({ showIgnoredFolders: true });
      await Promise.resolve();
    });

    expect(await screen.findByText("node_modules")).toBeInTheDocument();
    // No second trip to disk: the setting only decides what is shown.
    expect(readDir).toHaveBeenCalledTimes(1);
  });

  it("shows the new folder's files after switching workspace, not the old one's", async () => {
    vi.mocked(readDir).mockImplementation((path: string) => {
      if (path === "/a")
        return Promise.resolve(listing([{ name: "a.md", path: "/a/a.md", isDir: false }]));
      return Promise.resolve(listing([{ name: "b.md", path: "/b/b.md", isDir: false }]));
    });

    const view = renderTree("/a");
    await waitFor(() => expect(screen.getByText("a.md")).toBeInTheDocument());

    // Reconciling onto the previous root would keep A's children — and Delete
    // would then be aimed at a file from a workspace that is no longer open.
    view.rerender(<FileTree rootPath="/b" />);

    expect(await screen.findByText("b.md")).toBeInTheDocument();
    expect(screen.queryByText("a.md")).not.toBeInTheDocument();
  });

  it("lazily loads a folder's children when expanded", async () => {
    vi.mocked(readDir).mockImplementation((path: string) => {
      if (path === "/root")
        return Promise.resolve(listing([{ name: "sub", path: "/root/sub", isDir: true }]));
      if (path === "/root/sub")
        return Promise.resolve(
          listing([{ name: "child.md", path: "/root/sub/child.md", isDir: false }]),
        );
      return Promise.resolve(listing([]));
    });

    renderTree("/root");
    await waitFor(() => expect(screen.getByText("sub")).toBeInTheDocument());
    expect(screen.queryByText("child.md")).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getByText("sub"));
    await waitFor(() => expect(screen.getByText("child.md")).toBeInTheDocument());
  });

  it("distinguishes an empty folder, a folder with no documents, and one it cannot read", async () => {
    vi.mocked(readDir).mockImplementation((path: string) => {
      if (path === "/root")
        return Promise.resolve(
          listing([
            { name: "empty", path: "/root/empty", isDir: true },
            { name: "code", path: "/root/code", isDir: true },
            { name: "built", path: "/root/built", isDir: true },
            { name: "locked", path: "/root/locked", isDir: true },
          ]),
        );
      if (path === "/root/empty") return Promise.resolve(listing([]));
      if (path === "/root/code")
        return Promise.resolve(
          listing([{ name: "main.rs", path: "/root/code/main.rs", isDir: false }]),
        );
      if (path === "/root/built")
        return Promise.resolve(
          listing([{ name: "dist", path: "/root/built/dist", isDir: true, ignored: true }]),
        );
      // The shape `invoke` actually rejects with (a serialized `AppError`), not
      // an `Error` — rejecting with an Error here would exercise a branch of
      // `localizeAppError` that production never reaches.
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      return Promise.reject({
        kind: "permissionDenied",
        message: "Permission denied (os error 13)",
        path: "/root/locked",
      });
    });

    renderTree("/root");
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByText("empty")).toBeInTheDocument());

    await user.click(screen.getByText("empty"));
    expect(await screen.findByText("Empty folder")).toBeInTheDocument();

    // A folder full of source files is not empty — saying so would be a false
    // statement about the user's disk, one keystroke from Delete.
    await user.click(screen.getByText("code"));
    expect(await screen.findByText("No documents here")).toBeInTheDocument();

    // Nothing but build output is not an empty folder either.
    await user.click(screen.getByText("built"));
    await waitFor(() => expect(screen.getAllByText("No documents here")).toHaveLength(2));

    // Not "a file-system error occurred": the row names the folder and the
    // errno, prints the path under it in mono, and keeps the raw OS text on
    // hover for a bug report.
    await user.click(screen.getByText("locked"));
    const failed = (await screen.findByText("Couldn’t read locked: permission denied")).closest(
      '[role="treeitem"]',
    ) as HTMLElement;
    expect(failed).toHaveTextContent("locked");
    expect(failed).toHaveAttribute("title", "/root/locked: Permission denied (os error 13)");
    // Visible and spoken are the same sentence, plus the path and the action.
    expect(failed).toHaveAttribute(
      "aria-label",
      "Couldn’t read locked: permission denied — locked — Try again",
    );
  });

  it("keeps a tab stop when the root itself has only a state row", async () => {
    vi.mocked(readDir).mockResolvedValue(listing([]));

    renderTree("/root");

    const row = await screen.findByText("Empty folder");
    expect(row.closest('[role="treeitem"]')).toHaveAttribute("tabindex", "0");
  });

  it("reads a folder again after a failure, without reloading the tree", async () => {
    let attempts = 0;
    vi.mocked(readDir).mockImplementation((path: string) => {
      if (path === "/root")
        return Promise.resolve(listing([{ name: "docs", path: "/root/docs", isDir: true }]));
      attempts += 1;
      if (attempts === 1) {
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        return Promise.reject({ kind: "permissionDenied", message: "denied", path });
      }
      return Promise.resolve(
        listing([{ name: "adr.md", path: "/root/docs/adr.md", isDir: false }]),
      );
    });

    renderTree("/root");
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByText("docs")).toBeInTheDocument());
    await user.click(screen.getByText("docs"));

    const row = await screen.findByLabelText(/Couldn’t read docs/);
    // Actionable, so not aria-disabled — and the action is in its name, because
    // the icon beside it is decoration.
    expect(row).not.toHaveAttribute("aria-disabled");
    expect(row).toHaveAttribute("aria-label", expect.stringContaining("Try again"));

    // From the keyboard, on the row itself: a button nested in a treeitem would
    // break the tree's focus contract.
    row.focus();
    await user.keyboard("{Enter}");

    expect(await screen.findByText("adr.md")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Couldn’t read docs/)).not.toBeInTheDocument();
  });

  it("says how far it looked into a folder too large to list in one go", async () => {
    vi.mocked(readDir).mockImplementation((path: string) => {
      if (path === "/root")
        return Promise.resolve(listing([{ name: "huge", path: "/root/huge", isDir: true }]));
      return Promise.resolve(
        listing([{ name: "a.md", path: "/root/huge/a.md", isDir: false }], {
          total: 50000,
          scanned: 2000,
        }),
      );
    });

    renderTree("/root");
    await waitFor(() => expect(screen.getByText("huge")).toBeInTheDocument());
    await userEvent.setup().click(screen.getByText("huge"));

    expect(await screen.findByText(/first 2000 of 50000 entries/i)).toBeInTheDocument();
    expect(screen.getByText("a.md")).toBeInTheDocument();
  });

  it("does not call a folder empty when it only stopped looking", async () => {
    vi.mocked(readDir).mockImplementation((path: string) => {
      if (path === "/root")
        return Promise.resolve(listing([{ name: "huge", path: "/root/huge", isDir: true }]));
      // 2,000 entries examined, not one of them a document — which says nothing
      // about the 48,000 that were not looked at.
      return Promise.resolve(listing([], { total: 50000, scanned: 2000 }));
    });

    renderTree("/root");
    await waitFor(() => expect(screen.getByText("huge")).toBeInTheDocument());
    await userEvent.setup().click(screen.getByText("huge"));

    expect(await screen.findByText(/first 2000 of 50000 entries/i)).toBeInTheDocument();
    expect(screen.queryByText("No documents here")).not.toBeInTheDocument();
    expect(screen.queryByText("Empty folder")).not.toBeInTheDocument();
  });

  it("tells an agent brief and a README apart from an ordinary note", async () => {
    vi.mocked(readDir).mockResolvedValue(
      listing([
        { name: "CLAUDE.md", path: "/root/CLAUDE.md", isDir: false },
        { name: "README.md", path: "/root/README.md", isDir: false },
        { name: "notes.md", path: "/root/notes.md", isDir: false },
        { name: "commit.md", path: "/root/.claude/commands/commit.md", isDir: false },
      ]),
    );

    renderTree("/root");
    await waitFor(() => expect(screen.getByText("notes.md")).toBeInTheDocument());

    // The glyph is the on-screen distinction, so the accessible name is the
    // only place a screen-reader user can hear it.
    expect(rowFor("CLAUDE.md")).toHaveAttribute("aria-label", "CLAUDE.md, agent instructions");
    // Everything a tool keeps in `.claude/` is addressed to it, whatever it is called.
    expect(rowFor("commit.md")).toHaveAttribute("aria-label", "commit.md, agent instructions");
    expect(rowFor("notes.md")).toHaveAttribute("aria-label", "notes.md");
    // A README needs no suffix: its name already is the announcement, and the
    // emphasis it carries is weight, not words.
    expect(rowFor("README.md")).toHaveAttribute("aria-label", "README.md");
    expect(screen.getByText("README.md")).toHaveClass("font-medium");
    expect(screen.getByText("notes.md")).not.toHaveClass("font-medium");
  });

  it("marks the open document with aria-current, not aria-selected", async () => {
    vi.mocked(readDir).mockResolvedValue(
      listing([
        { name: "a.md", path: "/root/a.md", isDir: false },
        { name: "b.md", path: "/root/b.md", isDir: false },
      ]),
    );
    useDocuments.setState({
      documents: [
        {
          id: "1",
          path: "/root/b.md",
          markdown: "",
          savedMarkdown: "",
          isDirty: false,
        } as never,
      ],
      activeId: "1",
    });

    renderTree("/root");
    await waitFor(() => expect(screen.getByText("b.md")).toBeInTheDocument());

    // "true", not "page": a file in a tree is not a page in a set of pages.
    expect(rowFor("b.md")).toHaveAttribute("aria-current", "true");
    expect(rowFor("a.md")).not.toHaveAttribute("aria-current");
    expect(rowFor("b.md")).not.toHaveAttribute("aria-selected");
    // The current row is a muted row, not a signal fill (DESIGN.md §2).
    const currentRow = rowFor("b.md").firstElementChild;
    expect(currentRow).toHaveClass("bg-muted", "font-medium", "text-fg");
    expect(currentRow).not.toHaveClass("bg-primary");
  });

  it("rings only the focused row, not the rows nested below a folder", async () => {
    vi.mocked(readDir).mockImplementation((path: string) => {
      if (path === "/root")
        return Promise.resolve(listing([{ name: "docs", path: "/root/docs", isDir: true }]));
      return Promise.resolve(
        listing([{ name: "adr.md", path: "/root/docs/adr.md", isDir: false }]),
      );
    });
    useTreeExpansion.setState({ expanded: { "/root/docs": true } });

    renderTree("/root");
    await waitFor(() => expect(screen.getByText("adr.md")).toBeInTheDocument());

    // The ring is scoped to the item's direct row (`>div`); a group variant on
    // the folder's `<li>` would have matched the nested file row as well.
    for (const item of screen.getAllByRole("treeitem")) {
      expect(item.className).toContain("[&:focus-visible>div]:outline-2");
      expect(item.innerHTML).not.toContain("group-focus-visible");
    }
  });

  it("reveals the active document by opening the folders above it", async () => {
    vi.mocked(readDir).mockImplementation((path: string) => {
      if (path === "/root")
        return Promise.resolve(listing([{ name: "docs", path: "/root/docs", isDir: true }]));
      if (path === "/root/docs")
        return Promise.resolve(
          listing([{ name: "adr.md", path: "/root/docs/adr.md", isDir: false }]),
        );
      return Promise.resolve(listing([]));
    });

    renderTree("/root");
    await waitFor(() => expect(screen.getByText("docs")).toBeInTheDocument());
    expect(screen.queryByText("adr.md")).not.toBeInTheDocument();

    // Opened from a tab / quick-open / search rather than from the tree.
    await act(async () => {
      useDocuments.setState({
        documents: [
          {
            id: "1",
            path: "/root/docs/adr.md",
            markdown: "",
            savedMarkdown: "",
            isDirty: false,
          } as never,
        ],
        activeId: "1",
      });
      await Promise.resolve();
    });

    expect(await screen.findByText("adr.md")).toBeInTheDocument();
  });

  it("leaves a manually collapsed folder alone when the document beneath it opens", async () => {
    vi.mocked(readDir).mockImplementation((path: string) => {
      if (path === "/root")
        return Promise.resolve(listing([{ name: "docs", path: "/root/docs", isDir: true }]));
      return Promise.resolve(
        listing([{ name: "adr.md", path: "/root/docs/adr.md", isDir: false }]),
      );
    });

    renderTree("/root");
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByText("docs")).toBeInTheDocument());

    await user.click(screen.getByText("docs"));
    await waitFor(() => expect(screen.getByText("adr.md")).toBeInTheDocument());
    await user.click(screen.getByText("docs"));
    await waitFor(() => expect(screen.queryByText("adr.md")).not.toBeInTheDocument());

    // Reveal used to force the branch open, so every tab switch beneath a
    // folder undid the user's collapse.
    await act(async () => {
      useDocuments.setState({
        documents: [{ id: "1", path: "/root/docs/adr.md" } as never],
        activeId: "1",
      });
      await Promise.resolve();
    });
    expect(screen.queryByText("adr.md")).not.toBeInTheDocument();

    // Asking for it on purpose still works — otherwise there would be no way back.
    await act(async () => {
      revealActiveDocument();
      await Promise.resolve();
    });
    expect(await screen.findByText("adr.md")).toBeInTheDocument();
  });

  it("stops following the active document when the setting is off", async () => {
    useSettings.setState({ revealActiveFile: false });
    vi.mocked(readDir).mockImplementation((path: string) => {
      if (path === "/root")
        return Promise.resolve(listing([{ name: "docs", path: "/root/docs", isDir: true }]));
      return Promise.resolve(
        listing([{ name: "adr.md", path: "/root/docs/adr.md", isDir: false }]),
      );
    });

    renderTree("/root");
    await waitFor(() => expect(screen.getByText("docs")).toBeInTheDocument());

    await act(async () => {
      useDocuments.setState({
        documents: [{ id: "1", path: "/root/docs/adr.md" } as never],
        activeId: "1",
      });
      await Promise.resolve();
    });

    expect(screen.queryByText("adr.md")).not.toBeInTheDocument();
  });

  it("lets the keyboard reach the rows that report a state, and names them", async () => {
    vi.mocked(readDir).mockImplementation((path: string) => {
      if (path === "/root")
        return Promise.resolve(listing([{ name: "empty", path: "/root/empty", isDir: true }]));
      return Promise.resolve(listing([]));
    });

    renderTree("/root");
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByText("empty")).toBeInTheDocument());
    await user.click(screen.getByText("empty"));

    const row = (await screen.findByText("Empty folder")).closest(
      '[role="treeitem"]',
    ) as HTMLElement;
    // Was role="none", so arrow nav skipped it and a reader heard "expanded"
    // followed by nothing at all.
    expect(row).toHaveAttribute("aria-label", "Empty folder");
    expect(row).toHaveAttribute("aria-disabled", "true");
    // Navigable, but not a path: Delete must not mistake it for a file.
    expect(row).not.toHaveAttribute("data-tree-path");

    rowFor("empty").focus();
    await user.keyboard("{ArrowDown}");
    expect(row).toHaveFocus();

    await user.keyboard("{Delete}");
    expect(moveToTrash).not.toHaveBeenCalled();
  });

  it("moves focus between siblings with Arrow Up/Down (roving tabindex)", async () => {
    vi.mocked(readDir).mockResolvedValue(
      listing([
        { name: "a.md", path: "/root/a.md", isDir: false },
        { name: "b.md", path: "/root/b.md", isDir: false },
      ]),
    );

    renderTree("/root");
    await waitFor(() => expect(screen.getByText("a.md")).toBeInTheDocument());

    const user = userEvent.setup();
    rowFor("a.md").focus();
    expect(rowFor("a.md")).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(rowFor("b.md")).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(rowFor("a.md")).toHaveFocus();
    await user.keyboard("{ArrowDown}");

    // Roving: only the focused node is a tab stop.
    expect(rowFor("b.md")).toHaveAttribute("tabindex", "0");
    expect(rowFor("a.md")).toHaveAttribute("tabindex", "-1");
  });

  it("expands with ArrowRight and collapses with ArrowLeft", async () => {
    vi.mocked(readDir).mockImplementation((path: string) => {
      if (path === "/root")
        return Promise.resolve(listing([{ name: "sub", path: "/root/sub", isDir: true }]));
      if (path === "/root/sub")
        return Promise.resolve(
          listing([{ name: "child.md", path: "/root/sub/child.md", isDir: false }]),
        );
      return Promise.resolve(listing([]));
    });

    renderTree("/root");
    await waitFor(() => expect(screen.getByText("sub")).toBeInTheDocument());

    const user = userEvent.setup();
    rowFor("sub").focus();
    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(screen.getByText("child.md")).toBeInTheDocument());

    rowFor("sub").focus();
    await user.keyboard("{ArrowLeft}");
    await waitFor(() => expect(screen.queryByText("child.md")).not.toBeInTheDocument());
  });

  it("opens a file from the keyboard with Enter", async () => {
    vi.mocked(readDir).mockResolvedValue(
      listing([{ name: "a.md", path: "/root/a.md", isDir: false }]),
    );

    renderTree("/root");
    await waitFor(() => expect(screen.getByText("a.md")).toBeInTheDocument());

    rowFor("a.md").focus();
    await userEvent.setup().keyboard("{Enter}");
    expect(openPath).toHaveBeenCalledWith("/root/a.md");
  });

  it("opens the context menu from the keyboard (Shift+F10)", async () => {
    vi.mocked(readDir).mockResolvedValue(
      listing([{ name: "a.md", path: "/root/a.md", isDir: false }]),
    );

    renderTree("/root");
    await waitFor(() => expect(screen.getByText("a.md")).toBeInTheDocument());

    const user = userEvent.setup();
    rowFor("a.md").focus();
    await user.keyboard("{Shift>}{F10}{/Shift}");

    expect(useTreeMenu.getState().target).toMatchObject({ path: "/root/a.md", isDir: false });
  });

  it("jumps to the next node matching the typed prefix (type-to-jump)", async () => {
    vi.mocked(readDir).mockResolvedValue(
      listing([
        { name: "alpha.md", path: "/root/alpha.md", isDir: false },
        { name: "beta.md", path: "/root/beta.md", isDir: false },
      ]),
    );

    renderTree("/root");
    await waitFor(() => expect(screen.getByText("beta.md")).toBeInTheDocument());

    const user = userEvent.setup();
    rowFor("alpha.md").focus();
    await user.keyboard("b");
    expect(rowFor("beta.md")).toHaveFocus();
  });

  it("keeps a deep branch open after the folder above it is closed and reopened", async () => {
    vi.mocked(readDir).mockImplementation((path: string) => {
      if (path === "/root")
        return Promise.resolve(listing([{ name: "docs", path: "/root/docs", isDir: true }]));
      if (path === "/root/docs")
        return Promise.resolve(listing([{ name: "adr", path: "/root/docs/adr", isDir: true }]));
      if (path === "/root/docs/adr")
        return Promise.resolve(
          listing([{ name: "001.md", path: "/root/docs/adr/001.md", isDir: false }]),
        );
      return Promise.resolve(listing([]));
    });

    renderTree("/root");
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByText("docs")).toBeInTheDocument());
    await user.click(screen.getByText("docs"));
    await waitFor(() => expect(screen.getByText("adr")).toBeInTheDocument());
    await user.click(screen.getByText("adr"));
    await waitFor(() => expect(screen.getByText("001.md")).toBeInTheDocument());

    // Closing `docs` unmounts everything under it. With the flag in local state
    // that erased `adr`'s expansion, so reopening gave back a bare folder.
    await user.click(screen.getByText("docs"));
    await waitFor(() => expect(screen.queryByText("adr")).not.toBeInTheDocument());
    await user.click(screen.getByText("docs"));

    expect(await screen.findByText("001.md")).toBeInTheDocument();
  });

  it("collapses every folder but the root, and leaves the root navigable", async () => {
    vi.mocked(readDir).mockImplementation((path: string) => {
      if (path === "/root")
        return Promise.resolve(listing([{ name: "docs", path: "/root/docs", isDir: true }]));
      return Promise.resolve(
        listing([{ name: "adr.md", path: "/root/docs/adr.md", isDir: false }]),
      );
    });

    renderTree("/root");
    await waitFor(() => expect(screen.getByText("docs")).toBeInTheDocument());
    await userEvent.setup().click(screen.getByText("docs"));
    await waitFor(() => expect(screen.getByText("adr.md")).toBeInTheDocument());

    act(() => useTreeExpansion.getState().collapseAll("/root"));

    await waitFor(() => expect(screen.queryByText("adr.md")).not.toBeInTheDocument());
    expect(screen.getByText("docs")).toBeInTheDocument();
  });

  it("puts focus on the tree when one is requested", async () => {
    vi.mocked(readDir).mockResolvedValue(
      listing([{ name: "a.md", path: "/root/a.md", isDir: false }]),
    );

    renderTree("/root");
    await waitFor(() => expect(screen.getByText("a.md")).toBeInTheDocument());
    expect(rowFor("a.md")).not.toHaveFocus();

    act(() => useTreeFocus.getState().request());

    expect(rowFor("a.md")).toHaveFocus();
  });

  it("lists the root's children directly: the header names the workspace once", async () => {
    vi.mocked(readDir).mockResolvedValue(
      listing([
        { name: "a.md", path: "/root/a.md", isDir: false },
        { name: "b.md", path: "/root/b.md", isDir: false },
      ]),
    );

    renderTree("/root");
    await waitFor(() => expect(screen.getByText("a.md")).toBeInTheDocument());

    // No row for the root, so Delete can never reach the workspace folder.
    expect(screen.queryByText("root")).not.toBeInTheDocument();
    expect(screen.getAllByRole("treeitem")).toHaveLength(2);
    // The first top-level row holds the tab stop until another row takes it.
    expect(rowFor("a.md")).toHaveAttribute("tabindex", "0");
    expect(rowFor("b.md")).toHaveAttribute("tabindex", "-1");
  });

  it("moves the focused entry to the trash with Delete, and never with Backspace", async () => {
    vi.mocked(readDir).mockResolvedValue(
      listing([
        { name: "a.md", path: "/root/a.md", isDir: false },
        { name: "b.md", path: "/root/b.md", isDir: false },
      ]),
    );

    renderTree("/root");
    await waitFor(() => expect(screen.getByText("a.md")).toBeInTheDocument());

    const user = userEvent.setup();
    rowFor("a.md").focus();

    // Backspace edits the typeahead buffer; it must not reach the trash.
    await user.keyboard("{Backspace}");
    expect(moveToTrash).not.toHaveBeenCalled();

    await user.keyboard("{Delete}");
    await waitFor(() => expect(moveToTrash).toHaveBeenCalledTimes(1));
    expect(moveToTrash).toHaveBeenCalledWith("/root/a.md");
  });
});

describe("FileTree filter", () => {
  const index = {
    files: [
      { name: "README.md", path: "/root/README.md" },
      { name: "docs/adr/001-readme-rules.md", path: "/root/docs/adr/001-readme-rules.md" },
      { name: "docs/guide.md", path: "/root/docs/guide.md" },
    ],
    truncated: false,
    skipped: 0,
  };

  it("searches the whole workspace, not just the branches that happen to be open", async () => {
    vi.mocked(readDir).mockResolvedValue(listing([]));
    vi.mocked(listMarkdownFiles).mockResolvedValue(index);

    renderTree("/root", "readme");

    // `001-readme-rules.md` sits three folders down in a tree nothing expanded;
    // a filter over the mounted rows would never have found it.
    await waitFor(() => expect(screen.getByText("README.md")).toBeInTheDocument());
    expect(screen.getByText("001-readme-rules.md")).toBeInTheDocument();
    expect(screen.queryByText("guide.md")).not.toBeInTheDocument();
    expect(listMarkdownFiles).toHaveBeenCalledWith("/root", false);
  });

  it("shows where each match lives and states how many there are", async () => {
    vi.mocked(readDir).mockResolvedValue(listing([]));
    vi.mocked(listMarkdownFiles).mockResolvedValue(index);

    renderTree("/root", "readme");

    await waitFor(() => expect(screen.getByText("2 documents")).toBeInTheDocument());
    expect(screen.getByText("docs/adr/")).toBeInTheDocument();
  });

  it("says the index was cut short instead of implying the filter saw everything", async () => {
    vi.mocked(readDir).mockResolvedValue(listing([]));
    vi.mocked(listMarkdownFiles).mockResolvedValue({ ...index, truncated: true });

    renderTree("/root", "readme");

    await waitFor(() =>
      expect(screen.getByText(/index stopped at its limit/i)).toBeInTheDocument(),
    );
  });

  it("keeps the index across filter sessions instead of re-walking the workspace", async () => {
    vi.mocked(readDir).mockResolvedValue(listing([]));
    vi.mocked(listMarkdownFiles).mockResolvedValue(index);

    const view = renderTree("/root", "readme");
    await waitFor(() => expect(screen.getByText("README.md")).toBeInTheDocument());
    expect(listMarkdownFiles).toHaveBeenCalledTimes(1);

    // Clearing the box and typing a different word used to throw the index away
    // and put "Indexing…" in front of someone who had only backspaced.
    const withFilter = (filter: string) => <FileTree rootPath="/root" filter={filter} />;
    view.rerender(withFilter(""));
    view.rerender(withFilter("guide"));

    expect(await screen.findByText("guide.md")).toBeInTheDocument();
    expect(listMarkdownFiles).toHaveBeenCalledTimes(1);

    // A mutation on disk is what actually makes it stale.
    await act(async () => {
      useWorkspace.getState().refreshTree();
      await Promise.resolve();
    });
    await waitFor(() => expect(listMarkdownFiles).toHaveBeenCalledTimes(2));
  });

  it("counts the folders the walk could not open instead of losing the index to them", async () => {
    vi.mocked(readDir).mockResolvedValue(listing([]));
    vi.mocked(listMarkdownFiles).mockResolvedValue({ ...index, skipped: 2 });

    renderTree("/root", "readme");

    // The walk used to abort on the first one, so a single locked subfolder
    // took filtering and quick-open down with it.
    await waitFor(() =>
      expect(screen.getByText(/2 folders couldn’t be read/i)).toBeInTheDocument(),
    );
    expect(screen.getByText("README.md")).toBeInTheDocument();
  });

  it("offers to build the index again when it fails, like the tree does for a folder", async () => {
    vi.mocked(readDir).mockResolvedValue(listing([]));
    vi.mocked(listMarkdownFiles)

      .mockRejectedValueOnce({ kind: "permissionDenied", message: "denied" })
      .mockResolvedValue(index);

    renderTree("/root", "readme");

    const row = await screen.findByLabelText(/permission denied — Try again/i);
    row.focus();
    await userEvent.setup().keyboard("{Enter}");

    expect(await screen.findByText("README.md")).toBeInTheDocument();
  });

  it("reports an empty result in a row the keyboard can reach", async () => {
    vi.mocked(readDir).mockResolvedValue(listing([]));
    vi.mocked(listMarkdownFiles).mockResolvedValue(index);

    renderTree("/root", "zzz");

    const row = await screen.findByText("No document matches");
    expect(row.closest('[role="treeitem"]')).toHaveAttribute("aria-disabled", "true");
  });
});
