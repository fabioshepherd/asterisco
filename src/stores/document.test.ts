import { beforeEach, describe, expect, it } from "vitest";

import { documentDisplayName, selectActiveDocument, useDocuments } from "./document";

beforeEach(() => {
  // Reset the document list and the tab strip so suites stay independent.
  useDocuments.setState({ documents: [], activeId: null, tabs: [] });
});

describe("document store", () => {
  it("creates an untitled document and makes it active", () => {
    const id = useDocuments.getState().createDocument();

    const state = useDocuments.getState();
    expect(state.activeId).toBe(id);

    const doc = selectActiveDocument(state);
    expect(doc?.path).toBeNull();
    expect(doc?.markdown).toBe("");
    expect(doc?.isDirty).toBe(false);
  });

  it("seeds a document with markdown and path without marking it dirty", () => {
    const id = useDocuments.getState().createDocument({ markdown: "# Hello", path: "/tmp/a.md" });

    const doc = useDocuments.getState().documents.find((d) => d.id === id);
    expect(doc?.markdown).toBe("# Hello");
    expect(doc?.path).toBe("/tmp/a.md");
    expect(doc?.isDirty).toBe(false);
  });

  it("updates markdown and marks the document dirty", () => {
    const id = useDocuments.getState().createDocument();

    useDocuments.getState().setMarkdown(id, "changed");

    const doc = useDocuments.getState().documents.find((d) => d.id === id);
    expect(doc?.markdown).toBe("changed");
    expect(doc?.isDirty).toBe(true);
  });

  it("does not mark dirty when markdown is unchanged", () => {
    const id = useDocuments.getState().createDocument({ markdown: "same" });

    useDocuments.getState().setMarkdown(id, "same");

    const doc = useDocuments.getState().documents.find((d) => d.id === id);
    expect(doc?.isDirty).toBe(false);
  });

  it("ignores setMarkdown for an unknown id", () => {
    useDocuments.getState().createDocument();

    expect(() => useDocuments.getState().setMarkdown("nope", "x")).not.toThrow();
  });

  it("clears the dirty flag and records the path on save", () => {
    const id = useDocuments.getState().createDocument();
    useDocuments.getState().setMarkdown(id, "edited");

    useDocuments.getState().markSaved(id, "edited", "/tmp/saved.md");

    const doc = useDocuments.getState().documents.find((d) => d.id === id);
    expect(doc?.isDirty).toBe(false);
    expect(doc?.path).toBe("/tmp/saved.md");
  });

  it("keeps the existing path when markSaved is called without one", () => {
    const id = useDocuments.getState().createDocument({ path: "/tmp/a.md", markdown: "x" });
    useDocuments.getState().setMarkdown(id, "y");

    useDocuments.getState().markSaved(id, "y");

    const doc = useDocuments.getState().documents.find((d) => d.id === id);
    expect(doc?.isDirty).toBe(false);
    expect(doc?.path).toBe("/tmp/a.md");
  });

  it("stays dirty when edits arrive after the saved snapshot (save-race guard)", () => {
    const id = useDocuments.getState().createDocument({ path: "/tmp/a.md", markdown: "v1" });
    useDocuments.getState().setMarkdown(id, "v2");
    useDocuments.getState().setMarkdown(id, "v3"); // user kept typing during the write

    // Only v2 reached disk.
    useDocuments.getState().markSaved(id, "v2");

    const doc = useDocuments.getState().documents.find((d) => d.id === id);
    expect(doc?.savedMarkdown).toBe("v2");
    expect(doc?.markdown).toBe("v3");
    expect(doc?.isDirty).toBe(true); // v3 still unsaved — must not be lost
  });

  it("clears dirty when content is edited back to the baseline", () => {
    const id = useDocuments.getState().createDocument({ markdown: "base" });
    useDocuments.getState().setMarkdown(id, "edited");
    expect(useDocuments.getState().documents[0]?.isDirty).toBe(true);

    useDocuments.getState().setMarkdown(id, "base");

    expect(useDocuments.getState().documents[0]?.isDirty).toBe(false);
  });

  it("adopts a new baseline without marking dirty", () => {
    const id = useDocuments.getState().createDocument({ markdown: "raw" });

    useDocuments.getState().setBaseline(id, "normalized");
    const doc = useDocuments.getState().documents[0];
    expect(doc?.markdown).toBe("normalized");
    expect(doc?.isDirty).toBe(false);

    useDocuments.getState().setMarkdown(id, "normalized");
    expect(useDocuments.getState().documents[0]?.isDirty).toBe(false);
  });

  it("does not reset the baseline on a second setBaseline (tab remount)", () => {
    const id = useDocuments.getState().createDocument({ markdown: "raw" });
    useDocuments.getState().setBaseline(id, "normalized");
    useDocuments.getState().setMarkdown(id, "edited"); // now dirty

    // A remount re-reports the (edited) content; baseline must not move.
    useDocuments.getState().setBaseline(id, "edited");

    expect(useDocuments.getState().documents[0]?.isDirty).toBe(true);
  });

  it("replaces content from disk as a new clean baseline", () => {
    const id = useDocuments.getState().createDocument({ markdown: "old" });
    useDocuments.getState().setMarkdown(id, "edited");
    expect(useDocuments.getState().documents[0]?.isDirty).toBe(true);

    useDocuments.getState().applyExternalContent(id, "from disk");

    const doc = useDocuments.getState().documents[0];
    expect(doc?.markdown).toBe("from disk");
    expect(doc?.isDirty).toBe(false);
  });

  it("switches the active document", () => {
    const first = useDocuments.getState().createDocument();
    useDocuments.getState().createDocument();

    useDocuments.getState().setActiveDocument(first);

    expect(useDocuments.getState().activeId).toBe(first);
  });

  it("ignores setActiveDocument for an unknown id", () => {
    const id = useDocuments.getState().createDocument();

    useDocuments.getState().setActiveDocument("nope");

    expect(useDocuments.getState().activeId).toBe(id);
  });

  it("removes a document and reactivates the last remaining one on close", () => {
    const first = useDocuments.getState().createDocument();
    const second = useDocuments.getState().createDocument();

    useDocuments.getState().closeDocument(second);

    const state = useDocuments.getState();
    expect(state.documents.map((d) => d.id)).toEqual([first]);
    expect(state.activeId).toBe(first);
  });

  it("sets activeId to null when the last document is closed", () => {
    const id = useDocuments.getState().createDocument();

    useDocuments.getState().closeDocument(id);

    const state = useDocuments.getState();
    expect(state.documents).toHaveLength(0);
    expect(state.activeId).toBeNull();
  });
});

