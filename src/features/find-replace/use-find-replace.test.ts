import { beforeEach, describe, expect, it, vi } from "vitest";

import { type EditorSearchController, setSearchController } from "@/editor/editor-search";
import { useDocuments } from "@/stores/document";

import {
  replaceAllInActiveDocument,
  replaceCurrentInActiveDocument,
  useFindReplace,
} from "./use-find-replace";

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

const plainQuery = { regex: false, caseSensitive: false, wholeWord: false };

function fakeController(total: number): EditorSearchController {
  return {
    search: vi.fn(() => total),
    reveal: vi.fn(),
    clear: vi.fn(),
    replaceCurrent: vi.fn(() => true),
    replaceAll: vi.fn(),
  };
}

describe("replaceAllInActiveDocument", () => {
  it("replaces every match in the active document and marks it dirty", () => {
    useDocuments.getState().createDocument({ markdown: "foo foo bar" });
    useFindReplace.setState({ query: "foo", replacement: "baz" });

    replaceAllInActiveDocument();

    const doc = useDocuments.getState().documents[0];
    expect(doc?.markdown).toBe("baz baz bar");
    expect(doc?.isDirty).toBe(true);
  });

  it("does nothing when there are no matches", () => {
    useDocuments.getState().createDocument({ markdown: "hello" });
    useFindReplace.setState({ query: "xyz", replacement: "z" });

    replaceAllInActiveDocument();

    const doc = useDocuments.getState().documents[0];
    expect(doc?.markdown).toBe("hello");
    expect(doc?.isDirty).toBe(false);
  });

  it("recomputes matches against the new content", () => {
    useDocuments.getState().createDocument({ markdown: "foo foo" });
    useFindReplace.getState().open("replace");
    useFindReplace.getState().setQuery("foo");
    useFindReplace.setState({ replacement: "bar" });
    expect(useFindReplace.getState().matches).toHaveLength(2);

    replaceAllInActiveDocument();

    expect(useFindReplace.getState().matches).toHaveLength(0);
    expect(useFindReplace.getState().current).toBe(-1);
  });
});

describe("match navigation", () => {
  it("computes matches when the panel opens with a query", () => {
    useDocuments.getState().createDocument({ markdown: "a b a b" });
    useFindReplace.setState({ query: "a" });
    useFindReplace.getState().open("find");

    expect(useFindReplace.getState().matches).toEqual([
      { index: 0, length: 1 },
      { index: 4, length: 1 },
    ]);
    expect(useFindReplace.getState().current).toBe(0);
  });

  it("computes matches when the query changes", () => {
    useDocuments.getState().createDocument({ markdown: "a b a b" });
    useFindReplace.getState().open("find");
    useFindReplace.getState().setQuery("b");

    expect(useFindReplace.getState().matches).toHaveLength(2);
    expect(useFindReplace.getState().current).toBe(0);
  });

  it("wraps around with next() and prev()", () => {
    useDocuments.getState().createDocument({ markdown: "a a a" });
    useFindReplace.setState({ query: "a" });
    useFindReplace.getState().open("find");
    expect(useFindReplace.getState().current).toBe(0);

    useFindReplace.getState().next();
    expect(useFindReplace.getState().current).toBe(1);
    useFindReplace.getState().next();
    expect(useFindReplace.getState().current).toBe(2);
    useFindReplace.getState().next();
    expect(useFindReplace.getState().current).toBe(0);

    useFindReplace.getState().prev();
    expect(useFindReplace.getState().current).toBe(2);
  });

  it("leaves current at -1 when there are no matches", () => {
    useDocuments.getState().createDocument({ markdown: "hello" });
    useFindReplace.setState({ query: "zzz" });
    useFindReplace.getState().open("find");

    expect(useFindReplace.getState().current).toBe(-1);
    useFindReplace.getState().next();
    expect(useFindReplace.getState().current).toBe(-1);
  });
});

