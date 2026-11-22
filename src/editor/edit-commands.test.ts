import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cmUndo = vi.fn();
const cmRedo = vi.fn();
const cmSelectAll = vi.fn();
const pmSelectAll = vi.fn();
const findFromDOM = vi.fn();
const writeText = vi.fn().mockResolvedValue(undefined);
const readText = vi.fn().mockResolvedValue("");
/** Held by name: reading it back off `document` trips the unbound-method rule. */
let execCommand = vi.fn().mockReturnValue(true);

vi.mock("@codemirror/commands", () => ({
  undo: (...args: unknown[]) => {
    cmUndo(...args);
    return true;
  },
  redo: (...args: unknown[]) => {
    cmRedo(...args);
    return true;
  },
  selectAll: (...args: unknown[]) => {
    cmSelectAll(...args);
    return true;
  },
}));
vi.mock("@codemirror/view", () => ({
  EditorView: {
    findFromDOM: (...args: unknown[]): unknown => findFromDOM(...args) as unknown,
  },
}));
vi.mock("@milkdown/kit/prose/commands", () => ({
  selectAll: (...args: unknown[]) => {
    pmSelectAll(...args);
    return true;
  },
}));
vi.mock("@milkdown/kit/plugin/history", () => ({
  undoCommand: { key: "Undo" },
  redoCommand: { key: "Redo" },
}));
vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  writeText: (...args: unknown[]): Promise<void> => writeText(...args) as Promise<void>,
  readText: (): Promise<string> => readText() as Promise<string>,
}));

import { setActiveEditor } from "./active-editor";
import {
  copy,
  cut,
  paste,
  redo,
  resetEditableFocus,
  selectAll,
  trackEditableFocus,
  undo,
} from "./edit-commands";

/** The Milkdown command bus, stubbed the way run-format-command.test.ts does. */
function stubMilkdownEditor(view: unknown) {
  const call = vi.fn();
  const action = vi.fn((cb: (ctx: unknown) => unknown) =>
    cb({ get: (token: unknown) => (token === undefined ? view : { call, ...(view as object) }) }),
  );
  setActiveEditor({ editor: { action } } as never);
  return { call, action };
}

let stopTracking: (() => void) | null = null;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  document.body.innerHTML = "";
  setActiveEditor(null);
  resetEditableFocus();
  stopTracking = trackEditableFocus();
  execCommand = vi.fn().mockReturnValue(true);
  document.execCommand = execCommand;
});

afterEach(() => {
  stopTracking?.();
  stopTracking = null;
  vi.useRealTimers();
});

/** Mount a CodeMirror-looking host and report it as focused. */
function focusCodeMirror() {
  const host = document.createElement("div");
  host.className = "cm-editor";
  const content = document.createElement("div");
  content.setAttribute("contenteditable", "true");
  content.tabIndex = 0;
  host.append(content);
  document.body.append(host);

  const view = {
    state: { selection: { main: { from: 0, to: 4 } }, sliceDoc: () => "text" },
    dispatch: vi.fn(),
    focus: vi.fn(),
    dom: host,
  };
  findFromDOM.mockReturnValue(view);
  content.focus();
  return view;
}

function focusField() {
  const input = document.createElement("input");
  input.value = "hello";
  document.body.append(input);
  input.focus();
  input.setSelectionRange(0, 5);
  return input;
}

