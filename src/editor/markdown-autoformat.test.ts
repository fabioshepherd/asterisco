import { Crepe } from "@milkdown/crepe";
import { editorViewCtx } from "@milkdown/kit/core";
import { TextSelection } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { beforeEach, describe, expect, it } from "vitest";

import { useSettings } from "@/stores/settings";

import { autoPairingPlugin } from "./auto-pairing";
import { linkInputRule } from "./link-input-rule";

/**
 * Mount a Crepe editor with the same plugin chain order the app uses for the
 * markdown-autoformat surface: the commonmark preset (inline-code / emphasis
 * input rules) plus our link input rule, with auto-pairing `.use`d LAST — this
 * ordering is what makes auto-pairing's type-over win over the input rules, which
 * is the exact interaction under test.
 */
async function mount(defaultValue = "") {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const crepe = new Crepe({ root, defaultValue });
  crepe.editor.use(linkInputRule).use(autoPairingPlugin);
  await crepe.create();
  const view = await new Promise<EditorView>((resolve) =>
    crepe.editor.action((ctx) => resolve(ctx.get(editorViewCtx))),
  );
  return { crepe, view };
}

/**
 * Type a string one character at a time exactly as ProseMirror would: run the
 * `handleTextInput` prop chain (auto-pairing + input rules); when nothing claims
 * the keystroke, apply the default text insertion. This faithfully reproduces
 * real typing, so input rules fire on the completing character.
 */
function typeText(view: EditorView, str: string) {
  for (const ch of str) {
    const { from, to } = view.state.selection;
    const handled = view.someProp("handleTextInput", (f) =>
      f(view, from, to, ch, () => view.state.tr),
    );
    if (!handled) view.dispatch(view.state.tr.insertText(ch, from, to));
  }
}

function caretAtStart(view: EditorView) {
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1)));
}

describe("markdown autoformat cooperates with auto-pairing", () => {
  beforeEach(() => {
    useSettings.getState().setAutoPairing(true);
  });

  it("typing `code` produces a real inline-code mark", async () => {
    const { crepe, view } = await mount("");
    caretAtStart(view);
    typeText(view, "`code`");
    const md = crepe.getMarkdown();
    expect(md).toContain("`code`");
    expect(md).not.toContain("\\`");
  });

  it("typing [text](url) produces a real link", async () => {
    const { crepe, view } = await mount("");
    caretAtStart(view);
    typeText(view, "[text](https://example.com)");
    const md = crepe.getMarkdown();
    expect(md).toContain("[text](https://example.com)");
    expect(md).not.toContain("\\[");
  });

  it("still auto-pairs a lone opening bracket (no regression)", async () => {
    const { crepe, view } = await mount("x");
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 2)));
    typeText(view, "(");
    expect(crepe.getMarkdown()).toContain("x()");
  });
});
