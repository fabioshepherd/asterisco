import { Crepe } from "@milkdown/crepe";
import type { Ctx } from "@milkdown/kit/ctx";
import type { EditorState, Transaction } from "@milkdown/kit/prose/state";
import { TextSelection } from "@milkdown/kit/prose/state";
import type { DecorationSet } from "@milkdown/kit/prose/view";
import { describe, expect, it } from "vitest";

import { viewFromCtx } from "./editor-view";
import {
  assignFootnoteNumbers,
  buildBacklinkButton,
  findDefinitionPos,
  findReferencePos,
  footnoteDecoKey,
  footnoteInputRule,
  insertFootnoteAtSelection,
  nextFootnoteLabel,
  registerFootnoteDecorations,
  registerFootnoteInteraction,
} from "./footnotes";

async function mountCrepe(
  defaultValue: string,
  config?: (ctx: Ctx) => void,
  // Register plugins (e.g. a `$inputRule`) on the underlying editor BEFORE
  // create(), the only point at which their registration closure runs.
  setup?: (crepe: Crepe) => void,
) {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const crepe = new Crepe({ root, defaultValue });
  if (config) crepe.editor.config(config);
  if (setup) setup(crepe);
  await crepe.create();
  return { crepe, root };
}

const SAMPLE = `Claim one.[^1] Claim two.[^note]

Body paragraph.

[^1]: First footnote.
[^note]: Second footnote with **bold**.
`;

describe("footnotes: gfm round-trip (baseline)", () => {
  it("preserves footnote references and definitions through Crepe", async () => {
    const { crepe } = await mountCrepe(SAMPLE);
    const out = crepe.getMarkdown();
    expect(out).toContain("[^1]");
    expect(out).toContain("[^note]");
    expect(out).toContain("[^1]: First footnote.");
    expect(out).toContain("[^note]: Second footnote with **bold**.");
  });

  it("renders refs as sup and definitions as dl", async () => {
    const { root } = await mountCrepe(SAMPLE);
    expect(root.querySelectorAll('sup[data-type="footnote_reference"]').length).toBe(2);
    expect(root.querySelectorAll('dl[data-type="footnote_definition"]').length).toBe(2);
  });
});

describe("footnotes: numbering", () => {
  it("numbers labels sequentially by first appearance", () => {
    const refs = ["note", "1", "note", "z"]; // document order of references
    const result = assignFootnoteNumbers(refs);
    expect(result.get("note")).toBe(1);
    expect(result.get("1")).toBe(2);
    expect(result.get("z")).toBe(3);
  });

  it("ignores empty labels", () => {
    expect(assignFootnoteNumbers(["", "a", ""]).get("a")).toBe(1);
  });
});

describe("footnotes: numbering decorations", () => {
  // First ref is the text label [^note] -> 1, second is [^1] -> 2. Definitions
  // appear in the reverse order ([^1] then [^note]) to prove that each half of
  // buildDecorations resolves a label to its reference-order number independently.
  const md = `A.[^note] B.[^1]\n\n[^1]: one\n[^note]: two\n`;

  /** Collect the `style` attr of every decoration matching `cls`, in find() order. */
  function collectStyles(crepe: Crepe, cls: "fn-ref" | "fn-def"): string[] {
    const styles: string[] = [];
    crepe.editor.action((ctx) => {
      const { state } = viewFromCtx(ctx);
      const set = footnoteDecoKey.getState(state) as DecorationSet | undefined;
      expect(set).toBeDefined();
      for (const deco of set!.find()) {
        // Node decorations store their spec attributes on `type.attrs`.
        const attrs = (deco as unknown as { type: { attrs?: Record<string, string> } }).type.attrs;
        if (attrs?.class === cls && typeof attrs.style === "string") styles.push(attrs.style);
      }
    });
    return styles;
  }

  it("numbers refs in reference order even when labels are non-numeric", async () => {
    // This proves the displayed number follows reference order, not the label.
    // Read the decoration set straight from plugin state: DOM `style` attrs are
    // not reliably populated under jsdom, but the plugin state is.
    const { crepe } = await mountCrepe(md, (ctx) => registerFootnoteDecorations(ctx));

    // Refs come out in document order: [^note] then [^1].
    expect(collectStyles(crepe, "fn-ref")).toEqual(["--fn-num:'1'", "--fn-num:'2'"]);
  });

  it("numbers definitions by their reference's ordinal, not document order", async () => {
    const { crepe } = await mountCrepe(md, (ctx) => registerFootnoteDecorations(ctx));

    // Definitions in document order are [^1] (ref #2) then [^note] (ref #1):
    // each carries its referenced number, not its position among definitions.
    expect(collectStyles(crepe, "fn-def")).toEqual(["--fn-num:'2'", "--fn-num:'1'"]);
  });

  it("sets no --fn-num style on an orphan (unreferenced) definition", async () => {
    // [^a] is referenced (gets a number); [^b] is defined but never referenced.
    // The orphan must carry the `fn-def` class but NO `--fn-num` style, so the CSS
    // `content: var(--fn-num, attr(data-label))` falls back to the raw label.
    const orphanMd = `Has ref.[^a]\n\n[^a]: used\n[^b]: orphan\n`;
    const { crepe } = await mountCrepe(orphanMd, (ctx) => registerFootnoteDecorations(ctx));

    // Collect, per fn-def decoration in find() order, whether it has a `--fn-num` style.
    const styles: (string | undefined)[] = [];
    crepe.editor.action((ctx) => {
      const { state } = viewFromCtx(ctx);
      const set = footnoteDecoKey.getState(state) as DecorationSet | undefined;
      expect(set).toBeDefined();
      for (const deco of set!.find()) {
        const attrs = (deco as unknown as { type: { attrs?: Record<string, string> } }).type.attrs;
        if (attrs?.class === "fn-def") styles.push(attrs.style);
      }
    });
    // Two definitions: the referenced [^a] carries --fn-num:'1'; the orphan [^b]
    // has no style at all (undefined), so it falls back to attr(data-label).
    expect(styles).toContain("--fn-num:'1'");
    expect(styles).toContain(undefined);
    expect(styles.filter((s) => s !== undefined)).toEqual(["--fn-num:'1'"]);
  });
});

