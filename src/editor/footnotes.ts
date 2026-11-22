import { prosePluginsCtx } from "@milkdown/kit/core";
import type { Ctx } from "@milkdown/kit/ctx";
import { InputRule } from "@milkdown/kit/prose/inputrules";
import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey, TextSelection, type EditorState } from "@milkdown/kit/prose/state";
import type { Transaction } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet, type EditorView } from "@milkdown/kit/prose/view";
import { $inputRule, $prose } from "@milkdown/kit/utils";

import i18n from "@/i18n";

import { isRawTextContext } from "./editor-view";
import { withEditView } from "./run-format-command";

/**
 * Map each footnote label to a 1-based ordinal by order of first reference.
 * `refLabels` is the document-order list of `footnote_reference` labels.
 * Empty labels are skipped. GFM allows arbitrary labels (`[^note]`); we always
 * display sequential numbers regardless, while the markdown keeps the labels.
 */
export function assignFootnoteNumbers(refLabels: readonly string[]): Map<string, number> {
  const map = new Map<string, number>();
  let next = 1;
  for (const label of refLabels) {
    if (!label) continue;
    if (!map.has(label)) map.set(label, next++);
  }
  return map;
}

const REF = "footnote_reference";
const DEF = "footnote_definition";

export const footnoteDecoKey = new PluginKey("asterisco-footnote-deco");

interface FootnoteNode {
  pos: number;
  size: number;
  label: string;
}

interface FootnoteScan {
  /** `footnote_reference` nodes in document order. */
  refs: FootnoteNode[];
  /** `footnote_definition` nodes in document order. */
  defs: FootnoteNode[];
}

/** Collect every footnote reference and definition, in document order. */
function scanFootnotes(doc: ProseNode): FootnoteScan {
  const refs: FootnoteNode[] = [];
  const defs: FootnoteNode[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === REF) {
      refs.push({ pos, size: node.nodeSize, label: String(node.attrs.label ?? "") });
    } else if (node.type.name === DEF) {
      defs.push({ pos, size: node.nodeSize, label: String(node.attrs.label ?? "") });
    }
    return true;
  });
  return { refs, defs };
}

/**
 * Build node decorations that expose each footnote's display string as a
 * `--fn-num` CSS custom property (a quoted string, so `content: var(--fn-num)`
 * renders it as text) plus an `fn-ref` / `fn-def` class. References are numbered
 * by order of first appearance; referenced definitions show that number, while
 * unreferenced (orphan) definitions set no `--fn-num` and fall back to the gfm
 * node's `data-label` via the CSS `content: var(--fn-num, attr(data-label))`.
 */
function buildDecorations(doc: ProseNode): DecorationSet {
  const { refs, defs } = scanFootnotes(doc);
  const numbers = assignFootnoteNumbers(refs.map((r) => r.label));
  const decos: Decoration[] = [];
  for (const ref of refs) {
    const display = numbers.get(ref.label) ?? ref.label;
    decos.push(
      Decoration.node(ref.pos, ref.pos + ref.size, {
        class: "fn-ref",
        style: `--fn-num:'${display}'`,
      }),
    );
  }
  for (const def of defs) {
    const n = numbers.get(def.label) ?? null;
    // Referenced defs carry their number via `--fn-num`. Orphan (unreferenced)
    // defs set NO `--fn-num`, so the CSS `content: var(--fn-num, attr(data-label))`
    // falls back to the gfm node's `data-label` — showing the raw label with zero
    // injection risk (no author label is ever interpolated into the style attr).
    const attrs: { class: string; style?: string } =
      n === null ? { class: "fn-def" } : { class: "fn-def", style: `--fn-num:'${n}'` };
    decos.push(Decoration.node(def.pos, def.pos + def.size, attrs));
    // Accessible backlink: a real focusable <button> at the definition's
    // content start (pos + 1) returning to the first reference (Task 4). A
    // widget — not a CSS pseudo-element — so it is keyboard-focusable and
    // carries an i18n aria-label.
    decos.push(
      Decoration.widget(def.pos + 1, () => buildBacklinkButton(def.label, n), {
        side: -1,
        ignoreSelection: true,
        // Assumes unique definition labels; duplicate-label handling is out of
        // scope per the plan, so two defs with the same label would collide here.
        key: `fn-back-${def.label}`,
      }),
    );
  }
  return DecorationSet.create(doc, decos);
}

