import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";

// Rendering <Sidebar> with a rootPath mounts <FileTree>, which would otherwise hit Tauri FS.
vi.mock("@/lib/tauri/fs", () => ({
  readDir: vi.fn().mockResolvedValue({ entries: [], total: 0, scanned: 0 }),
}));
vi.mock("@/lib/tauri/workspace", () => ({
  listMarkdownFiles: vi.fn().mockResolvedValue({ files: [], truncated: false, skipped: 0 }),
}));
vi.mock("@/features/file-ops/file-ops", () => ({ openPath: vi.fn() }));

import "@/i18n";

import { openPath } from "@/features/file-ops/file-ops";
import { listMarkdownFiles } from "@/lib/tauri/workspace";

import { useDocuments } from "@/stores/document";
import { useSettings } from "@/stores/settings";
import { SIDEBAR_WIDTH, useUi } from "@/stores/ui";
import { useWorkspace } from "@/stores/workspace";

import { Sidebar } from "./Sidebar";
import { useTreeExpansion } from "./tree-expansion";
import { useTreeMenu } from "./use-tree-menu";

const renderSidebar = () => render(<Sidebar />);

describe("Sidebar collapse control", () => {
  beforeEach(() => {
    useUi.setState({ sidebarVisible: true, outlineVisible: true });
  });

  it("collapses the sidebar when the toggle button is clicked", () => {
    renderSidebar();
    expect(useUi.getState().sidebarVisible).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /toggle sidebar/i }));

    expect(useUi.getState().sidebarVisible).toBe(false);
  });
});

