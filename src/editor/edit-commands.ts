import { redo as cmRedo, selectAll as cmSelectAll, undo as cmUndo } from "@codemirror/commands";
import type { Transaction } from "@codemirror/state";
import { EditorView as CodeMirrorView } from "@codemirror/view";
import type { CmdKey } from "@milkdown/kit/core";
import { commandsCtx } from "@milkdown/kit/core";
import { redoCommand, undoCommand } from "@milkdown/kit/plugin/history";
import { selectAll as pmSelectAll } from "@milkdown/kit/prose/commands";
import type { EditorView as ProseMirrorView } from "@milkdown/kit/prose/view";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";

import { getActiveEditor } from "./active-editor";
import { viewFromCtx } from "./editor-view";

/**
 * The standard edit commands (undo, redo, cut, copy, paste, select all) routed
 * to whichever editable surface the user was last in.
 *
 * These exist for the Windows/Linux DOM menubar. On macOS the same items are
 * native predefined roles that the OS handles itself and that never reach JS —
 * which is also why they cannot simply be dropped: with the native menu gated to
 * macOS, nothing else on Windows/Linux would carry them.
 *
 * Three surfaces can hold the caret, and each has its own command layer:
 * CodeMirror (source mode and code blocks), Milkdown/ProseMirror (the WYSIWYG
 * document), and plain `<input>`/`<textarea>` fields (the find bar, inline
 * rename). Dispatching to the wrong one silently does nothing, so the surface is
 * resolved from the focus that was live *before* the menu opened.
 */

type TextField = HTMLInputElement | HTMLTextAreaElement;

type Surface =
  | { kind: "codemirror"; view: CodeMirrorView }
  | { kind: "milkdown"; view: ProseMirrorView }
  | { kind: "field"; el: TextField };

function isTextField(el: unknown): el is TextField {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}

/** Whether `el` is a surface a caret can live in (see the three kinds above). */
function isEditable(el: EventTarget | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (isTextField(el)) return true;
  return Boolean(el.closest(".cm-editor") ?? el.closest('[contenteditable="true"]'));
}

/**
 * The last editable element that held focus. Opening a menu moves focus to the
 * menu itself, so by the time an item is chosen `document.activeElement` is a
 * menu item and the real target is gone — this remembers it.
 */
let lastEditable: HTMLElement | null = null;

/**
 * Start remembering which editable surface has focus. Returns a cleanup, so it
 * can be driven straight from a `useEffect`. Menu items are buttons, not
 * editable, so opening a menu never overwrites what we captured.
 */
export function trackEditableFocus(): () => void {
  const onFocusIn = (event: FocusEvent) => {
    if (isEditable(event.target)) lastEditable = event.target;
  };
  document.addEventListener("focusin", onFocusIn);
  return () => {
    document.removeEventListener("focusin", onFocusIn);
    lastEditable = null;
  };
}

/** Test seam: forget the captured surface. */
export function resetEditableFocus(): void {
  lastEditable = null;
}

function milkdownView(): ProseMirrorView | null {
  try {
    const view = getActiveEditor()?.editor.action((ctx) => viewFromCtx(ctx));
    // `editorViewCtx` is an empty placeholder until the view mounts; guard like
    // run-format-command so we never dispatch into a half-built view.
    return view?.state ? view : null;
  } catch {
    return null;
  }
}

/** Which surface an edit command should act on, or null if none can be found. */
function resolveSurface(): Surface | null {
  const active = document.activeElement;
  const el = isEditable(active) ? active : lastEditable;
  if (!el?.isConnected) return null;

  // CodeMirror first: a code block is a CodeMirror instance nested *inside* the
  // contenteditable document, so the contenteditable test would swallow it.
  const cmHost = el.closest<HTMLElement>(".cm-editor");
  if (cmHost) {
    const view = CodeMirrorView.findFromDOM(cmHost);
    return view ? { kind: "codemirror", view } : null;
  }
  if (isTextField(el)) return { kind: "field", el };
  if (el.closest('[contenteditable="true"]')) {
    const view = milkdownView();
    return view ? { kind: "milkdown", view } : null;
  }
  return null;
}

/**
 * A CodeMirror `StateCommand` target. `dispatch` is wrapped rather than passed
 * by reference so it keeps its view as `this`.
 */
function cmTarget(view: CodeMirrorView) {
  return { state: view.state, dispatch: (tr: Transaction) => view.dispatch(tr) };
}

function focusSurface(surface: Surface): void {
  if (surface.kind === "field") surface.el.focus();
  else surface.view.focus();
}

/**
 * Resolve the surface now, act on it once the menu has finished closing.
 *
 * Radix's FocusScope restores focus to the menu trigger when the menu unmounts,
 * which happens right after `onSelect` returns. Running synchronously would mean
 * focusing the editor and losing it a tick later — and clipboard commands read
 * the live selection, so they need the editor genuinely focused, not merely
 * about to be.
 */
function onSurface(run: (surface: Surface) => void): void {
  const surface = resolveSurface();
  if (!surface) return;
  window.setTimeout(() => {
    if (surface.kind === "field" && !surface.el.isConnected) return;
    focusSurface(surface);
    run(surface);
  }, 0);
}