/**
 * Build the accessible backlink button shown at the start of a definition.
 * `n` is the reference ordinal (or null for an unreferenced definition, in
 * which case the raw label is used in the aria-label).
 */
export function buildBacklinkButton(label: string, n: number | null): HTMLElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "fn-backlink";
  btn.contentEditable = "false";
  btn.textContent = "↩";
  btn.setAttribute(
    "aria-label",
    i18n.t("footnotes.backToReference", { ns: "editor", number: n ?? label }),
  );
  btn.dataset.fnLabel = label;
  return btn;
}

function buildFootnoteDecoPlugin(): Plugin {
  return new Plugin({
    key: footnoteDecoKey,
    state: {
      init: (_cfg, state) => buildDecorations(state.doc),
      apply: (tr, old) => (tr.docChanged ? buildDecorations(tr.doc) : old),
    },
    props: {
      decorations(state) {
        return footnoteDecoKey.getState(state) as DecorationSet | undefined;
      },
    },
  });
}

/** Register the footnote numbering/decoration plugin (call before create). */
export function registerFootnoteDecorations(ctx: Ctx): void {
  ctx.update(prosePluginsCtx, (plugins) => plugins.concat(buildFootnoteDecoPlugin()));
}

/** Document position of the `footnote_definition` with `label`, else -1. */
export function findDefinitionPos(doc: ProseNode, label: string): number {
  let found = -1;
  doc.descendants((node, pos) => {
    if (found !== -1) return false;
    if (node.type.name === DEF && String(node.attrs.label ?? "") === label) found = pos;
    return found === -1;
  });
  return found;
}

/** Document position of the FIRST `footnote_reference` with `label`, else -1. */
export function findReferencePos(doc: ProseNode, label: string): number {
  let found = -1;
  doc.descendants((node, pos) => {
    if (found !== -1) return false;
    if (node.type.name === REF && String(node.attrs.label ?? "") === label) found = pos;
    return found === -1;
  });
  return found;
}

/**
 * Replace the document range [start, end] with a `footnote_reference` for
 * `label` and, when no matching `footnote_definition` exists yet, append an
 * empty one (an empty paragraph) at the END of the document — so a fresh
 * footnote always has a body to fill in, mirroring Typora's "type Markdown, see
 * it render" promise. Returns null (the whole edit aborts) when the schema is
 * missing a node type or the seed paragraph cannot be built. Shared by the
 * input rule and the auto-pairing completion handler.
 */
function applyFootnote(
  state: EditorState,
  label: string,
  start: number,
  end: number,
): Transaction | null {
  const refType = state.schema.nodes[REF];
  const defType = state.schema.nodes[DEF];
  if (!refType || !defType) return null;
  let tr = state.tr.replaceWith(start, end, refType.create({ label }));
  if (findDefinitionPos(state.doc, label) < 0) {
    // The definition is a top-level block holding `block+`; seed it with an
    // empty paragraph and insert it at the document's end content boundary.
    // Guard: a `footnote_definition` requires `block+`, so never create one
    // without a paragraph — bail out entirely if the paragraph cannot be built.
    const para = state.schema.nodes.paragraph?.createAndFill();
    if (!para) return null;
    tr = tr.insert(tr.doc.content.size, defType.create({ label }, para));
  }
  return tr;
}

/**
 * Typing the closing `]` of `[^label]` turns it into a `footnote_reference`.
 * ProseMirror's input-rule runner already skips firing inside `code_block`s
 * (it checks the parent node's `spec.code`), so `[^x]` typed in a fenced/code
 * block stays literal. Inline code is a mark, not a node, so it is NOT guarded
 * here — same as the existing `linkInputRule`; that edge case is best-effort.
 * Handles only the case where the user actually types the closing `]`; when
 * auto-pairing has already inserted it, `footnoteCompletionPlugin` takes over.
 */
export const footnoteInputRule = $inputRule(
  () =>
    new InputRule(/\[\^([^\]\s]+)\]$/, (state, match, start, end) =>
      match[1] ? applyFootnote(state, match[1], start, end) : null,
    ),
);

/** Matches a footnote opener + label immediately before the caret (no closer). */
const FOOTNOTE_BEFORE_CARET = /\[\^([^\]\s]+)$/;