describe("Sidebar outline accordion", () => {
  beforeEach(() => {
    useUi.setState({ sidebarVisible: true, outlineVisible: true });
    useDocuments.setState({ documents: [], activeId: null, tabs: [] });
    useDocuments.getState().createDocument({ markdown: "plain text" });
  });

  it("keeps the outline header visible when the outline is collapsed", () => {
    useUi.setState({ outlineVisible: false });
    renderSidebar();

    const toggle = screen.getByRole("button", { name: "Outline" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    // Body (and its empty-state text) is not rendered while collapsed.
    expect(screen.queryByText(/no headings yet/i)).not.toBeInTheDocument();
  });

  it("reveals the outline body when the header is clicked, keeping its name", () => {
    useUi.setState({ outlineVisible: false });
    renderSidebar();

    fireEvent.click(screen.getByRole("button", { name: "Outline" }));

    expect(useUi.getState().outlineVisible).toBe(true);
    expect(screen.getByRole("button", { name: "Outline" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByText(/no headings yet/i)).toBeInTheDocument();
  });

  it("hides the outline section while no document is open", () => {
    useDocuments.setState({ documents: [], activeId: null, tabs: [] });
    renderSidebar();

    expect(screen.queryByRole("button", { name: "Outline" })).not.toBeInTheDocument();
  });
});

describe("Sidebar header", () => {
  beforeEach(() => {
    useUi.setState({ sidebarVisible: true, outlineVisible: true });
    useWorkspace.setState({ rootPath: "/root" });
    useSettings.setState({ showIgnoredFolders: false });
    useTreeMenu.setState({ target: null });
  });

  afterEach(() => {
    // Reset the workspace root so this block's state doesn't leak to later tests.
    useWorkspace.setState({ rootPath: null });
  });

  it("leaves the ignored-folders preference to Settings", () => {
    renderSidebar();
    expect(screen.queryByRole("button", { name: /ignored/i })).not.toBeInTheDocument();
  });

  it("opens the workspace root's menu from the space around the rows", () => {
    renderSidebar();
    fireEvent.contextMenu(screen.getByRole("tree"));
    expect(useTreeMenu.getState().target).toMatchObject({ path: "/root", isDir: true });
  });
});

describe("Sidebar filter keyboard", () => {
  beforeEach(() => {
    useUi.setState({ sidebarVisible: true, outlineVisible: false });
    useWorkspace.setState({ rootPath: "/root" });
    vi.mocked(listMarkdownFiles).mockResolvedValue({
      files: [
        { name: "README.md", path: "/root/README.md" },
        { name: "docs/readme-assets/notes.md", path: "/root/docs/readme-assets/notes.md" },
      ],
      truncated: false,
      skipped: 0,
    });
  });

  afterEach(() => useWorkspace.setState({ rootPath: null }));

  /**
   * Two characters produced the answer and then three Tabs were needed to act
   * on it. Workspace search — one feature over — has handled these keys all
   * along; two search fields with two keyboard models is one app disagreeing
   * with itself.
   */
  it("opens the first match on Enter and steps into the results on ArrowDown", async () => {
    renderSidebar();
    const field = screen.getByRole("textbox", { name: /filter documents/i });

    fireEvent.change(field, { target: { value: "readme" } });
    expect(await screen.findByText("README.md")).toBeInTheDocument();

    fireEvent.keyDown(field, { key: "ArrowDown" });
    expect(screen.getAllByRole("treeitem")[0]).toHaveFocus();

    fireEvent.keyDown(field, { key: "Enter" });
    expect(openPath).toHaveBeenCalledWith("/root/README.md");
  });
});

describe("Sidebar collapse-all", () => {
  beforeEach(() => {
    useUi.setState({ sidebarVisible: true, outlineVisible: false });
    useWorkspace.setState({ rootPath: "/root" });
    useTreeExpansion.setState({ expanded: {} });
  });

  afterEach(() => useWorkspace.setState({ rootPath: null }));

  it("stays out of the way until a folder below the root is open", () => {
    renderSidebar();
    const button = screen.getByRole("button", { name: /collapse all folders/i });
    // The root is always open; collapsing it would leave a single dead row.
    expect(button).toBeDisabled();

    act(() => useTreeExpansion.getState().setExpanded("/root/docs", true));

    expect(screen.getByRole("button", { name: /collapse all folders/i })).toBeEnabled();
  });

  it("closes every folder but the root", () => {
    useTreeExpansion.setState({ expanded: { "/root": true, "/root/docs": true } });
    renderSidebar();

    fireEvent.click(screen.getByRole("button", { name: /collapse all folders/i }));

    expect(useTreeExpansion.getState().expanded).toEqual({ "/root": true });
  });
});

describe("Sidebar resizer", () => {
  beforeEach(() => {
    useUi.setState({
      sidebarVisible: true,
      outlineVisible: false,
      sidebarWidth: SIDEBAR_WIDTH.default,
    });
  });

  it("exposes the width as a focusable separator, not a bare drag target", () => {
    renderSidebar();
    const handle = screen.getByRole("separator", { name: /resize sidebar/i });

    expect(handle).toHaveAttribute("aria-orientation", "vertical");
    expect(handle).toHaveAttribute("aria-valuenow", String(SIDEBAR_WIDTH.default));
    expect(handle).toHaveAttribute("aria-valuemin", String(SIDEBAR_WIDTH.min));
    expect(handle).toHaveAttribute("aria-valuemax", String(SIDEBAR_WIDTH.max));
    expect(handle).toHaveAttribute("tabindex", "0");
  });

  it("resizes from the keyboard and clamps at both ends", () => {
    renderSidebar();
    const handle = screen.getByRole("separator", { name: /resize sidebar/i });

    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(useUi.getState().sidebarWidth).toBe(SIDEBAR_WIDTH.default + 16);

    fireEvent.keyDown(handle, { key: "Home" });
    expect(useUi.getState().sidebarWidth).toBe(SIDEBAR_WIDTH.min);
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(useUi.getState().sidebarWidth).toBe(SIDEBAR_WIDTH.min);

    fireEvent.keyDown(handle, { key: "End" });
    expect(useUi.getState().sidebarWidth).toBe(SIDEBAR_WIDTH.max);
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(useUi.getState().sidebarWidth).toBe(SIDEBAR_WIDTH.max);
  });

  it("widens away from the panel, whichever side the panel is on", () => {
    // The arrow keys used to assume the sidebar is always on the left, so in a
    // right-to-left UI the handle narrowed the panel it was asked to widen.
    document.documentElement.dir = "rtl";
    try {
      renderSidebar();
      const handle = screen.getByRole("separator", { name: /resize sidebar/i });

      fireEvent.keyDown(handle, { key: "ArrowLeft" });
      expect(useUi.getState().sidebarWidth).toBe(SIDEBAR_WIDTH.default + 16);
      fireEvent.keyDown(handle, { key: "ArrowRight" });
      expect(useUi.getState().sidebarWidth).toBe(SIDEBAR_WIDTH.default);
    } finally {
      document.documentElement.dir = "";
    }
  });
});
