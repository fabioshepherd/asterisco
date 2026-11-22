import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tauri/fs", () => ({ renamePath: vi.fn() }));
vi.mock("@/features/file-ops/file-ops", () => ({
  saveDocumentAs: vi.fn(),
  closeTab: vi.fn(),
  newFile: vi.fn(),
}));

import "@/i18n";
import { MotionProvider } from "@/app/MotionProvider";
import { closeTab, saveDocumentAs } from "@/features/file-ops/file-ops";
import { renamePath } from "@/lib/tauri/fs";
import { mockReducedMotion } from "@/test/motion";
import { useDocuments } from "@/stores/document";
import { useUi } from "@/stores/ui";

import { TabBar } from "./TabBar";

// Reset the document list and the tab strip so suites stay independent
// (mirrors document.test.ts).
function resetDocuments() {
  useDocuments.setState({ documents: [], activeId: null, tabs: [] });
}

describe("TabBar", () => {
  beforeEach(() => {
    resetDocuments();
    useUi.setState({ sidebarVisible: true });
    useDocuments.getState().createDocument({ markdown: "# hi" });
  });

  it("adds leading padding when the sidebar is hidden", () => {
    useUi.setState({ sidebarVisible: false });
    render(<TabBar />);
    expect(screen.getByRole("tablist").className).toContain("pl-10");
  });

  it("has no leading padding when the sidebar is visible", () => {
    useUi.setState({ sidebarVisible: true });
    render(<TabBar />);
    expect(screen.getByRole("tablist").className).not.toContain("pl-10");
  });

  it("shows every tab in its final visible state under reduced motion", () => {
    mockReducedMotion(true);
    useDocuments.getState().createDocument({ markdown: "# second" });
    render(
      <MotionProvider>
        <TabBar />
      </MotionProvider>,
    );
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    tabs.forEach((tab) => expect(tab).toBeVisible());
  });
});

describe("TabBar inline rename", () => {
  beforeEach(() => {
    resetDocuments();
    vi.clearAllMocks();
    vi.mocked(renamePath).mockResolvedValue(undefined);
    vi.mocked(saveDocumentAs).mockResolvedValue(true);
  });

  it("double-clicking a saved tab renames the file on Enter", async () => {
    const id = useDocuments.getState().createDocument({ path: "/docs/notes.md", markdown: "x" });
    useDocuments.getState().setActiveDocument(id);
    const user = userEvent.setup();
    render(<TabBar />);

    await user.dblClick(screen.getByText("notes.md"));
    const input = screen.getByRole("textbox", { name: "Rename file" });
    expect(input).toHaveValue("notes");

    await user.clear(input);
    await user.type(input, "ideas");
    await user.keyboard("{Enter}");

    await waitFor(() =>
      expect(renamePath).toHaveBeenCalledWith("/docs/notes.md", "/docs/ideas.md"),
    );
    expect(useDocuments.getState().documents[0]?.path).toBe("/docs/ideas.md");
  });

  it("Escape cancels without renaming", async () => {
    const id = useDocuments.getState().createDocument({ path: "/docs/notes.md", markdown: "x" });
    useDocuments.getState().setActiveDocument(id);
    const user = userEvent.setup();
    render(<TabBar />);

    await user.dblClick(screen.getByText("notes.md"));
    await user.type(screen.getByRole("textbox", { name: "Rename file" }), "ideas");
    await user.keyboard("{Escape}");

    expect(renamePath).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText("notes.md")).toBeInTheDocument());
  });

  it("double-clicking an unsaved tab opens Save As, not inline edit", async () => {
    const id = useDocuments.getState().createDocument({ markdown: "x" }); // untitled
    useDocuments.getState().setActiveDocument(id);
    const user = userEvent.setup();
    render(<TabBar />);

    await user.dblClick(screen.getByText("Untitled"));

    expect(saveDocumentAs).toHaveBeenCalledWith(id);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("clicking away cancels the rename instead of committing it", async () => {
    const id = useDocuments.getState().createDocument({ path: "/docs/notes.md", markdown: "x" });
    useDocuments.getState().setActiveDocument(id);
    const user = userEvent.setup();
    render(<TabBar />);

    await user.dblClick(screen.getByText("notes.md"));
    await user.type(screen.getByRole("textbox", { name: "Rename file" }), "ideas");
    await user.tab(); // blur the input by moving focus away

    expect(renamePath).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText("notes.md")).toBeInTheDocument());
  });
});