/**
 * Drop the auto-paired closing `]` when the user types `^` right after an
 * auto-inserted `[` (caret sitting in an empty `[|]` pair). Auto-pairing turns
 * `[` into `[]`, which makes a footnote LOOK complete (`[^1]`) while the closing
 * `]` was never typed — so `footnoteInputRule` never fires and the marker stays
 * literal. Stripping the closer here reopens the marker (`[^`), so the user
 * types the real `]` themselves and the input rule converts it, exactly like the
 * no-auto-pairing flow. `[^` is unambiguous footnote syntax, so this never fights
 * an ordinary `[]` link. Runs BEFORE `autoPairingPlugin` (which ignores `^`).
 */
function stripFootnoteCloser(view: EditorView, from: number): boolean {
  const { state } = view;
  const $from = state.doc.resolve(from);
  if ($from.parentOffset === 0 || $from.parentOffset === $from.parent.content.size) return false;
  const before = $from.parent.textBetween($from.parentOffset - 1, $from.parentOffset);
  const after = $from.parent.textBetween($from.parentOffset, $from.parentOffset + 1);
  if (before !== "[" || after !== "]") return false;
  // Replace the auto-paired `]` (range [from, from+1]) with the typed `^`,
  // leaving an open `[^` with the caret after it. Replacing a range whose start
  // is the caret leaves the selection at `from`, so move it explicitly past `^`.
  const tr = state.tr.insertText("^", from, from + 1);
  tr.setSelection(TextSelection.create(tr.doc, from + 1));
  view.dispatch(tr.scrollIntoView());
  return true;
}

/**
 * Complete a footnote when the closing `]` is typed but already present in the
 * document. Defensive backstop for any path where a `]` still follows the caret
 * (e.g. an auto-paired closer that survived): when `]` is typed, a `]` already
 * sits after the caret, and the text before reads `[^label`, convert the whole
 * `[^label]` into a footnote reference (+ empty definition). When no closer is
 * present it stands aside so the standard input rule does the job.
 */
function completeFootnote(view: EditorView, from: number): boolean {
  const { state } = view;
  const $from = state.doc.resolve(from);
  if ($from.parentOffset === $from.parent.content.size) return false;
  if ($from.parent.textBetween($from.parentOffset, $from.parentOffset + 1) !== "]") return false;
  const before = $from.parent.textBetween(0, $from.parentOffset);
  const match = FOOTNOTE_BEFORE_CARET.exec(before);
  if (!match?.[1]) return false;
  const start = from - match[0].length; // position of the opening `[`
  const end = from + 1; // include the already-present `]`
  const tr = applyFootnote(state, match[1], start, end);
  if (!tr) return false;
  // Place the caret immediately after the new reference node.
  tr.setSelection(TextSelection.near(tr.doc.resolve(start + 1)));
  view.dispatch(tr.scrollIntoView());
  return true;
}

/** Dispatch footnote-aware handling of single-character input (`^` / `]`). */
function handleFootnoteInput(view: EditorView, from: number, to: number, text: string): boolean {
  if (from !== to || view.composing || isRawTextContext(view.state)) return false;
  if (text === "^") return stripFootnoteCloser(view, from);
  if (text === "]") return completeFootnote(view, from);
  return false;
}

/**
 * Footnote completion handler that reconciles footnotes with auto-pairing.
 * Registered as a `$prose` plugin so it lives at the ProseMirror level (WYSIWYG
 * only) and MUST be ordered BEFORE `autoPairingPlugin` so it intercepts `^` and
 * `]` ahead of auto-pairing's pairing / type-over.
 */
export const footnoteCompletionPlugin = $prose(
  () => new Plugin({ props: { handleTextInput: handleFootnoteInput } }),
);

/**
 * Scroll the editor to a position and place the caret near it. `intoContent`
 * resolves one position inside the node (a definition's content) rather than
 * just before it (used when jumping ref → definition).
 */
function jumpTo(view: EditorView, pos: number, intoContent: boolean): void {
  const sel = TextSelection.near(view.state.doc.resolve(intoContent ? pos + 1 : pos));
  view.dispatch(view.state.tr.setSelection(sel).scrollIntoView());
  view.focus();
}

const footnoteInteractionKey = new PluginKey("asterisco-footnote-interaction");

