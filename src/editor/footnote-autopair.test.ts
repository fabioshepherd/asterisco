import { Crepe } from "@milkdown/crepe";
import { editorViewCtx } from "@milkdown/kit/core";
import { TextSelection } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { describe, expect, it } from "vitest";

import { useSettings } from "@/stores/settings";

import { autoPairingPlugin } from "./auto-pairing";
import {
  footnoteCompletionPlugin,
  footnoteInputRule,
  registerFootnoteDecorations,
} from "./footnotes";

// Mount with the SAME plugins and order as CrepeEditor.tsx: the footnote
// completion handler must sit BEFORE auto-pairing so it intercepts the closing
// `]` (which auto-pairing would otherwise consume as a type-over).
async function mount(defaultValue = "") {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const crepe = new Crepe({ root, defaultValue });
  crepe.editor.config((ctx) => registerFootnoteDecorations(ctx));
  crepe.editor.use(footnoteInputRule).use(footnoteCompletionPlugin).use(autoPairingPlugin);
  await crepe.create();
  const view = await new Promise<EditorView>((resolve) =>
    crepe.editor.action((ctx) => resolve(ctx.get(editorViewCtx))),
  );
  return { crepe, view };
}

function caretAt(view: EditorView, pos: number) {
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)));
}

/**
 * Faithful single-char typing: run handleTextInput handlers in plugin order; if
 * none consumes the input, perform ProseMirror's default text insertion — what
 * the real editor does on a keystroke.
 */
function type(view: EditorView, text: string): void {
  const { from, to } = view.state.selection;
  const consumed =
    view.someProp("handleTextInput", (f) => f(view, from, to, text, () => view.state.tr)) ?? false;
  if (!consumed) {
    view.dispatch(view.state.tr.insertText(text, from, to).scrollIntoView());
  }
}

function labels(view: EditorView, name: string): string[] {
  const out: string[] = [];
  view.state.doc.descendants((node) => {
    if (node.type.name === name) out.push(String(node.attrs.label ?? ""));
    return true;
  });
  return out;
}

describe("footnote completion with auto-pairing", () => {
  it("creates a footnote when typing [^1] naturally (auto-pairing ON)", async () => {
    useSettings.getState().setAutoPairing(true);
    const { view } = await mount("");
    caretAt(view, 1);
    for (const ch of "[^1]") type(view, ch);
    expect(labels(view, "footnote_reference")).toEqual(["1"]);
    expect(labels(view, "footnote_definition")).toEqual(["1"]);
  });

  it("strips the auto-paired ] when typing ^ right after [ (Typora-style open)", async () => {
    // The real-world flow: auto-pairing turns `[` into `[]`; typing `^` must drop
    // the auto-inserted closer so the footnote opener stays open (`[^`) and the
    // user types the closing `]` themselves, which the input rule then catches.
    useSettings.getState().setAutoPairing(true);
    const { view } = await mount("");
    caretAt(view, 1);
    type(view, "[");
    type(view, "^");
    expect(view.state.doc.textContent).toBe("[^");
  });

  it("supports multi-character labels: [^note]", async () => {
    useSettings.getState().setAutoPairing(true);
    const { view } = await mount("");
    caretAt(view, 1);
    for (const ch of "[^note]") type(view, ch);
    expect(labels(view, "footnote_reference")).toEqual(["note"]);
    expect(labels(view, "footnote_definition")).toEqual(["note"]);
  });

  it("does not create a footnote inside a code block", async () => {
    useSettings.getState().setAutoPairing(true);
    const { crepe, view } = await mount("```\ncode\n```");
    caretAt(view, 3);
    for (const ch of "[^1]") type(view, ch);
    expect(labels(view, "footnote_reference")).toEqual([]);
    expect(crepe.getMarkdown()).not.toContain("footnote");
  });

  it("regression: still works with auto-pairing OFF", async () => {
    useSettings.getState().setAutoPairing(false);
    const { view } = await mount("");
    caretAt(view, 1);
    for (const ch of "[^1]") type(view, ch);
    expect(labels(view, "footnote_reference")).toEqual(["1"]);
    useSettings.getState().setAutoPairing(true);
  });
});
