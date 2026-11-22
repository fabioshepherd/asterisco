import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/tauri/search", () => ({ searchWorkspace: vi.fn() }));
vi.mock("@/features/file-ops/file-ops", () => ({ openPath: vi.fn().mockResolvedValue(undefined) }));

import "@/i18n";
import { useGlobalShortcuts } from "@/app/use-global-shortcuts";
import { openPath } from "@/features/file-ops/file-ops";
import { searchWorkspace } from "@/lib/tauri/search";
import { useUi } from "@/stores/ui";
import { useWorkspace } from "@/stores/workspace";

import { consumePendingJumpLine } from "./jump";
import { useWorkspaceSearch } from "./use-workspace-search";
import { WorkspaceSearch } from "./WorkspaceSearch";

const oneResult = {
  files: [
    { name: "a.md", path: "/root/a.md", matches: [{ line: 3, column: 1, text: "hello world" }] },
  ],
  truncated: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  useWorkspaceSearch.setState({ isOpen: true });
  useWorkspace.setState({ rootPath: "/root" });
  consumePendingJumpLine();
});

describe("WorkspaceSearch", () => {
  it("focuses the input on every open, even when the panel is already open", () => {
    // Ctrl+Shift+F opens (it no longer toggles), so a second press with focus
    // elsewhere must bring the caret back rather than do nothing.
    useWorkspaceSearch.setState({ isOpen: false });
    render(<WorkspaceSearch />);
    renderHook(() => useGlobalShortcuts());
    const press = () =>
      act(() => {
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "F", ctrlKey: true, shiftKey: true }),
        );
      });
    const outside = document.createElement("button");
    document.body.append(outside);

    press();
    expect(screen.getByRole("combobox")).toHaveFocus();

    outside.focus();
    expect(outside).toHaveFocus();
    press();
    expect(screen.getByRole("combobox")).toHaveFocus();
    outside.remove();
  });

  it("prompts to open a folder when there is no workspace", () => {
    useWorkspace.setState({ rootPath: null });
    render(<WorkspaceSearch />);
    expect(screen.getByText(/open a folder to search/i)).toBeInTheDocument();
  });

  it("shows the idle hint with a workspace and an empty query", () => {
    render(<WorkspaceSearch />);
    expect(screen.getByText(/type to search across files/i)).toBeInTheDocument();
  });

  it("debounces, renders grouped results, and highlights the query", async () => {
    vi.mocked(searchWorkspace).mockResolvedValue(oneResult);
    const { container } = render(<WorkspaceSearch />);

    await userEvent.setup().type(screen.getByRole("combobox"), "world");

    await waitFor(() => expect(screen.getByText("a.md")).toBeInTheDocument());
    expect(searchWorkspace).toHaveBeenCalledWith("/root", "world", false, false);
    expect(container.querySelector("mark")?.textContent).toBe("world");
    expect(screen.getByText("3")).toBeInTheDocument(); // line number
  });

  it("opens the active result in source mode on Enter, jumping to its line", async () => {
    vi.mocked(searchWorkspace).mockResolvedValue(oneResult);
    render(<WorkspaceSearch />);

    const user = userEvent.setup();
    await user.type(screen.getByRole("combobox"), "world");
    await waitFor(() => expect(screen.getByText("a.md")).toBeInTheDocument());

    await user.keyboard("{Enter}");

    expect(openPath).toHaveBeenCalledWith("/root/a.md");
    expect(useUi.getState().viewMode).toBe("source");
    expect(consumePendingJumpLine()).toBe(3);
    // Opening a result closes the panel.
    expect(useWorkspaceSearch.getState().isOpen).toBe(false);
  });

  it("shows the empty state when there are no matches", async () => {
    vi.mocked(searchWorkspace).mockResolvedValue({ files: [], truncated: false });
    render(<WorkspaceSearch />);

    await userEvent.setup().type(screen.getByRole("combobox"), "nope");
    // Appears both in the visible panel and the sr-only live region.
    await waitFor(() => expect(screen.getAllByText(/no matches/i).length).toBeGreaterThan(0));
  });

  // The summary used to print the capped total as a fact. A scan that stopped
  // early has to say the counts are a floor — in the panel and to a reader.
  it("marks the counts as a floor when a limit stopped the scan", async () => {
    vi.mocked(searchWorkspace).mockResolvedValue({ ...oneResult, truncated: true });
    render(<WorkspaceSearch />);

    await userEvent.setup().type(screen.getByRole("combobox"), "world");

    await waitFor(() =>
      expect(screen.getAllByText(/1\+ matches in 1\+ files/i).length).toBeGreaterThan(0),
    );
    expect(screen.getAllByText(/stopped at its limit/i).length).toBeGreaterThan(0);
  });

  it("states the counts plainly when nothing was left out", async () => {
    vi.mocked(searchWorkspace).mockResolvedValue(oneResult);
    render(<WorkspaceSearch />);

    await userEvent.setup().type(screen.getByRole("combobox"), "world");

    await waitFor(() =>
      expect(screen.getAllByText("1 matches in 1 files").length).toBeGreaterThan(0),
    );
    expect(screen.queryByText(/stopped at its limit/i)).not.toBeInTheDocument();
  });

  it("does not report an empty result as no matches when the scan was cut short", async () => {
    vi.mocked(searchWorkspace).mockResolvedValue({ files: [], truncated: true });
    render(<WorkspaceSearch />);

    await userEvent.setup().type(screen.getByRole("combobox"), "nope");

    await waitFor(() =>
      expect(screen.getAllByText(/no matches in the part searched/i).length).toBeGreaterThan(0),
    );
  });

  it("surfaces the error detail when the search fails", async () => {
    vi.mocked(searchWorkspace).mockRejectedValue(new Error("boom"));
    render(<WorkspaceSearch />);

    await userEvent.setup().type(screen.getByRole("combobox"), "x");
    // Appears both in the visible panel and the sr-only live region.
    await waitFor(() => expect(screen.getAllByText("boom").length).toBeGreaterThan(0));
  });
});