describe("replaceCurrentInActiveDocument", () => {
  it("replaces exactly the selected match and recomputes", () => {
    useDocuments.getState().createDocument({ markdown: "foo foo foo" });
    useFindReplace.getState().open("replace");
    useFindReplace.getState().setQuery("foo");
    useFindReplace.setState({ replacement: "bar", current: 1 });

    replaceCurrentInActiveDocument();

    const doc = useDocuments.getState().documents[0];
    expect(doc?.markdown).toBe("foo bar foo");
    expect(doc?.isDirty).toBe(true);
    // One match consumed; the remaining two are recomputed.
    expect(useFindReplace.getState().matches).toHaveLength(2);
  });

  it("does nothing when there is no current match", () => {
    useDocuments.getState().createDocument({ markdown: "hello" });
    useFindReplace.getState().open("replace");
    useFindReplace.getState().setQuery("zzz");
    useFindReplace.setState({ replacement: "x" });

    replaceCurrentInActiveDocument();

    expect(useDocuments.getState().documents[0]?.markdown).toBe("hello");
  });

  it("expands regex group references in single replace, like replace all", () => {
    useDocuments.getState().createDocument({ markdown: "user@domain other@host" });
    useFindReplace.getState().open("replace");
    useFindReplace.setState({ regex: true });
    useFindReplace.getState().setQuery("(\\w+)@(\\w+)");
    useFindReplace.setState({ replacement: "$2.$1", current: 0 });

    replaceCurrentInActiveDocument();

    // Only the first match is replaced, with its group refs expanded.
    expect(useDocuments.getState().documents[0]?.markdown).toBe("domain.user other@host");
  });

  it("inserts a `$`-containing literal replacement verbatim in plain mode", () => {
    useDocuments.getState().createDocument({ markdown: "price here" });
    useFindReplace.getState().open("replace");
    useFindReplace.getState().setQuery("price");
    useFindReplace.setState({ replacement: "$1 cost", current: 0 });

    replaceCurrentInActiveDocument();

    // In literal mode `$1` is not a group ref; it stays verbatim.
    expect(useDocuments.getState().documents[0]?.markdown).toBe("$1 cost here");
  });
});

describe("focus management", () => {
  it("returns focus to the previously-focused element when closed", () => {
    const prior = document.createElement("textarea");
    document.body.appendChild(prior);
    prior.focus();
    expect(document.activeElement).toBe(prior);

    useFindReplace.getState().open("find");
    // The panel steals focus (the find input autofocuses in the real UI).
    const panelInput = document.createElement("input");
    document.body.appendChild(panelInput);
    panelInput.focus();
    expect(document.activeElement).toBe(panelInput);

    useFindReplace.getState().close();
    expect(document.activeElement).toBe(prior);

    prior.remove();
    panelInput.remove();
  });

  it("keeps the original target when re-opened while already open", () => {
    const prior = document.createElement("textarea");
    document.body.appendChild(prior);
    prior.focus();

    useFindReplace.getState().open("find");
    const panelInput = document.createElement("input");
    document.body.appendChild(panelInput);
    panelInput.focus();

    // Pressing the shortcut again must not capture the panel as the return target.
    useFindReplace.getState().open("replace");
    useFindReplace.getState().close();
    expect(document.activeElement).toBe(prior);

    prior.remove();
    panelInput.remove();
  });

  it("skips restoring focus to an element no longer in the document", () => {
    const prior = document.createElement("textarea");
    document.body.appendChild(prior);
    prior.focus();

    useFindReplace.getState().open("find");
    prior.remove(); // e.g. opened from a command palette that has since closed

    expect(() => useFindReplace.getState().close()).not.toThrow();
    expect(document.activeElement).not.toBe(prior);
  });
});

