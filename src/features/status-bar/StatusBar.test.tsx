import { describe, it, expect, beforeEach } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import "@/i18n";

import { useDocuments } from "@/stores/document";
import { useSelection } from "@/stores/selection";
import { useSettings } from "@/stores/settings";
import { useUi } from "@/stores/ui";
import { useWorkspace } from "@/stores/workspace";

import { StatusBar } from "./StatusBar";

describe("StatusBar auto-save toggle", () => {
  beforeEach(() => {
    useSettings.setState({ autoSave: false });
    useDocuments.setState({ documents: [], activeId: null });
    useDocuments.getState().createDocument({ markdown: "# hi" });
  });

  it("renders the toggle when auto-save is off, with aria-pressed=false", () => {
    render(<StatusBar />);

    const toggle = screen.getByRole("button", { name: "Auto-save" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
  });

  it("turns auto-save on when clicked, keeping one name in both states", () => {
    render(<StatusBar />);

    fireEvent.click(screen.getByRole("button", { name: "Auto-save" }));

    expect(useSettings.getState().autoSave).toBe(true);
    expect(screen.getByRole("button", { name: "Auto-save" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

describe("StatusBar with no document", () => {
  beforeEach(() => {
    useDocuments.setState({ documents: [], activeId: null });
  });

  it("shows no view switch, auto-save toggle or word count", () => {
    render(<StatusBar />);

    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Auto-save" })).not.toBeInTheDocument();
    expect(screen.queryByText(/words?$/)).not.toBeInTheDocument();
  });

  it("shows them once a document is open", () => {
    useDocuments.getState().createDocument({ markdown: "# hi" });
    render(<StatusBar />);

    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Auto-save" })).toBeInTheDocument();
    expect(screen.getByText("1 word")).toBeInTheDocument();
  });
});

describe("StatusBar save state", () => {
  beforeEach(() => {
    useDocuments.setState({ documents: [], activeId: null });
  });

  it("shows the saved indicator when the active document is clean", () => {
    useDocuments.getState().createDocument({ markdown: "# hi" });
    render(<StatusBar />);
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("shows the unsaved indicator when the active document is dirty", () => {
    const id = useDocuments.getState().createDocument({ markdown: "# hi" });
    useDocuments.getState().setMarkdown(id, "# hi changed");
    render(<StatusBar />);
    expect(screen.getByText("Unsaved")).toBeInTheDocument();
  });
});

describe("StatusBar machine data", () => {
  beforeEach(() => {
    useDocuments.setState({ documents: [], activeId: null });
    useWorkspace.setState({ rootPath: null });
    useSelection.setState({ text: "", caret: null });
    useUi.setState({ viewMode: "edit" });
  });

  it("shows the active file's path relative to the open folder", () => {
    useWorkspace.setState({ rootPath: "/Users/me/project" });
    useDocuments.getState().createDocument({ path: "/Users/me/project/docs/README.md" });
    render(<StatusBar />);

    // Split at the last separator so the file name never truncates.
    expect(screen.getByText("docs/")).toBeInTheDocument();
    expect(screen.getByText("README.md")).toBeInTheDocument();
  });

  it("keeps the path absolute for a file outside the open folder", () => {
    useWorkspace.setState({ rootPath: "/Users/me/project" });
    useDocuments.getState().createDocument({ path: "/tmp/notes.md" });
    render(<StatusBar />);

    expect(screen.getByText("/tmp/")).toBeInTheDocument();
  });

  it("shows no path for an unsaved document", () => {
    useDocuments.getState().createDocument({ markdown: "# hi" });
    render(<StatusBar />);

    expect(screen.queryByText(/\.md$/)).not.toBeInTheDocument();
  });

  it("shows the caret position only in source mode", () => {
    useDocuments.getState().createDocument({ markdown: "# hi" });
    useUi.setState({ viewMode: "source" });
    const { rerender } = render(<StatusBar />);
    expect(screen.queryByText(/Ln /)).not.toBeInTheDocument();

    useSelection.getState().setCaret({ line: 42, column: 7 });
    rerender(<StatusBar />);
    // Visible abbreviation for the eye, the words for a screen reader — an
    // `aria-label` on a span would be ignored.
    expect(screen.getByText("Ln 42, Col 7")).toHaveAttribute("aria-hidden");
    expect(screen.getByText("Line 42, column 7")).toHaveClass("sr-only");

    // A caret left behind by source mode must not leak into the other views.
    act(() => useUi.setState({ viewMode: "edit" }));
    expect(screen.queryByText(/Ln /)).not.toBeInTheDocument();
  });

  it("counts words, and the selection's words when there is one", () => {
    useDocuments.getState().createDocument({ markdown: "# one two three" });
    useSelection.setState({ text: "two three" });
    render(<StatusBar />);

    expect(screen.getByText("3 words")).toBeInTheDocument();
    expect(screen.getByText("2 words selected")).toBeInTheDocument();
    expect(screen.queryByText(/character/)).not.toBeInTheDocument();
    expect(screen.queryByText(/min read/)).not.toBeInTheDocument();
  });
});