describe("documentDisplayName", () => {
  it("returns the file name for a saved document", () => {
    expect(
      documentDisplayName(
        {
          id: "1",
          path: "/Users/me/notes/todo.md",
          markdown: "",
          savedMarkdown: "",
          isDirty: false,
          baselineReady: true,
        },
        "Untitled",
      ),
    ).toBe("todo.md");
  });

  it("falls back to the untitled label when there is no path", () => {
    expect(
      documentDisplayName(
        {
          id: "1",
          path: null,
          markdown: "",
          savedMarkdown: "",
          isDirty: false,
          baselineReady: false,
        },
        "Untitled",
      ),
    ).toBe("Untitled");
  });

  it("returns the untitled label when there is no document", () => {
    expect(documentDisplayName(undefined, "Senza titolo")).toBe("Senza titolo");
  });
});

describe("document store tab strip", () => {
  it("createDocument appends a tab and activates it", () => {
    const a = useDocuments.getState().createDocument({ markdown: "a" });
    const b = useDocuments.getState().createDocument({ markdown: "b" });
    const s = useDocuments.getState();
    expect(s.tabs).toEqual([a, b]);
    expect(s.activeId).toBe(b);
  });

  it("setActiveDocument activates an open tab and ignores unknown ids", () => {
    const a = useDocuments.getState().createDocument();
    useDocuments.getState().createDocument();
    useDocuments.getState().setActiveDocument(a);
    expect(useDocuments.getState().activeId).toBe(a);
    useDocuments.getState().setActiveDocument("missing");
    expect(useDocuments.getState().activeId).toBe(a);
  });

  it("closeDocument keeps the active tab when closing another one", () => {
    const a = useDocuments.getState().createDocument();
    const b = useDocuments.getState().createDocument();
    const c = useDocuments.getState().createDocument();
    useDocuments.getState().setActiveDocument(b);
    useDocuments.getState().closeDocument(c);
    const s = useDocuments.getState();
    expect(s.tabs).toEqual([a, b]);
    expect(s.activeId).toBe(b);
  });

  it("closeDocument on the active tab falls back to the last remaining tab", () => {
    const a = useDocuments.getState().createDocument();
    const b = useDocuments.getState().createDocument();
    const c = useDocuments.getState().createDocument();
    useDocuments.getState().setActiveDocument(a);
    useDocuments.getState().closeDocument(a);
    const s = useDocuments.getState();
    expect(s.tabs).toEqual([b, c]);
    expect(s.activeId).toBe(c);
    expect(s.documents.find((d) => d.id === a)).toBeUndefined();
  });

  it("closing the last tab leaves no active document", () => {
    const a = useDocuments.getState().createDocument();
    useDocuments.getState().closeDocument(a);
    const s = useDocuments.getState();
    expect(s.tabs).toEqual([]);
    expect(s.activeId).toBeNull();
  });

  it("reorderTab moves a tab and clamps the target index", () => {
    const a = useDocuments.getState().createDocument();
    const b = useDocuments.getState().createDocument();
    const c = useDocuments.getState().createDocument();
    useDocuments.getState().reorderTab(c, 0);
    expect(useDocuments.getState().tabs).toEqual([c, a, b]);
    useDocuments.getState().reorderTab(c, 99);
    expect(useDocuments.getState().tabs).toEqual([a, b, c]);
    // Reordering keeps the active tab.
    expect(useDocuments.getState().activeId).toBe(c);
  });

  it("reorderTab ignores an id that is not open", () => {
    const a = useDocuments.getState().createDocument();
    useDocuments.getState().reorderTab("missing", 0);
    expect(useDocuments.getState().tabs).toEqual([a]);
  });
});
