import { Crepe } from "@milkdown/crepe";
import { editorViewCtx } from "@milkdown/kit/core";
import type { EditorView } from "@milkdown/kit/prose/view";
import { describe, expect, it } from "vitest";

import { configureMarkdownFidelity } from "./markdown-fidelity";

/** Mount a Crepe configured the way CrepeEditor configures it before `create()`. */
async function mountCrepe(defaultValue: string) {
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

/** Type a character at the end of the first paragraph: a real edit, a fresh serialization. */
function editFirstParagraph(view: EditorView): void {
  let end = -1;
  view.state.doc.descendants((node, pos) => {
    if (end >= 0) return false;
    if (node.type.name === "paragraph") end = pos + node.nodeSize - 1;
    return true;
  });
  view.dispatch(view.state.tr.insertText("!", end));
}

describe("markdown fidelity: what the user did not edit is written back as it was", () => {
  it("keeps lines holding only <br> after an edit elsewhere", async () => {
    const source = "a\n\n<br>\n\nc\n\n<br />\n\nb\n";
    const { crepe, view } = await mountCrepe(source);
    expect(crepe.getMarkdown()).toBe(source);
    editFirstParagraph(view);
    expect(crepe.getMarkdown()).toBe(source.replace(/^a/, "a!"));
  });

  it("writes `-` bullets as `-`", async () => {
    const source = "intro\n\n- one\n- two\n  - nested\n";
    const { crepe, view } = await mountCrepe(source);
    expect(crepe.getMarkdown()).toBe(source);
    editFirstParagraph(view);
    expect(crepe.getMarkdown()).toBe(source.replace("intro", "intro!"));
  });

  it("keeps `- [ ]` / `- [x]` task items", async () => {
    const source = "- [ ] open\n- [x] done\n";
    const { crepe } = await mountCrepe(source);
    expect(crepe.getMarkdown()).toBe(source);
  });

  it("an empty paragraph serializes as a blank line, not <br />", async () => {
    const { crepe, view } = await mountCrepe("a\n\nb\n");
    const afterFirst = view.state.doc.child(0).nodeSize;
    view.dispatch(view.state.tr.insert(afterFirst, view.state.schema.nodes.paragraph!.create()));
    expect(crepe.getMarkdown()).not.toContain("<br");
  });
});
