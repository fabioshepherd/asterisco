import { Crepe } from "@milkdown/crepe";
import { editorViewCtx } from "@milkdown/kit/core";
import { TextSelection } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { describe, expect, it } from "vitest";

import { useSettings } from "@/stores/settings";

import { autoPairingPlugin, decideInput, isEmptyPair, type InputContext } from "./auto-pairing";

/** Build a context with sensible empty-caret defaults; override per case. */
function ctx(partial: Partial<InputContext> & { char: string }): InputContext {
  return {
    charBefore: null,
    charAfter: null,
    hasSelection: false,
    ...partial,
  };
}

describe("decideInput: brackets", () => {
  it("pairs an open bracket at end of block", () => {
    expect(decideInput(ctx({ char: "(" }))).toEqual({
      kind: "pair",
      open: "(",
      close: ")",
    });
  });

  it("pairs before whitespace and before a closing char", () => {
    expect(decideInput(ctx({ char: "[", charAfter: " " })).kind).toBe("pair");
    expect(decideInput(ctx({ char: "[", charAfter: ")" })).kind).toBe("pair");
  });

  it("pairs before a curly closing quote", () => {
    expect(decideInput(ctx({ char: "(", charAfter: "”" })).kind).toBe("pair");
  });

  it("does NOT pair directly before a word character (suppression)", () => {
    expect(decideInput(ctx({ char: "(", charAfter: "w" }))).toEqual({ kind: "none" });
  });

  it("wraps a selection", () => {
    expect(decideInput(ctx({ char: "{", hasSelection: true }))).toEqual({
      kind: "wrap",
      open: "{",
      close: "}",
    });
  });

  it("types over a matching closing bracket", () => {
    expect(decideInput(ctx({ char: ")", charAfter: ")" }))).toEqual({ kind: "typeOver" });
  });

  it("a closing bracket with no match does nothing special", () => {
    expect(decideInput(ctx({ char: ")", charAfter: "x" }))).toEqual({ kind: "none" });
  });
});

describe("decideInput: backtick", () => {
  it("pairs at end of block", () => {
    expect(decideInput(ctx({ char: "`" }))).toEqual({ kind: "pair", open: "`", close: "`" });
  });
  it("types over a matching backtick", () => {
    expect(decideInput(ctx({ char: "`", charAfter: "`" }))).toEqual({ kind: "typeOver" });
  });
  it("is suppressed before a word", () => {
    expect(decideInput(ctx({ char: "`", charAfter: "x" }))).toEqual({ kind: "none" });
  });
});

describe("decideInput: double quotes", () => {
  it("pairs with straight glyphs", () => {
    expect(decideInput(ctx({ char: '"' }))).toEqual({
      kind: "pair",
      open: '"',
      close: '"',
    });
  });
  it("pairs even directly before a word (no suppression for quotes)", () => {
    expect(decideInput(ctx({ char: '"', charAfter: "w" })).kind).toBe("pair");
  });
  it("wraps a selection with straight quotes", () => {
    expect(decideInput(ctx({ char: '"', hasSelection: true }))).toEqual({
      kind: "wrap",
      open: '"',
      close: '"',
    });
  });
  it("prefers wrap over type-over when a selection exists", () => {
    expect(decideInput(ctx({ char: '"', hasSelection: true, charAfter: '"' }))).toEqual({
      kind: "wrap",
      open: '"',
      close: '"',
    });
  });
  it("types over any double-quote glyph", () => {
    expect(decideInput(ctx({ char: '"', charAfter: "”" }))).toEqual({ kind: "typeOver" });
    expect(decideInput(ctx({ char: '"', charAfter: '"' }))).toEqual({ kind: "typeOver" });
  });
});

describe("decideInput: single quotes (context-aware)", () => {
  it("pairs only in opening position", () => {
    expect(decideInput(ctx({ char: "'", charBefore: null })).kind).toBe("pair"); // start
    expect(decideInput(ctx({ char: "'", charBefore: " " })).kind).toBe("pair"); // after space
    expect(decideInput(ctx({ char: "'", charBefore: "(" })).kind).toBe("pair"); // after open bracket
  });
  it("does NOT pair after a word character (apostrophe: don't / it's)", () => {
    expect(decideInput(ctx({ char: "'", charBefore: "n" }))).toEqual({ kind: "none" });
  });
  it("does NOT pair after a closing bracket", () => {
    expect(decideInput(ctx({ char: "'", charBefore: ")" }))).toEqual({ kind: "none" });
  });
  it("pairs with straight glyphs", () => {
    expect(decideInput(ctx({ char: "'" }))).toEqual({
      kind: "pair",
      open: "'",
      close: "'",
    });
  });
  it("still wraps a selection regardless of preceding char", () => {
    expect(decideInput(ctx({ char: "'", charBefore: "n", hasSelection: true })).kind).toBe("wrap");
  });
  it("types over any single-quote glyph", () => {
    expect(decideInput(ctx({ char: "'", charAfter: "’" }))).toEqual({ kind: "typeOver" });
  });
});