/**
 * Resolve the 1-based display number for `label` from the document's reference
 * order (matching the numbering decorations), or null if the label is not
 * referenced anywhere.
 */
function footnoteNumberFor(doc: ProseNode, label: string): number | null {
  const refLabels: string[] = [];
  doc.descendants((node) => {
    if (node.type.name === REF) refLabels.push(String(node.attrs.label ?? ""));
    return true;
  });
  return assignFootnoteNumbers(refLabels).get(label) ?? null;
}

/**
 * Jump from an activated backlink button back to its reference. Invoked ONLY
 * from the `click` DOM handler so activation fires exactly once per interaction:
 * `click` follows mouseup for pointer use AND fires on Enter/Space when the
 * <button> is focused, so this single path covers both mouse and keyboard. The
 * separate `mousedown` handler only suppresses ProseMirror's pointer selection;
 * it must NOT jump, or a real click would dispatch twice (mousedown + click).
 */
function handleBacklinkActivation(view: EditorView, event: Event): boolean {
  const el = (event.target as HTMLElement | null)?.closest<HTMLElement>("button.fn-backlink");
  if (!el) return false;
  const label = el.dataset.fnLabel ?? "";
  const target = findReferencePos(view.state.doc, label);
  if (target >= 0) {
    jumpTo(view, target, false);
    event.preventDefault();
    return true;
  }
  return false;
}

function buildFootnoteInteractionPlugin(): Plugin {
  // Instance-scoped, read-only hover-preview popover — one per plugin instance
  // (one per editor). Held in this closure, NOT a module global, so two
  // concurrent editors (a StrictMode remount) never contend over a
  // shared element: each owns its own and tears down only its own in destroy().
  // Appended to `document.body` (not the editor DOM) so it survives ProseMirror
  // redraws.
  let popoverEl: HTMLElement | null = null;

  function ensurePopover(): HTMLElement {
    if (popoverEl) return popoverEl;
    const el = document.createElement("div");
    el.className = "fn-popover";
    el.setAttribute("role", "tooltip");
    el.hidden = true;
    document.body.appendChild(el);
    popoverEl = el;
    return el;
  }

  /**
   * Position and reveal the preview popover below `refEl`, showing `text`.
   * `ariaLabel` describes it for assistive tech (e.g. "Footnote 2 preview").
   * Read-only: CSS sets `pointer-events: none` so it never traps the cursor.
   */
  function showPopover(refEl: HTMLElement, text: string, ariaLabel: string): void {
    const el = ensurePopover();
    el.textContent = text;
    el.setAttribute("aria-label", ariaLabel);
    el.hidden = false;
    const r = refEl.getBoundingClientRect();
    el.style.top = `${window.scrollY + r.bottom + 6}px`;
    el.style.left = `${window.scrollX + r.left}px`;
  }

  function hidePopover(): void {
    if (popoverEl) popoverEl.hidden = true;
  }

  return new Plugin({
    key: footnoteInteractionKey,
    props: {
      handleClickOn(view, _pos, node, _nodePos, event) {
        if (node.type.name === REF) {
          const label = String(node.attrs.label ?? "");
          const target = findDefinitionPos(view.state.doc, label);
          if (target >= 0) {
            jumpTo(view, target, true);
            event.preventDefault();
            return true;
          }
        }
        return false;
      },
      handleDOMEvents: {
        // Pointer-down: only stop ProseMirror from moving the selection onto
        // the button. Do NOT jump here — `preventDefault()` on mousedown does
        // not cancel the native `click`, so jumping here too would dispatch the
        // activation twice for a single pointer click. The jump lives in `click`.
        mousedown: (_view, event) => {
          const el = (event.target as HTMLElement | null)?.closest("button.fn-backlink");
          if (!el) return false;
          event.preventDefault();
          return true;
        },
        // Single activation path: `click` fires after mouseup for pointer use
        // and on Enter/Space when the button is focused, so this covers both
        // mouse and keyboard with exactly one jump per interaction.
        click: (view, event) => handleBacklinkActivation(view, event),
        // Read-only hover preview: show a floating popover with the referenced
        // definition's text. Returns false so it never consumes the event.
        mouseover(view, event) {
          const sup = (event.target as HTMLElement | null)?.closest<HTMLElement>(
            'sup[data-type="footnote_reference"]',
          );
          if (!sup) return false;
          const label = sup.dataset.label ?? "";
          const pos = findDefinitionPos(view.state.doc, label);
          if (pos < 0) return false;
          const node = view.state.doc.nodeAt(pos);
          if (node) {
            const n = footnoteNumberFor(view.state.doc, label);
            const ariaLabel = i18n.t("footnotes.preview", {
              ns: "editor",
              number: n ?? label,
            });
            showPopover(sup, node.textContent, ariaLabel);
          }
          return false;
        },
        // Dismiss on mouse-out, but stay open while the pointer is over the
        // popover itself (it is pointer-events:none, so this is belt-and-braces).
        mouseout(_view, event) {
          const to = event.relatedTarget as HTMLElement | null;
          if (to?.closest(".fn-popover")) return false;
          hidePopover();
          return false;
        },
      },
    },
    // Dismiss the preview on editor scroll so it never floats out of place, and
    // tear down this instance's popover on editor teardown (prevents leaks
    // across remounts: the node is removed and `popoverEl` is reset to null).
    view(editorView: EditorView) {
      const scroller: EventTarget = editorView.dom.closest("[data-editor-scroll]") ?? window;
      scroller.addEventListener("scroll", hidePopover, true);
      return {
        destroy() {
          scroller.removeEventListener("scroll", hidePopover, true);
          if (popoverEl) {
            popoverEl.remove();
            popoverEl = null;
          }
        },
      };
    },
  });
}