describe("TabBar keyboard navigation", () => {
  let first: string;
  let second: string;

  beforeEach(() => {
    resetDocuments();
    vi.clearAllMocks();
    first = useDocuments.getState().createDocument({ path: "/docs/a.md", markdown: "a" });
    second = useDocuments.getState().createDocument({ path: "/docs/b.md", markdown: "b" });
    useDocuments.getState().setActiveDocument(first);
  });

  it("arrows move focus only; Enter commits the switch (manual activation)", async () => {
    const user = userEvent.setup();
    render(<TabBar />);
    const tabs = screen.getAllByRole("tab");

    tabs[0]?.focus();
    await user.keyboard("{ArrowRight}");
    expect(tabs[1]).toHaveFocus();
    // Focus moved but the active document did NOT change.
    expect(useDocuments.getState().activeId).toBe(first);

    await user.keyboard("{Enter}");
    expect(useDocuments.getState().activeId).toBe(second);
  });

  it("Home and End move focus to the first and last tab", async () => {
    const user = userEvent.setup();
    render(<TabBar />);
    const tabs = screen.getAllByRole("tab");

    tabs[0]?.focus();
    await user.keyboard("{End}");
    expect(tabs[1]).toHaveFocus();
    await user.keyboard("{Home}");
    expect(tabs[0]).toHaveFocus();
    // Pure focus movement never switches the document.
    expect(useDocuments.getState().activeId).toBe(first);
  });

  it("F2 starts an inline rename of the focused tab", async () => {
    const user = userEvent.setup();
    render(<TabBar />);

    screen.getAllByRole("tab")[0]?.focus();
    await user.keyboard("{F2}");

    expect(screen.getByRole("textbox", { name: "Rename file" })).toHaveValue("a");
  });

  it("announces unsaved state through the tab's accessible name", () => {
    useDocuments.setState({
      documents: useDocuments
        .getState()
        .documents.map((doc) => (doc.id === first ? { ...doc, isDirty: true } : doc)),
    });
    render(<TabBar />);

    expect(screen.getByRole("tab", { name: "a.md, unsaved changes" })).toBeInTheDocument();
  });
});

describe("TabBar whole-tab drag", () => {
  let first: string;
  let second: string;

  beforeEach(() => {
    resetDocuments();
    vi.clearAllMocks();
    first = useDocuments.getState().createDocument({ path: "/docs/a.md", markdown: "a" });
    second = useDocuments.getState().createDocument({ path: "/docs/b.md", markdown: "b" });
    useDocuments.getState().setActiveDocument(first);
  });

  // The drag activator now lives on the whole tab body (useSortable's
  // listeners.onPointerDown is forwarded onto the tab content), so there is no
  // separate grip button. The PointerSensor's 4px threshold keeps a plain click
  // a select.
  it("renders no grip-handle button", () => {
    render(<TabBar />);

    expect(screen.queryByLabelText(/Reorder/)).toBeNull();
  });

  it("clicking a tab selects it (no drag)", async () => {
    const user = userEvent.setup();
    render(<TabBar />);

    const tabs = screen.getAllByRole("tab");
    expect(useDocuments.getState().activeId).toBe(first);
    // A plain click (no pointer movement past the 4px threshold) must select the
    // second tab via the tab body's onClick, not start a drag.
    const secondTab = tabs[1];
    if (!secondTab) throw new Error("expected a second tab");
    await user.click(secondTab);
    expect(useDocuments.getState().activeId).toBe(second);
  });
});

describe("TabBar ids", () => {
  beforeEach(() => {
    resetDocuments();
    vi.clearAllMocks();
  });

  it("gives each tab an id the document panel and context menu can reference", () => {
    const a = useDocuments.getState().createDocument();
    render(<TabBar />);
    const tab = screen.getByRole("tab");
    expect(tab).toHaveAttribute("id", `tab-${a}`);
    expect(tab).toHaveAttribute("aria-controls", "document-panel");
  });
});

/** A non-primary click. `fireEvent` has no `auxClick` shorthand to lean on. */
function auxClick(button: number): MouseEvent {
  return new MouseEvent("auxclick", { bubbles: true, cancelable: true, button });
}