describe("invalid regex state", () => {
  it("flags an invalid regex query and clears it once fixed", () => {
    useDocuments.getState().createDocument({ markdown: "abc" });
    useFindReplace.getState().open("find");
    useFindReplace.setState({ regex: true });
    useFindReplace.getState().setQuery("(");

    expect(useFindReplace.getState().invalidRegex).toBe(true);
    expect(useFindReplace.getState().total).toBe(0);

    useFindReplace.getState().setQuery("(a)");
    expect(useFindReplace.getState().invalidRegex).toBe(false);
  });

  it("never flags plain-mode queries with regex metacharacters", () => {
    useDocuments.getState().createDocument({ markdown: "a(b" });
    useFindReplace.getState().open("find");
    useFindReplace.getState().setQuery("(");

    expect(useFindReplace.getState().invalidRegex).toBe(false);
  });
});

describe("replacement confirmation count", () => {
  it("records how many matches replace-all changed", () => {
    useDocuments.getState().createDocument({ markdown: "foo foo foo" });
    useFindReplace.getState().open("replace");
    useFindReplace.getState().setQuery("foo");
    useFindReplace.setState({ replacement: "bar" });

    replaceAllInActiveDocument();

    expect(useFindReplace.getState().lastReplacement).toBe(3);
  });

  it("records a single replacement for replace-current", () => {
    useDocuments.getState().createDocument({ markdown: "foo foo" });
    useFindReplace.getState().open("replace");
    useFindReplace.getState().setQuery("foo");
    useFindReplace.setState({ replacement: "bar", current: 0 });

    replaceCurrentInActiveDocument();

    expect(useFindReplace.getState().lastReplacement).toBe(1);
  });

  it("clears the confirmation when the query changes", () => {
    useDocuments.getState().createDocument({ markdown: "foo foo" });
    useFindReplace.getState().open("replace");
    useFindReplace.getState().setQuery("foo");
    useFindReplace.setState({ replacement: "bar" });
    replaceAllInActiveDocument();
    expect(useFindReplace.getState().lastReplacement).toBe(2);

    useFindReplace.getState().setQuery("bar");
    expect(useFindReplace.getState().lastReplacement).toBeNull();
  });
});

describe("editor controller delegation", () => {
  it("takes total from the controller and reveals current on open", () => {
    const controller = fakeController(3);
    setSearchController(controller);
    useFindReplace.setState({ query: "x" });

    useFindReplace.getState().open("find");

    expect(controller.search).toHaveBeenCalledWith({ query: "x", options: plainQuery }, -1);
    expect(useFindReplace.getState().total).toBe(3);
    expect(useFindReplace.getState().current).toBe(0);
    expect(controller.reveal).toHaveBeenLastCalledWith(0);
  });

  it("reveals through the controller on next/prev (wrapping on total)", () => {
    const controller = fakeController(3);
    setSearchController(controller);
    useFindReplace.setState({ query: "x" });
    useFindReplace.getState().open("find");

    useFindReplace.getState().next();
    expect(useFindReplace.getState().current).toBe(1);
    expect(controller.reveal).toHaveBeenLastCalledWith(1);

    useFindReplace.getState().prev();
    useFindReplace.getState().prev();
    expect(useFindReplace.getState().current).toBe(2); // wrapped past 0
    expect(controller.reveal).toHaveBeenLastCalledWith(2);
  });

  it("clears highlights when the panel closes", () => {
    const controller = fakeController(0);
    setSearchController(controller);
    useFindReplace.getState().open("find");

    useFindReplace.getState().close();

    expect(controller.clear).toHaveBeenCalled();
  });

  it("delegates replace to the controller instead of the markdown path", () => {
    useDocuments.getState().createDocument({ markdown: "foo foo" });
    const controller = fakeController(2);
    setSearchController(controller);
    useFindReplace.setState({ query: "foo", replacement: "bar" });
    useFindReplace.getState().open("replace");

    replaceCurrentInActiveDocument();
    expect(controller.replaceCurrent).toHaveBeenCalledWith(
      { query: "foo", options: plainQuery },
      "bar",
    );

    replaceAllInActiveDocument();
    expect(controller.replaceAll).toHaveBeenCalledWith(
      { query: "foo", options: plainQuery },
      "bar",
    );

    // The markdown was not touched by the (faked) controller.
    expect(useDocuments.getState().documents[0]?.markdown).toBe("foo foo");
  });
});