describe("footnotes: jump resolvers", () => {
  it("finds the definition position for a label", async () => {
    const { crepe } = await mountCrepe(`X.[^a]\n\n[^a]: body\n`);
    let pos = -1;
    crepe.editor.action((ctx) => {
      pos = findDefinitionPos(viewFromCtx(ctx).state.doc, "a");
    });
    expect(pos).toBeGreaterThanOrEqual(0);
  });

  it("returns -1 when no definition matches the label", async () => {
    const { crepe } = await mountCrepe(`X.[^a]\n\n[^a]: body\n`);
    let pos = 0;
    crepe.editor.action((ctx) => {
      pos = findDefinitionPos(viewFromCtx(ctx).state.doc, "missing");
    });
    expect(pos).toBe(-1);
  });

  it("finds the first reference position for a label", async () => {
    const { crepe } = await mountCrepe(`X.[^a]\n\n[^a]: body\n`);
    let pos = -1;
    crepe.editor.action((ctx) => {
      pos = findReferencePos(viewFromCtx(ctx).state.doc, "a");
    });
    expect(pos).toBeGreaterThanOrEqual(0);
  });

  it("returns -1 when no reference matches the label", async () => {
    const { crepe } = await mountCrepe(`X.[^a]\n\n[^a]: body\n`);
    let pos = 0;
    crepe.editor.action((ctx) => {
      pos = findReferencePos(viewFromCtx(ctx).state.doc, "missing");
    });
    expect(pos).toBe(-1);
  });
});

describe("footnotes: backlink", () => {
  it("buildBacklinkButton produces an accessible button with the numbered label", () => {
    const btn = buildBacklinkButton("a", 1);
    expect(btn.tagName).toBe("BUTTON");
    expect(btn.getAttribute("type")).toBe("button");
    expect(btn.classList.contains("fn-backlink")).toBe(true);
    expect(btn.dataset.fnLabel).toBe("a");
    expect(btn.getAttribute("aria-label")).toMatch(/1/);
  });

  it("falls back to the raw label in the aria-label when unnumbered", () => {
    const btn = buildBacklinkButton("note", null);
    expect(btn.getAttribute("aria-label")).toMatch(/note/);
  });

  it("emits a focusable backlink button per definition (interaction registered)", async () => {
    const { root } = await mountCrepe(`X.[^a]\n\n[^a]: body\n`, (ctx) => {
      registerFootnoteDecorations(ctx);
      registerFootnoteInteraction(ctx);
    });
    const btn = root.querySelector<HTMLButtonElement>(
      'dl[data-type="footnote_definition"] button.fn-backlink',
    );
    expect(btn).not.toBeNull();
    expect(btn!.getAttribute("aria-label")).toMatch(/1/);
  });
});