function callMilkdown<T>(command: CmdKey<T>, payload?: T): void {
  getActiveEditor()?.editor.action((ctx) => {
    ctx.get(commandsCtx).call(command, payload);
  });
}

/** The selected text, as plain text. Used only for clipboard fallbacks. */
function selectionText(surface: Surface): string {
  switch (surface.kind) {
    case "codemirror": {
      const { state } = surface.view;
      const { from, to } = state.selection.main;
      return state.sliceDoc(from, to);
    }
    case "milkdown": {
      const { from, to } = surface.view.state.selection;
      return surface.view.state.doc.textBetween(from, to, "\n");
    }
    case "field":
      return surface.el.value.slice(surface.el.selectionStart ?? 0, surface.el.selectionEnd ?? 0);
  }
}

function deleteSelection(surface: Surface): void {
  switch (surface.kind) {
    case "codemirror":
      surface.view.dispatch(surface.view.state.replaceSelection(""));
      break;
    case "milkdown":
      surface.view.dispatch(surface.view.state.tr.deleteSelection());
      break;
    case "field":
      replaceFieldSelection(surface.el, "");
      break;
  }
}

/**
 * Replace a field's selection and let React see it. React tracks the last value
 * it wrote per node and skips the change event when the DOM value looks
 * unchanged to it, so the tracker has to be cleared for controlled inputs (the
 * find bar, inline rename) to re-render.
 */
function replaceFieldSelection(el: TextField, text: string): void {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  el.setRangeText(text, start, end, "end");
  const tracked = el as TextField & { _valueTracker?: { setValue(value: string): void } };
  tracked._valueTracker?.setValue("");
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

export function undo(): void {
  onSurface((surface) => {
    switch (surface.kind) {
      case "codemirror":
        cmUndo(cmTarget(surface.view));
        break;
      case "milkdown":
        callMilkdown(undoCommand.key);
        break;
      case "field":
        // A plain field's undo stack belongs to the engine, and execCommand is
        // the only door to it. Deprecated, unreplaced, and a no-op if refused.
        document.execCommand("undo");
        break;
    }
  });
}

export function redo(): void {
  onSurface((surface) => {
    switch (surface.kind) {
      case "codemirror":
        cmRedo(cmTarget(surface.view));
        break;
      case "milkdown":
        callMilkdown(redoCommand.key);
        break;
      case "field":
        document.execCommand("redo");
        break;
    }
  });
}

export function selectAll(): void {
  onSurface((surface) => {
    switch (surface.kind) {
      case "codemirror":
        cmSelectAll(cmTarget(surface.view));
        break;
      case "milkdown":
        pmSelectAll(surface.view.state, surface.view.dispatch);
        break;
      case "field":
        surface.el.select();
        break;
    }
  });
}

/**
 * Copy/cut go through `execCommand` on purpose. Both editors install their own
 * `copy`/`cut` handlers — ProseMirror serializes the slice so a pasted heading
 * stays a heading, CodeMirror handles whole-line selections — and `execCommand`
 * is what fires them. Reading the selection ourselves and writing plain text
 * would make the menu quietly worse than Ctrl+C; that path is the fallback for
 * when the engine refuses the command.
 */
export function copy(): void {
  onSurface((surface) => {
    if (document.execCommand("copy")) return;
    void writeSelection(surface);
  });
}

export function cut(): void {
  onSurface((surface) => {
    if (document.execCommand("cut")) return;
    void writeSelection(surface).then((written) => {
      if (written) deleteSelection(surface);
    });
  });
}

async function writeSelection(surface: Surface): Promise<boolean> {
  const text = selectionText(surface);
  if (!text) return false;
  try {
    await writeText(text);
    return true;
  } catch {
    // Clipboard unavailable (no capability, or outside Tauri): nothing copied,
    // and for cut that also means nothing is deleted.
    return false;
  }
}

export function paste(): void {
  onSurface((surface) => {
    void readText()
      .then((text) => {
        if (text) insertPasted(surface, text);
      })
      .catch(() => {
        // Clipboard unreadable — leave the document untouched rather than guess.
      });
  });
}

/**
 * Feed pasted text through the surface's own paste pipeline by dispatching a
 * real `paste` event, so menu-paste behaves exactly like Ctrl+V: Milkdown parses
 * the text as Markdown, CodeMirror keeps indentation. Only if nothing handles
 * the event do we insert the text verbatim.
 */
function insertPasted(surface: Surface, text: string): void {
  if (surface.kind !== "field" && dispatchPaste(surface.view.dom, text)) return;
  switch (surface.kind) {
    case "codemirror":
      surface.view.dispatch(surface.view.state.replaceSelection(text));
      break;
    case "milkdown":
      surface.view.dispatch(surface.view.state.tr.insertText(text));
      break;
    case "field":
      replaceFieldSelection(surface.el, text);
      break;
  }
}

/** Returns whether the surface claimed the event (i.e. called preventDefault). */
function dispatchPaste(target: HTMLElement, text: string): boolean {
  if (typeof ClipboardEvent === "undefined" || typeof DataTransfer === "undefined") return false;
  try {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/plain", text);
    const event = new ClipboardEvent("paste", {
      clipboardData,
      bubbles: true,
      cancelable: true,
    });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  } catch {
    // jsdom and older engines reject the ClipboardEvent constructor.
    return false;
  }
}
