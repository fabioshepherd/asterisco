import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import "@/i18n";
import { setSearchController } from "@/editor/editor-search";
import { useDocuments } from "@/stores/document";

import { FindReplace } from "./FindReplace";
import { useFindReplace } from "./use-find-replace";

beforeEach(() => {
  setSearchController(null);
  useDocuments.setState({ documents: [], activeId: null });
  useFindReplace.setState({
    isOpen: false,
    showReplace: false,
    query: "",
    replacement: "",
    regex: false,
    caseSensitive: false,
    wholeWord: false,
    matches: [],
    total: 0,
    current: -1,
    invalidRegex: false,
    lastReplacement: null,
  });
});

afterEach(() => {
  useFindReplace.getState().close();
});

describe("FindReplace", () => {
  it("replaces the current match when Enter is pressed in the replace field", async () => {
    const user = userEvent.setup();
    useDocuments.getState().createDocument({ markdown: "foo foo" });
    useFindReplace.getState().open("replace");
    useFindReplace.getState().setQuery("foo");
    useFindReplace.getState().setReplacement("bar");
    render(<FindReplace />);

    await user.click(screen.getByRole("textbox", { name: "Replace with" }));
    await user.keyboard("{Enter}");

    expect(useDocuments.getState().documents[0]?.markdown).toBe("bar foo");
  });

  it("replaces every match when mod+Enter is pressed in the replace field", async () => {
    const user = userEvent.setup();
    useDocuments.getState().createDocument({ markdown: "foo foo" });
    useFindReplace.getState().open("replace");
    useFindReplace.getState().setQuery("foo");
    useFindReplace.getState().setReplacement("bar");
    render(<FindReplace />);

    await user.click(screen.getByRole("textbox", { name: "Replace with" }));
    await user.keyboard("{Meta>}{Enter}{/Meta}");

    expect(useDocuments.getState().documents[0]?.markdown).toBe("bar bar");
  });

  it("flags an invalid regex with an alert and marks the find field invalid", () => {
    useDocuments.getState().createDocument({ markdown: "abc" });
    useFindReplace.getState().open("find");
    useFindReplace.setState({ regex: true });
    useFindReplace.getState().setQuery("(");
    render(<FindReplace />);

    expect(screen.getByRole("alert")).toHaveTextContent("Invalid regular expression");
    expect(screen.getByRole("textbox", { name: "Find" })).toHaveAttribute("aria-invalid", "true");
  });

  it("shows a no-matches status when a non-empty query finds nothing", () => {
    useDocuments.getState().createDocument({ markdown: "hello world" });
    useFindReplace.getState().open("find");
    useFindReplace.getState().setQuery("zzz");
    render(<FindReplace />);

    expect(screen.getByText("No matches")).toBeInTheDocument();
  });

  it("does not show no-matches for an empty query", () => {
    useDocuments.getState().createDocument({ markdown: "hello" });
    useFindReplace.getState().open("find");
    render(<FindReplace />);

    expect(screen.queryByText("No matches")).not.toBeInTheDocument();
  });

  it("shows the invalid-regex alert instead of no-matches for a bad pattern", () => {
    useDocuments.getState().createDocument({ markdown: "hello" });
    useFindReplace.getState().open("find");
    useFindReplace.setState({ regex: true });
    useFindReplace.getState().setQuery("(");
    render(<FindReplace />);

    expect(screen.queryByText("No matches")).not.toBeInTheDocument();
    expect(screen.getByText("Invalid regular expression")).toBeInTheDocument();
  });

  it("shows the match count in the Replace all button", () => {
    useDocuments.getState().createDocument({ markdown: "a a a" });
    useFindReplace.getState().open("replace");
    useFindReplace.getState().setQuery("a");
    render(<FindReplace />);

    expect(screen.getByRole("button", { name: "Replace all 3" })).toBeInTheDocument();
  });

  it("traps Tab within the panel (wraps both directions)", () => {
    useDocuments.getState().createDocument({ markdown: "hello hello" });
    useFindReplace.getState().open("find");
    useFindReplace.getState().setQuery("hello");
    render(<FindReplace />);

    const panel = screen.getByRole("search");
    const first = screen.getByRole("button", { name: "Toggle replace" });
    const last = screen.getByRole("button", { name: "Regular expression" });

    last.focus();
    fireEvent.keyDown(panel, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(panel, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("gives the find field and icon buttons the shared focus ring", () => {
    useDocuments.getState().createDocument({ markdown: "x" });
    useFindReplace.getState().open("find");
    render(<FindReplace />);

    expect(screen.getByRole("textbox", { name: "Find" }).className).toContain(
      "focus-visible:ring-2",
    );
    expect(screen.getByRole("button", { name: "Close" }).className).toContain(
      "focus-visible:ring-2",
    );
  });
});