describe("surface resolution", () => {
  it("routes to CodeMirror when the caret is in a code surface", () => {
    const view = focusCodeMirror();

    undo();
    vi.runAllTimers();

    expect(view.focus).toHaveBeenCalled();
    expect(cmUndo).toHaveBeenCalledWith(expect.objectContaining({ state: view.state }));
  });

  // The command target wraps `dispatch` so it keeps its view as `this`; the
  // wrapper still has to reach the real one.
  it("dispatches CodeMirror transactions through to the view", () => {
    const view = focusCodeMirror();

    undo();
    vi.runAllTimers();

    const target = cmUndo.mock.calls[0]?.[0] as { dispatch: (tr: unknown) => void };
    target.dispatch({ kind: "tr" });
    expect(view.dispatch).toHaveBeenCalledWith({ kind: "tr" });
  });

  // A code block is a CodeMirror instance nested inside the contenteditable
  // document, so a naive contenteditable check would send its undo to Milkdown
  // and silently undo the wrong thing.
  it("prefers CodeMirror over Milkdown for a code block inside the document", () => {
    const doc = document.createElement("div");
    doc.setAttribute("contenteditable", "true");
    const host = document.createElement("div");
    host.className = "cm-editor";
    const content = document.createElement("div");
    content.setAttribute("contenteditable", "true");
    content.tabIndex = 0;
    host.append(content);
    doc.append(host);
    document.body.append(doc);

    const view = { state: {}, dispatch: vi.fn(), focus: vi.fn(), dom: host };
    findFromDOM.mockReturnValue(view);
    const milkdown = stubMilkdownEditor({ state: {}, focus: vi.fn(), dom: doc });

    content.focus();
    undo();
    vi.runAllTimers();

    expect(cmUndo).toHaveBeenCalled();
    expect(milkdown.call).not.toHaveBeenCalled();
  });

  it("routes select-all to the field itself when the caret is in an input", () => {
    const input = focusField();
    const select = vi.spyOn(input, "select");

    selectAll();
    vi.runAllTimers();

    expect(select).toHaveBeenCalled();
    expect(cmSelectAll).not.toHaveBeenCalled();
    expect(pmSelectAll).not.toHaveBeenCalled();
  });

  it("does nothing when no editable surface was ever focused", () => {
    undo();
    vi.runAllTimers();

    expect(cmUndo).not.toHaveBeenCalled();
  });

  // The whole reason the tracker exists: choosing a menu item moves focus to the
  // menu, so the surface must be remembered from before it opened.
  it("still targets the editor after focus moves to a menu item", () => {
    const view = focusCodeMirror();

    const menuItem = document.createElement("button");
    menuItem.setAttribute("role", "menuitem");
    document.body.append(menuItem);
    menuItem.focus();

    redo();
    vi.runAllTimers();

    expect(cmRedo).toHaveBeenCalledWith(expect.objectContaining({ state: view.state }));
  });

  it("forgets the surface once tracking stops", () => {
    focusCodeMirror();
    stopTracking?.();
    stopTracking = null;
    document.body.innerHTML = "";

    undo();
    vi.runAllTimers();

    expect(cmUndo).not.toHaveBeenCalled();
  });

  it("skips a field that was removed while the menu was open", () => {
    const input = focusField();
    const select = vi.spyOn(input, "select");
    input.remove();

    selectAll();
    vi.runAllTimers();

    expect(select).not.toHaveBeenCalled();
  });
});

describe("clipboard", () => {
  // execCommand runs the editor's own copy handler, which serializes the slice
  // properly; writing plain text ourselves would lose formatting.
  it("copies through the engine's own handler and does not fall back when it works", async () => {
    focusCodeMirror();

    copy();
    await vi.runAllTimersAsync();

    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("falls back to writing the selection when the engine refuses", async () => {
    const view = focusCodeMirror();
    execCommand.mockReturnValue(false);

    copy();
    await vi.runAllTimersAsync();

    expect(writeText).toHaveBeenCalledWith("text");
    expect(view.dispatch).not.toHaveBeenCalled();
  });

  it("deletes the selection on a fallback cut, but only once the write succeeded", async () => {
    const view = focusCodeMirror();
    view.state = {
      ...view.state,
      replaceSelection: vi.fn().mockReturnValue({ kind: "tr" }),
    } as never;
    execCommand.mockReturnValue(false);

    cut();
    await vi.runAllTimersAsync();

    expect(writeText).toHaveBeenCalledWith("text");
    expect(view.dispatch).toHaveBeenCalledWith({ kind: "tr" });
  });

  it("leaves the document untouched when a fallback cut cannot reach the clipboard", async () => {
    const view = focusCodeMirror();
    execCommand.mockReturnValue(false);
    writeText.mockRejectedValueOnce(new Error("no capability"));

    cut();
    await vi.runAllTimersAsync();

    expect(view.dispatch).not.toHaveBeenCalled();
  });

  it("inserts pasted text verbatim when nothing handles the paste event", async () => {
    const view = focusCodeMirror();
    view.state = {
      ...view.state,
      replaceSelection: vi.fn().mockReturnValue({ kind: "tr" }),
    } as never;
    readText.mockResolvedValueOnce("# pasted");

    paste();
    await vi.runAllTimersAsync();

    expect(view.dispatch).toHaveBeenCalledWith({ kind: "tr" });
  });

  it("leaves the document untouched when the clipboard is empty", async () => {
    const view = focusCodeMirror();
    readText.mockResolvedValueOnce("");

    paste();
    await vi.runAllTimersAsync();

    expect(view.dispatch).not.toHaveBeenCalled();
  });

  it("leaves the document untouched when the clipboard cannot be read", async () => {
    const view = focusCodeMirror();
    readText.mockRejectedValueOnce(new Error("denied"));

    paste();
    await vi.runAllTimersAsync();

    expect(view.dispatch).not.toHaveBeenCalled();
  });
});
