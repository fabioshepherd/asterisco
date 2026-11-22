import { fireEvent, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { FIXED_SHORTCUTS } from "@/features/settings/fixed-shortcuts";
import { useKeybindings } from "@/features/settings/keybindings";
import { useDocuments } from "@/stores/document";

import { useTabShortcuts } from "./use-tab-shortcuts";

/** Three open documents, `c` active — the state every case below starts from. */
function seedThreeTabs(): { a: string; b: string; c: string } {
  useDocuments.setState({ documents: [], activeId: null, tabs: [] });
  const a = useDocuments.getState().createDocument({ path: "/w/a.md" });
  const b = useDocuments.getState().createDocument({ path: "/w/b.md" });
  const c = useDocuments.getState().createDocument({ path: "/w/c.md" });
  return { a, b, c };
}

const activeId = () => useDocuments.getState().activeId;

/** One `Ctrl+Tab` press with the modifier still down. */
function pressCtrlTab(options: { shift?: boolean } = {}) {
  fireEvent.keyDown(window, { key: "Tab", ctrlKey: true, shiftKey: options.shift ?? false });
}

/** Let go of Ctrl — what commits a walk. */
function releaseCtrl() {
  fireEvent.keyUp(window, { key: "Control", ctrlKey: false });
}

describe("useTabShortcuts — no select-by-position", () => {
  beforeEach(() => {
    useKeybindings.getState().resetAll();
  });

  // mod+1…6 belong to Heading 1–6 (CODE-03, option A): one press used to set a
  // heading and switch tab at once. Tabs stay reachable by Ctrl+Tab, the
  // palette's open documents and the tab strip.
  it.each(["1", "2", "7", "9"])("leaves mod+%s alone", (key) => {
    const { c } = seedThreeTabs();
    renderHook(() => useTabShortcuts());

    const event = new KeyboardEvent("keydown", { key, ctrlKey: true, cancelable: true });
    window.dispatchEvent(event);

    expect(activeId()).toBe(c);
    expect(event.defaultPrevented).toBe(false);
  });
});

describe("useTabShortcuts — Ctrl+Tab walks the MRU order", () => {
  beforeEach(() => {
    useKeybindings.getState().resetAll();
  });

  it("goes to the previously visited document, not the next tab along", () => {
    const { a, c } = seedThreeTabs();
    renderHook(() => useTabShortcuts());
    // Visit c (already active), then a. One step back from a is c — even though
    // b is what sits next to a in the strip.
    useDocuments.getState().setActiveDocument(a);

    pressCtrlTab();
    expect(activeId()).toBe(c);
  });

  it("walks further back while the modifier is held", () => {
    const { a, b, c } = seedThreeTabs();
    renderHook(() => useTabShortcuts());
    useDocuments.getState().setActiveDocument(b);
    useDocuments.getState().setActiveDocument(a);
    // MRU is now a, b, c.
    pressCtrlTab();
    expect(activeId()).toBe(b);
    pressCtrlTab();
    expect(activeId()).toBe(c);
  });

  it("commits on release, so the next walk starts from where it landed", () => {
    const { a, b, c } = seedThreeTabs();
    renderHook(() => useTabShortcuts());
    useDocuments.getState().setActiveDocument(b);
    useDocuments.getState().setActiveDocument(a);

    pressCtrlTab();
    pressCtrlTab();
    expect(activeId()).toBe(c);
    releaseCtrl();

    // Back where the walk began: c's most recent predecessor is a.
    pressCtrlTab();
    expect(activeId()).toBe(a);
  });

  it("does not record the steps it passes through as visits", () => {
    const { a, b } = seedThreeTabs();
    renderHook(() => useTabShortcuts());
    useDocuments.getState().setActiveDocument(b);
    useDocuments.getState().setActiveDocument(a);

    // Passing over b on the way to c must not make b the second-most-recent;
    // if it did, this last walk would land on b instead of a.
    pressCtrlTab();
    pressCtrlTab();
    releaseCtrl();
    pressCtrlTab();
    expect(activeId()).toBe(a);
  });

  it("walks the other way with Shift", () => {
    const { a, b } = seedThreeTabs();
    renderHook(() => useTabShortcuts());
    useDocuments.getState().setActiveDocument(b);
    useDocuments.getState().setActiveDocument(a);

    // Backwards from index 0 wraps to the end of the walk order (a, b, c).
    pressCtrlTab({ shift: true });
    expect(activeId()).not.toBe(a);
    pressCtrlTab();
    expect(activeId()).toBe(a);
  });

  it("abandons a walk when the window loses focus mid-press", () => {
    const { a, b } = seedThreeTabs();
    renderHook(() => useTabShortcuts());
    useDocuments.getState().setActiveDocument(b);
    useDocuments.getState().setActiveDocument(a);

    pressCtrlTab();
    expect(activeId()).toBe(b);
    // The Ctrl release lands in another app; the walk must still commit here,
    // or the next one would resume from a snapshot taken minutes ago.
    fireEvent.blur(window);
    pressCtrlTab();
    expect(activeId()).toBe(a);
  });

  it("does nothing with a single tab open", () => {
    seedThreeTabs();
    const only = useDocuments.getState().createDocument({ path: "/w/only.md" });
    useDocuments.setState({ tabs: [only], activeId: only });
    renderHook(() => useTabShortcuts());

    pressCtrlTab();
    expect(activeId()).toBe(only);
  });
});

/** Rebuild a keystroke from a combo string — the inverse of `eventToCombo`. */
function eventFor(combo: string): KeyboardEvent {
  const parts = combo.split("+");
  const key = parts.at(-1) ?? "";
  return new KeyboardEvent("keydown", {
    key: key === "tab" ? "Tab" : key,
    ctrlKey: parts.includes("mod"),
    altKey: parts.includes("alt"),
    shiftKey: parts.includes("shift"),
    bubbles: true,
    cancelable: true,
  });
}

describe("useTabShortcuts — agrees with what the settings list reserves", () => {
  beforeEach(() => {
    useKeybindings.getState().resetAll();
  });

  it("acts on every combo declared as a fixed shortcut", () => {
    // The two halves are declared apart — `FIXED_SHORTCUTS` for the settings
    // list and the recorder, the handler here for the behaviour — so this is
    // what stops them drifting: a reserved combo nothing acts on would be a
    // shortcut the panel advertises and the app ignores.
    seedThreeTabs();
    renderHook(() => useTabShortcuts());

    for (const shortcut of FIXED_SHORTCUTS) {
      for (const combo of shortcut.combos) {
        const event = eventFor(combo);
        window.dispatchEvent(event);
        expect(event.defaultPrevented, combo).toBe(true);
      }
    }
  });
});