describe("footnotes: hover preview", () => {
  // jsdom has no layout (getBoundingClientRect returns zeros) and unreliable
  // hover, so we cannot assert positioning. We CAN dispatch a real `mouseover`
  // event on the marker and assert the read-only popover appears in <body> with
  // the definition's text and an accessible label — this exercises the handler
  // and the show/hide path without depending on layout.
  it("shows a read-only popover with the definition text on marker mouseover", async () => {
    const { root } = await mountCrepe(`X.[^a]\n\n[^a]: hover body\n`, (ctx) => {
      registerFootnoteDecorations(ctx);
      registerFootnoteInteraction(ctx);
    });
    const sup = root.querySelector<HTMLElement>('sup[data-type="footnote_reference"]');
    expect(sup).not.toBeNull();

    sup!.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));

    const popover = document.querySelector<HTMLElement>(".fn-popover");
    expect(popover).not.toBeNull();
    expect(popover!.hidden).toBe(false);
    expect(popover!.getAttribute("role")).toBe("tooltip");
    // pointer-events:none + read-only: it carries the definition's text only.
    expect(popover!.textContent).toContain("hover body");
    expect(popover!.getAttribute("aria-label")).toMatch(/1/);

    // Mouse-out away from the popover dismisses it.
    sup!.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, relatedTarget: root }));
    expect(popover!.hidden).toBe(true);
  });
});

describe("footnotes: input rule", () => {
  it("exports a defined input-rule plugin", () => {
    expect(footnoteInputRule).toBeDefined();
    expect(typeof footnoteInputRule).toBe("function");
  });

  // The `InputRule.handler` is runtime-accessible but not in the public type, so
  // we narrow to just the shape we invoke.
  type RuleHandler = (
    state: EditorState,
    match: RegExpExecArray,
    start: number,
    end: number,
  ) => Transaction | null;

  // We avoid simulating typing (unreliable under jsdom). Instead we register the
  // rule before create() — the only point its closure populates `.inputRule` —
  // and invoke that constructed `InputRule.handler` directly against the live
  // document, a deterministic check of the transform itself.
  function ruleHandler(): RuleHandler {
    const ir = (footnoteInputRule as unknown as { inputRule?: { handler: RuleHandler } }).inputRule;
    expect(ir).toBeDefined();
    return ir!.handler;
  }

  it("replaces [^x] with a footnote_reference and appends an empty definition", async () => {
    const { crepe } = await mountCrepe(
      `Start [^x]`,
      (ctx) => registerFootnoteDecorations(ctx),
      (c) => c.editor.use(footnoteInputRule),
    );
    let refLabels: string[] = [];
    let defLabels: string[] = [];
    crepe.editor.action((ctx) => {
      const view = viewFromCtx(ctx);
      const handler = ruleHandler();
      // The literal `[^x]` sits at the end of the first paragraph. Locate it and
      // feed its [start, end] document range to the handler, mimicking the moment
      // the closing `]` is typed.
      const text = view.state.doc.textContent;
      const idx = text.indexOf("[^x]");
      expect(idx).toBeGreaterThanOrEqual(0);
      // +1 converts the paragraph text offset to a document position.
      const start = idx + 1;
      const end = start + "[^x]".length;
      const match = /\[\^([^\]\s]+)\]$/.exec("[^x]") as RegExpExecArray;
      const tr = handler(view.state, match, start, end);
      expect(tr).not.toBeNull();
      view.dispatch(tr!);

      const doc = viewFromCtx(ctx).state.doc;
      refLabels = [];
      defLabels = [];
      doc.descendants((node) => {
        if (node.type.name === "footnote_reference") refLabels.push(String(node.attrs.label));
        if (node.type.name === "footnote_definition") defLabels.push(String(node.attrs.label));
        return true;
      });
    });
    expect(refLabels).toEqual(["x"]);
    expect(defLabels).toEqual(["x"]);
  });

  it("does not append a second definition when one already exists", async () => {
    const { crepe } = await mountCrepe(
      `A [^x] and B\n\n[^x]: body\n`,
      (ctx) => registerFootnoteDecorations(ctx),
      (c) => c.editor.use(footnoteInputRule),
    );
    let defCount = -1;
    let secondTr: unknown = null;
    crepe.editor.action((ctx) => {
      const view = viewFromCtx(ctx);
      // A definition for "x" already exists, so the rule must NOT append another.
      expect(findDefinitionPos(view.state.doc, "x")).toBeGreaterThanOrEqual(0);
      const handler = ruleHandler();
      const match = /\[\^([^\]\s]+)\]$/.exec("[^x]") as RegExpExecArray;
      // Run the handler against the existing-definition doc; the append branch is
      // gated on a missing definition (none missing here), so the definition count holds.
      const tr = handler(view.state, match, 1, 1 + "[^x]".length);
      secondTr = tr;
      if (tr) view.dispatch(tr);

      defCount = 0;
      viewFromCtx(ctx).state.doc.descendants((node) => {
        if (node.type.name === "footnote_definition") defCount += 1;
        return true;
      });
    });
    expect(secondTr).not.toBeNull();
    expect(defCount).toBe(1);
  });
});

