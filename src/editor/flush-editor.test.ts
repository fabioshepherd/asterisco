import type { Crepe } from "@milkdown/crepe";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useDocuments } from "@/stores/document";
import { useUi } from "@/stores/ui";

import { registerEditor, setActiveEditor, unregisterEditor } from "./active-editor";
import { flushActiveEditor } from "./flush-editor";

/** A fake Crepe whose live content is whatever `content.value` holds. */
function fakeEditor(content: { value: string }): Crepe {
  return { getMarkdown: () => content.value } as unknown as Crepe;
}

function doc(id: string) {
  const found = useDocuments.getState().documents.find((d) => d.id === id);
  if (!found) throw new Error(`no doc ${id}`);
  return found;
}

describe("flushActiveEditor", () => {
  let id: string;
  const live = { value: "" };
  let editor: Crepe;

  beforeEach(() => {
    useDocuments.setState({ documents: [], activeId: null });
    useUi.setState({ viewMode: "edit" });
    id = useDocuments.getState().createDocument({ path: "/n.md", markdown: "a\n" });
    useDocuments.getState().setBaseline(id, "a\n");
    live.value = "a\n";
    editor = fakeEditor(live);
    registerEditor(id, editor);
    setActiveEditor(editor);
  });

  afterEach(() => {
    unregisterEditor(id, editor);
    setActiveEditor(null);
  });

  it("pushes edits the debounced listener has not reported yet", () => {
    live.value = "a\nb\n";
    flushActiveEditor(id);
    expect(doc(id).markdown).toBe("a\nb\n");
    expect(doc(id).isDirty).toBe(true);
  });

  it("does not mark a clean document dirty when nothing changed", () => {
    flushActiveEditor(id);
    expect(doc(id).markdown).toBe("a\n");
    expect(doc(id).isDirty).toBe(false);
  });

  it("keeps markSaved semantics: a flushed save leaves the doc clean", () => {
    live.value = "a\nb\n";
    flushActiveEditor(id);
    useDocuments.getState().markSaved(id, doc(id).markdown);
    expect(doc(id).isDirty).toBe(false);
    flushActiveEditor(id); // a second flush with no change stays clean
    expect(doc(id).isDirty).toBe(false);
  });

  it("ignores an active editor that renders another document", () => {
    const other = useDocuments.getState().createDocument({ markdown: "x\n" });
    live.value = "changed\n";
    flushActiveEditor(other);
    expect(doc(other).markdown).toBe("x\n");
    expect(doc(id).markdown).toBe("a\n");
  });

  it("skips source mode, where CodeMirror already owns the store", () => {
    useUi.setState({ viewMode: "source" });
    useDocuments.getState().setMarkdown(id, "from source\n");
    live.value = "stale wysiwyg\n";
    flushActiveEditor(id);
    expect(doc(id).markdown).toBe("from source\n");
  });

  it("does nothing when no editor is active or it is tearing down", () => {
    setActiveEditor(null);
    live.value = "a\nb\n";
    flushActiveEditor(id);
    expect(doc(id).markdown).toBe("a\n");

    const broken = {
      getMarkdown: () => {
        throw new Error("destroyed");
      },
    } as unknown as Crepe;
    registerEditor(id, broken);
    setActiveEditor(broken);
    expect(() => flushActiveEditor(id)).not.toThrow();
    expect(doc(id).markdown).toBe("a\n");
    unregisterEditor(id, broken);
  });
});