describe("decideInput: out of scope", () => {
  it("ignores * and _ and ordinary letters", () => {
    expect(decideInput(ctx({ char: "*" }))).toEqual({ kind: "none" });
    expect(decideInput(ctx({ char: "_" }))).toEqual({ kind: "none" });
    expect(decideInput(ctx({ char: "a" }))).toEqual({ kind: "none" });
  });
});

describe("isEmptyPair", () => {
  it("recognises straight and curly empty pairs", () => {
    expect(isEmptyPair("(", ")")).toBe(true);
    expect(isEmptyPair("`", "`")).toBe(true);
    expect(isEmptyPair("“", "”")).toBe(true);
    expect(isEmptyPair("‘", "’")).toBe(true);
    expect(isEmptyPair('"', '"')).toBe(true);
  });
  it("rejects non-pairs", () => {
    expect(isEmptyPair("(", "]")).toBe(false);
    expect(isEmptyPair("a", "b")).toBe(false);
    expect(isEmptyPair(null, ")")).toBe(false);
  });
});

async function mountWithPairing(defaultValue = "") {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const crepe = new Crepe({ root, defaultValue });
  crepe.editor.use(autoPairingPlugin);
  await crepe.create();
  const view = await new Promise<EditorView>((resolve) =>
    crepe.editor.action((ctx) => resolve(ctx.get(editorViewCtx))),
  );
  return { crepe, view };
}

/** Place the caret at document position `pos` (1 = start of first paragraph). */
function caretAt(view: EditorView, pos: number) {
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)));
}

/**
 * Fire the plugin's `handleTextInput` as ProseMirror would for a single key. The
 * prop's signature takes a 5th `deflt` callback (the default text insertion); our
 * handler ignores it, so we pass a thunk returning the no-op transaction to keep
 * the call type-safe.
 */
function type(view: EditorView, text: string): boolean {
  const { from, to } = view.state.selection;
  return (
    view.someProp("handleTextInput", (f) => f(view, from, to, text, () => view.state.tr)) ?? false
  );
}

describe("auto-pairing plugin (integration)", () => {
  it("inserts a closing bracket and keeps the caret inside", async () => {
    const { crepe, view } = await mountWithPairing("x");
    caretAt(view, 2); // after "x", end of block
    expect(type(view, "(")).toBe(true);
    expect(crepe.getMarkdown()).toContain("x()");
  });

  it("does nothing when the setting is off", async () => {
    useSettings.getState().setAutoPairing(false);
    const { view } = await mountWithPairing("x");
    caretAt(view, 2);
    expect(type(view, "(")).toBe(false);
    useSettings.getState().setAutoPairing(true);
  });

  it("does not pair inside a code block", async () => {
    const { crepe, view } = await mountWithPairing("```\ncode\n```");
    caretAt(view, 3); // caret somewhere inside the code text
    type(view, "(");
    expect(crepe.getMarkdown()).not.toContain("()");
  });

  it("Backspace removes an empty pair", async () => {
    const { crepe, view } = await mountWithPairing("x");
    caretAt(view, 2);
    type(view, "(");
    const handled = view.someProp("handleKeyDown", (f) =>
      f(view, new KeyboardEvent("keydown", { key: "Backspace" })),
    );
    expect(handled).toBe(true);
    expect(crepe.getMarkdown()).not.toContain("()");
  });

  it("wraps a selection inside one paragraph", async () => {
    const { crepe, view } = await mountWithPairing("word");
    // Select the whole word "word" (positions 1..5 inside the single paragraph).
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 5)));
    expect(type(view, "(")).toBe(true);
    expect(crepe.getMarkdown()).toContain("(word)");
  });

  it("does NOT wrap a selection spanning two paragraphs (cross-block guard)", async () => {
    const { crepe, view } = await mountWithPairing("aaa\n\nbbb");
    const { doc } = view.state;
    // Span from inside the first paragraph to inside the second. Position 2 sits
    // in paragraph one; `content.size - 2` sits in paragraph two — verified to
    // resolve into different parents below before relying on it.
    const anchor = 2;
    const head = doc.content.size - 2;
    expect(doc.resolve(anchor).sameParent(doc.resolve(head))).toBe(false);
    view.dispatch(view.state.tr.setSelection(TextSelection.create(doc, anchor, head)));
    expect(type(view, "(")).toBe(false);
    // The document is untouched: both paragraphs intact and no stray "(".
    const md = crepe.getMarkdown();
    expect(md).toContain("aaa");
    expect(md).toContain("bbb");
    expect(md).not.toContain("(");
  });
});
