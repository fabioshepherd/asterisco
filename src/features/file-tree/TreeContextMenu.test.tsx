import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// deleteEntry (via file-actions) reaches for moveToTrash and file-ops, so stub
// both modules.
vi.mock("@/features/file-ops/file-ops", () => ({ openPath: vi.fn() }));
vi.mock("@/lib/tauri/fs", () => ({ moveToTrash: vi.fn().mockResolvedValue(undefined) }));

import "@/i18n";

import { useWorkspace } from "@/stores/workspace";

import { TreeContextMenu } from "./TreeContextMenu";
import { useTreeMenu } from "./use-tree-menu";

const openMenu = (target: { path: string; isDir: boolean }) =>
  act(() => {
    useTreeMenu.getState().open({ x: 10, y: 10, ...target });
  });

beforeEach(() => {
  vi.clearAllMocks();
  useTreeMenu.setState({ target: null });
});

afterEach(() => {
  useTreeMenu.setState({ target: null });
});

describe("TreeContextMenu — keyboard", () => {
  it("closes on Tab instead of leaving the menu open behind the focus", async () => {
    render(<TreeContextMenu />);
    openMenu({ path: "/root/notes.md", isDir: false });

    expect(screen.getByRole("menu")).toBeInTheDocument();
    await userEvent.setup().keyboard("{Tab}");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("roves between items with the arrow keys", async () => {
    render(<TreeContextMenu />);
    openMenu({ path: "/root/notes.md", isDir: false });

    const items = screen.getAllByRole("menuitem");
    expect(items[0]).toHaveFocus();

    await userEvent.setup().keyboard("{ArrowDown}");
    expect(items[1]).toHaveFocus();
  });

  it("returns focus to the tree's tab stop when the root menu closes", async () => {
    // The root has no row of its own, so there is no row to go back to.
    const stop = document.createElement("li");
    stop.setAttribute("data-tree-item", "");
    stop.tabIndex = 0;
    document.body.append(stop);
    useWorkspace.setState({ rootPath: "/root" });

    render(<TreeContextMenu />);
    openMenu({ path: "/root", isDir: true });
    await userEvent.setup().keyboard("{Escape}");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(stop).toHaveFocus();
    stop.remove();
  });
});
