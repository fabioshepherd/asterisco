import { Crepe } from "@milkdown/crepe";
import { editorViewCtx } from "@milkdown/kit/core";
import { Selection } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { describe, expect, it } from "vitest";

import { configureMarkdownFidelity } from "./markdown-fidelity";

async function mountCrepe(defaultValue = "") {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const crepe = new Crepe({ root, defaultValue });
  configureMarkdownFidelity(crepe);
  await crepe.create();
  const view = await new Promise<EditorView>((resolve) =>
    crepe.editor.action((ctx) => resolve(ctx.get(editorViewCtx))),
  );
  return { crepe, view };
}

/** Fire a keydown through the editor's keymap stack, as ProseMirror would. */
function pressEnter(view: EditorView): boolean {
  return (
    view.someProp("handleKeyDown", (f) =>
      f(view, new KeyboardEvent("keydown", { key: "Enter" })),
    ) ?? false
  );
}

describe("list behaviour: empty item / list exit serialization", () => {
  it("a continued-then-empty list item does not leave a <br /> artifact", async () => {
    const { crepe, view } = await mountCrepe("- Alpha\n");
    view.dispatch(view.state.tr.setSelection(Selection.atEnd(view.state.doc)));
    pressEnter(view); // new empty list item
    expect(crepe.getMarkdown()).not.toContain("<br");
  });

  it("exiting a list with Enter on an empty item leaves clean markdown", async () => {
    const { crepe, view } = await mountCrepe("- Alpha\n");
    view.dispatch(view.state.tr.setSelection(Selection.atEnd(view.state.doc)));
    pressEnter(view); // empty item
    pressEnter(view); // exit to paragraph
    expect(crepe.getMarkdown()).not.toContain("<br");
  });

  it("preserves an intentional hard break (two-space line break) — not affected", async () => {
    const { crepe } = await mountCrepe("first  \nsecond\n");
    // A real hardbreak node round-trips; disabling empty-line preservation must
    // not touch it (it is a distinct node from an empty paragraph).
    expect(crepe.getMarkdown()).toContain("second");
  });
});
