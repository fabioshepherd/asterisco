import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@/i18n";

vi.mock("@/features/file-ops/file-ops", () => ({ closeTabs: vi.fn() }));
vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({ writeText: vi.fn() }));

import { closeTabs } from "@/features/file-ops/file-ops";
import { useDocuments } from "@/stores/document";
import { useWorkspace } from "@/stores/workspace";

import { TabContextMenu, type TabMenuTarget } from "./TabContextMenu";

const target: TabMenuTarget = { id: "doc-1", x: 10, y: 10 };

describe("TabContextMenu", () => {
  it("renders nothing when there is no target", () => {
    render(
      <TabContextMenu target={null} onRename={vi.fn()} onClose={vi.fn()} onDismiss={vi.fn()} />,
    );
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("shows rename and close items for a target", () => {
    render(
      <TabContextMenu target={target} onRename={vi.fn()} onClose={vi.fn()} onDismiss={vi.fn()} />,
    );
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Rename" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Open to the side" })).toBeNull();
    expect(screen.getByRole("menuitem", { name: "Close" })).toBeInTheDocument();
  });

  it("dismisses then runs the action when an item is clicked", () => {
    const onRename = vi.fn();
    const onDismiss = vi.fn();
    render(
      <TabContextMenu
        target={target}
        onRename={onRename}
        onClose={vi.fn()}
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onRename).toHaveBeenCalledTimes(1);
  });

  it("dismisses on Escape", () => {
    const onDismiss = vi.fn();
    render(
      <TabContextMenu target={target} onRename={vi.fn()} onClose={vi.fn()} onDismiss={onDismiss} />,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("returns focus to the originating tab when it closes", () => {
    // The real tab carries the id `tab-${id}`.
    const tab = document.createElement("button");
    tab.id = `tab-${target.id}`;
    document.body.appendChild(tab);

    const { rerender } = render(
      <TabContextMenu target={target} onRename={vi.fn()} onClose={vi.fn()} onDismiss={vi.fn()} />,
    );
    // Closing the menu (target → null) runs the focus-return cleanup.
    rerender(
      <TabContextMenu target={null} onRename={vi.fn()} onClose={vi.fn()} onDismiss={vi.fn()} />,
    );

    expect(tab).toHaveFocus();
    tab.remove();
  });
});

/** Render the menu on the middle one of three tabs. */
function seedThreeTabs(): { first: string; middle: string; last: string } {
  useDocuments.setState({ documents: [], activeId: null, tabs: [] });
  const first = useDocuments.getState().createDocument({ path: "/w/one.md" });
  const middle = useDocuments.getState().createDocument({ path: "/w/two.md" });
  const last = useDocuments.getState().createDocument({ path: "/w/three.md" });
  return { first, middle, last };
}

function renderOn(id: string) {
  return render(
    <TabContextMenu
      target={{ id, x: 10, y: 10 }}
      onRename={vi.fn()}
      onClose={vi.fn()}
      onDismiss={vi.fn()}
    />,
  );
}

describe("TabContextMenu — bulk closing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWorkspace.setState({ rootPath: null });
  });

  it("closes every other tab, leaving the target open", () => {
    const { first, middle, last } = seedThreeTabs();
    renderOn(middle);

    fireEvent.click(screen.getByRole("menuitem", { name: "Close others" }));
    expect(closeTabs).toHaveBeenCalledWith([first, last]);
  });

  it("closes only the tabs after the target", () => {
    const { middle, last } = seedThreeTabs();
    renderOn(middle);

    fireEvent.click(screen.getByRole("menuitem", { name: "Close to the right" }));
    expect(closeTabs).toHaveBeenCalledWith([last]);
  });

  it("closes everything, the target last", () => {
    const { first, middle, last } = seedThreeTabs();
    renderOn(middle);

    fireEvent.click(screen.getByRole("menuitem", { name: "Close all" }));
    expect(closeTabs).toHaveBeenCalledWith([first, last, middle]);
  });

  it("disables the bulk closes that have nothing to act on", () => {
    const { last } = seedThreeTabs();
    useDocuments.setState({ tabs: [last], activeId: last });
    renderOn(last);

    const others = screen.getByRole("menuitem", { name: "Close others" });
    const toTheRight = screen.getByRole("menuitem", { name: "Close to the right" });
    expect(others).toHaveAttribute("aria-disabled", "true");
    expect(toTheRight).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(others);
    expect(closeTabs).not.toHaveBeenCalled();
  });

  it("keeps Close to the right live while tabs follow the target", () => {
    const { first } = seedThreeTabs();
    renderOn(first);

    expect(screen.getByRole("menuitem", { name: "Close to the right" })).not.toHaveAttribute(
      "aria-disabled",
    );
  });
});

describe("TabContextMenu — locating the file", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("offers the path of a saved document", () => {
    const { middle } = seedThreeTabs();
    useWorkspace.setState({ rootPath: null });
    renderOn(middle);

    expect(screen.getByRole("menuitem", { name: "Copy path" })).toBeInTheDocument();
  });

  it("offers neither path nor reveal for an unsaved document", () => {
    seedThreeTabs();
    const untitled = useDocuments.getState().createDocument();
    useWorkspace.setState({ rootPath: "/w" });
    renderOn(untitled);

    expect(screen.queryByRole("menuitem", { name: "Copy path" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Reveal in file tree" })).toBeNull();
  });

  it("offers reveal only for a file inside the open workspace", () => {
    const { middle } = seedThreeTabs();
    useWorkspace.setState({ rootPath: "/w" });
    renderOn(middle);
    expect(screen.getByRole("menuitem", { name: "Reveal in file tree" })).toBeInTheDocument();
  });

  it("hides reveal for a file opened from outside the workspace", () => {
    seedThreeTabs();
    const outside = useDocuments.getState().createDocument({ path: "/elsewhere/notes.md" });
    useWorkspace.setState({ rootPath: "/w" });
    renderOn(outside);

    expect(screen.queryByRole("menuitem", { name: "Reveal in file tree" })).toBeNull();
  });
});
