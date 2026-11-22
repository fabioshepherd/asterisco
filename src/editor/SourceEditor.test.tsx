import type { Crepe } from "@milkdown/crepe";
import { EditorView } from "@codemirror/view";
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useDocuments } from "@/stores/document";

import { registerEditor, setActiveEditor, unregisterEditor } from "./active-editor";
import { SourceEditor } from "./SourceEditor";

/** Minimal Crepe stand-in: only the methods SourceEditor touches. */
function fakeCrepe(markdown: string) {
  const action = vi.fn();
  return {
    getMarkdown: () => markdown,
    editor: { action },
  } as unknown as Crepe & { editor: { action: ReturnType<typeof vi.fn> } };
}

afterEach(() => {
  useDocuments.setState({ documents: [], activeId: null, tabs: [] });
});

describe("SourceEditor document resolution", () => {
  it("seeds from and writes back to its OWN document, never the active editor's", () => {
    // Two docs open; A's editor is the globally-active one.
    const idA = useDocuments.getState().createDocument({ markdown: "AAA", path: "/a.md" });
    const idB = useDocuments.getState().createDocument({ markdown: "BBB", path: "/b.md" });
    const crepeA = fakeCrepe("AAA");
    const crepeB = fakeCrepe("BBB");
    registerEditor(idA, crepeA);
    registerEditor(idB, crepeB);
    setActiveEditor(crepeA); // would be the WRONG target if resolution were global

    // Source mode mounts a SourceEditor for document B.
    const { container, unmount } = render(
      <SourceEditor id={idB} ariaLabel="b.md, Markdown source" />,
    );
    // The editing surface is named after the document (WCAG 4.1.2).
    expect(container.querySelector(".cm-content")?.getAttribute("aria-label")).toBe(
      "b.md, Markdown source",
    );
    // An edit, so leaving Source mode has something to write back.
    const view = EditorView.findFromDOM(container.querySelector<HTMLElement>(".cm-editor")!)!;
    view.dispatch({ changes: { from: view.state.doc.length, insert: "!" } });
    unmount();

    // The bug seeded B from A and on unmount overwrote B's store entry with "AAA".
    const docB = useDocuments.getState().documents.find((d) => d.id === idB);
    expect(docB?.markdown).toBe("BBB!");
    // Write-back must target B's editor, not the globally-active A.
    expect(crepeB.editor.action).toHaveBeenCalled();
    expect(crepeA.editor.action).not.toHaveBeenCalled();

    unregisterEditor(idA, crepeA);
    unregisterEditor(idB, crepeB);
  });

  it("leaves the WYSIWYG editor untouched when the source was not edited (EDITOR-06)", () => {
    // replaceAll with the same text would still add an undo step and move the caret.
    const id = useDocuments.getState().createDocument({ markdown: "Same", path: "/s.md" });
    const crepe = fakeCrepe("Same");
    registerEditor(id, crepe);

    const { unmount } = render(<SourceEditor id={id} ariaLabel="s.md, Markdown source" />);
    unmount();

    expect(crepe.editor.action).not.toHaveBeenCalled();
    expect(useDocuments.getState().documents.find((d) => d.id === id)?.markdown).toBe("Same");
    unregisterEditor(id, crepe);
  });
});