describe("TabBar closing", () => {
  beforeEach(() => {
    resetDocuments();
    vi.clearAllMocks();
    vi.mocked(closeTab).mockResolvedValue(true);
  });

  it("closes a tab on middle-click", () => {
    const id = useDocuments.getState().createDocument({ path: "/w/notes.md" });
    render(<TabBar />);

    fireEvent(screen.getByRole("tab"), auxClick(1));
    expect(closeTab).toHaveBeenCalledWith(id);
  });

  it("ignores a right-click on the tab body", () => {
    useDocuments.getState().createDocument({ path: "/w/notes.md" });
    render(<TabBar />);

    fireEvent(screen.getByRole("tab"), auxClick(2));
    expect(closeTab).not.toHaveBeenCalled();
  });

  it("closes the focused tab on Delete", () => {
    const id = useDocuments.getState().createDocument({ path: "/w/notes.md" });
    render(<TabBar />);

    fireEvent.keyDown(screen.getByRole("tab"), { key: "Delete" });
    expect(closeTab).toHaveBeenCalledWith(id);
  });

  it("closes the focused tab on Backspace", () => {
    const id = useDocuments.getState().createDocument({ path: "/w/notes.md" });
    render(<TabBar />);

    fireEvent.keyDown(screen.getByRole("tab"), { key: "Backspace" });
    expect(closeTab).toHaveBeenCalledWith(id);
  });

  it("keeps close buttons out of the Tab order and advertises Delete on the tab", async () => {
    const a = useDocuments.getState().createDocument({ path: "/w/a.md" });
    useDocuments.getState().createDocument({ path: "/w/b.md" });
    useDocuments.getState().setActiveDocument(a);
    const user = userEvent.setup();
    render(<TabBar />);

    for (const button of screen.getAllByRole("button", { name: /^Close / })) {
      expect(button).toHaveAttribute("tabindex", "-1");
    }
    expect(screen.getAllByRole("tab")[0]).toHaveAttribute("aria-keyshortcuts", "Delete");

    // One stop for the strip, then straight to "New tab".
    await user.tab();
    expect(screen.getAllByRole("tab")[0]).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "New tab" })).toHaveFocus();
  });

  it("renders New tab outside the tablist, which owns only tabs", () => {
    useDocuments.getState().createDocument({ path: "/w/a.md" });
    render(<TabBar />);

    const tablist = screen.getByRole("tablist");
    expect(tablist).not.toContainElement(screen.getByRole("button", { name: "New tab" }));
    for (const child of Array.from(tablist.children)) {
      expect(child).toHaveAttribute("role", "tab");
    }
  });

  it("shows the unsaved dot in the close slot without a second element", () => {
    const id = useDocuments.getState().createDocument({ path: "/w/a.md" });
    const { rerender } = render(<TabBar />);
    const close = screen.getByRole("button", { name: "Close a.md" });
    expect(close.querySelector("[data-unsaved-dot]")).toBeNull();
    const before = screen.getByRole("tab").querySelectorAll("*").length;

    useDocuments.setState({
      documents: useDocuments
        .getState()
        .documents.map((doc) => (doc.id === id ? { ...doc, isDirty: true } : doc)),
    });
    rerender(<TabBar />);

    // The dot lives inside the (fixed-size) close button, so the tab gains one
    // node there and nothing beside it.
    expect(
      screen.getByRole("button", { name: "Close a.md" }).querySelector("[data-unsaved-dot]"),
    ).not.toBeNull();
    expect(screen.getByRole("tab").querySelectorAll("*").length).toBe(before + 1);
  });
});

describe("TabBar labels", () => {
  beforeEach(() => {
    resetDocuments();
    vi.clearAllMocks();
  });

  it("shows only the file name while it is unique", () => {
    useDocuments.getState().createDocument({ path: "/repo/docs/README.md" });
    render(<TabBar />);

    expect(screen.getByRole("tab", { name: "README.md" })).toBeInTheDocument();
  });

  it("adds the distinguishing folder when two tabs share a name", () => {
    useDocuments.getState().createDocument({ path: "/repo/docs/README.md" });
    useDocuments.getState().createDocument({ path: "/repo/api/README.md" });
    render(<TabBar />);

    expect(screen.getByRole("tab", { name: "README.md — docs" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "README.md — api" })).toBeInTheDocument();
  });

  it("keeps the folder out of the tooltip, which carries the whole path", () => {
    useDocuments.getState().createDocument({ path: "/repo/docs/README.md" });
    render(<TabBar />);

    expect(screen.getByTitle("/repo/docs/README.md")).toBeInTheDocument();
  });

  it("names an unsaved tab with its folder and its state", () => {
    const first = useDocuments.getState().createDocument({ path: "/repo/docs/README.md" });
    useDocuments.getState().createDocument({ path: "/repo/api/README.md" });
    useDocuments.getState().setMarkdown(first, "edited");
    render(<TabBar />);

    expect(
      screen.getByRole("tab", { name: "README.md — docs, unsaved changes" }),
    ).toBeInTheDocument();
  });
});