describe("footnotes: nextFootnoteLabel", () => {
  it("returns max numeric + 1", () => {
    expect(nextFootnoteLabel(["1", "3"])).toBe("4");
  });

  it("ignores non-numeric labels and starts at 1", () => {
    expect(nextFootnoteLabel(["note", "x"])).toBe("1");
  });

  it("starts at 1 for an empty document", () => {
    expect(nextFootnoteLabel([])).toBe("1");
  });

  it("mixes numeric and non-numeric labels, taking the numeric max", () => {
    expect(nextFootnoteLabel(["2", "note", "5", "x"])).toBe("6");
  });

  it("only counts plain decimal-integer labels toward the max", () => {
    // `Number()` alone would accept these, but stricter `/^\d+$/` matching does not:
    expect(nextFootnoteLabel(["1e3"])).toBe("1"); // exponential notation: ignored
    expect(nextFootnoteLabel(["0x10"])).toBe("1"); // hex literal: ignored
    expect(nextFootnoteLabel([" 2 "])).toBe("1"); // surrounding whitespace: ignored
    expect(nextFootnoteLabel(["3.0"])).toBe("1"); // decimal point: ignored
    // Plain decimal integers still count normally:
    expect(nextFootnoteLabel(["2"])).toBe("3");
    expect(nextFootnoteLabel(["10", "2"])).toBe("11");
  });
});

describe("footnotes: insertFootnoteAtSelection", () => {
  it("inserts a new sequential ref + definition and places the caret in the definition", async () => {
    // A doc with one numeric footnote already, so the next label is "2".
    const { crepe } = await mountCrepe(`Body.[^1]\n\n[^1]: existing\n`, (ctx) =>
      registerFootnoteDecorations(ctx),
    );
    let refLabels: string[] = [];
    let defLabels: string[] = [];
    let selInDef = false;
    crepe.editor.action((ctx) => {
      const view = viewFromCtx(ctx);
      insertFootnoteAtSelection(view);

      const { doc, selection } = viewFromCtx(ctx).state;
      refLabels = [];
      defLabels = [];
      doc.descendants((node) => {
        if (node.type.name === "footnote_reference") refLabels.push(String(node.attrs.label));
        if (node.type.name === "footnote_definition") defLabels.push(String(node.attrs.label));
        return true;
      });
      // The caret should sit inside a footnote_definition after insertion.
      for (let depth = selection.$from.depth; depth > 0; depth -= 1) {
        if (selection.$from.node(depth).type.name === "footnote_definition") selInDef = true;
      }
    });
    // The new "2" label joins the existing "1" for both refs and defs.
    expect(refLabels).toContain("2");
    expect(defLabels).toContain("2");
    expect(refLabels.length).toBe(2);
    expect(defLabels.length).toBe(2);
    expect(selInDef).toBe(true);
  });

  it("inserts at a non-empty selection without clobbering the selected text", async () => {
    // No existing footnotes: the next label is "1". Select the word "world" in
    // the body, then insert. The selected text must survive, and the new ref
    // must land immediately after it (not replace it).
    const { crepe } = await mountCrepe(`Hello world here.\n`, (ctx) =>
      registerFootnoteDecorations(ctx),
    );
    let refCount = -1;
    let defCount = -1;
    let textPreserved = false;
    let refRightAfterSelection = false;
    crepe.editor.action((ctx) => {
      const view = viewFromCtx(ctx);
      const { doc } = view.state;
      // Locate "world" in the document and select exactly that word.
      const text = doc.textContent;
      const wordStart = text.indexOf("world") + 1; // +1: text offset -> doc position
      const wordEnd = wordStart + "world".length;
      view.dispatch(
        view.state.tr.setSelection(TextSelection.create(view.state.doc, wordStart, wordEnd)),
      );

      insertFootnoteAtSelection(view);

      const after = viewFromCtx(ctx).state.doc;
      // (a) the selected word text still exists in the doc.
      textPreserved = after.textContent.includes("world");
      // (b) a new ref + a new def were added (one each, from an empty start).
      refCount = 0;
      defCount = 0;
      after.descendants((node) => {
        if (node.type.name === "footnote_reference") refCount += 1;
        if (node.type.name === "footnote_definition") defCount += 1;
        return true;
      });
      // (c) the new ref sits right after the selection end: the node at the
      // selection's end position is the footnote_reference.
      const nodeAtSelEnd = after.nodeAt(wordEnd);
      refRightAfterSelection = nodeAtSelEnd?.type.name === "footnote_reference";
    });
    expect(textPreserved).toBe(true);
    expect(refCount).toBe(1);
    expect(defCount).toBe(1);
    expect(refRightAfterSelection).toBe(true);
  });
});