/** Register the footnote click-to-jump + backlink interaction plugin. */
export function registerFootnoteInteraction(ctx: Ctx): void {
  ctx.update(prosePluginsCtx, (plugins) => plugins.concat(buildFootnoteInteractionPlugin()));
}

/** Next label = max numeric existing + 1 (ignores non-numeric labels), min "1". */
export function nextFootnoteLabel(existing: readonly string[]): string {
  let max = 0;
  for (const l of existing) {
    // Only plain decimal-integer labels count toward the max: `Number()` alone
    // would also accept `"1e3"`, `"0x10"`, `" 2 "`, `"3.0"`, etc. — none of which
    // are labels we want to auto-increment from. Gate on a strict digit pattern.
    if (!/^\d+$/.test(l)) continue;
    const n = Number(l);
    if (Number.isInteger(n) && n > max) max = n;
  }
  return String(max + 1);
}

/** Insert a new footnote ref at the caret + an empty definition; focus the def. */
export function insertFootnoteAtSelection(view: EditorView): void {
  const { state } = view;
  // Self-safe against code contexts: never insert a marker inside a code block
  // even if a future caller skips the `.cm-editor` guard in `runInsertFootnote`.
  if (state.selection.$from.parent.type.spec.code) return;
  const refType = state.schema.nodes[REF];
  const defType = state.schema.nodes[DEF];
  if (!refType || !defType) return;
  const labels: string[] = [];
  state.doc.descendants((n) => {
    if (n.type.name === REF || n.type.name === DEF) labels.push(String(n.attrs.label ?? ""));
    return true;
  });
  const label = nextFootnoteLabel(labels);
  const para = state.schema.nodes.paragraph?.createAndFill();
  if (!para) return; // guard: paragraph must fill (block+)
  const def = defType.create({ label }, para);
  // Insert the marker AT the end of the current selection — like Typora, a
  // footnote attaches at the caret after the relevant word. Unlike
  // `replaceSelectionWith`, `insert` does NOT delete selected text: a collapsed
  // caret inserts at the caret; a non-empty selection keeps its text and places
  // the marker immediately after it.
  const insertPos = state.selection.to;
  let tr = state.tr.insert(insertPos, refType.create({ label }));
  // Append the empty definition at the document's end content boundary.
  // Inserting while the caret is inside a `footnote_definition` is allowed but
  // unhandled (it nests a ref in a definition and appends another definition);
  // duplicate/nesting handling is out of scope per the plan — mirrors the
  // duplicate-label widget-key caveat above.
  const defPos = tr.doc.content.size;
  tr = tr.insert(defPos, def);
  tr = tr.setSelection(TextSelection.near(tr.doc.resolve(defPos + 1))).scrollIntoView();
  view.dispatch(tr);
  view.focus();
}

/** Command-palette / menu entry point: guard like runFormatCommand, then insert. */
export function runInsertFootnote(): void {
  withEditView((view) => insertFootnoteAtSelection(view));
}
