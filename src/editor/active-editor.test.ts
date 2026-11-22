import { beforeEach, describe, expect, it } from "vitest";

import {
  clearActiveEditorIf,
  getActiveEditor,
  getEditorsForDoc,
  registerEditor,
  setActiveEditor,
  unregisterEditor,
} from "./active-editor";
import type { Crepe } from "@milkdown/crepe";

// Two distinct fake "Crepe" instances — only identity matters here.
const a = {} as never;
const b = {} as never;

describe("clearActiveEditorIf", () => {
  beforeEach(() => setActiveEditor(null));
  it("clears the slot when the editor owns it", () => {
    setActiveEditor(a);
    clearActiveEditorIf(a);
    expect(getActiveEditor()).toBeNull();
  });
  it("does NOT clear when a different editor owns the slot", () => {
    setActiveEditor(b);
    clearActiveEditorIf(a);
    expect(getActiveEditor()).toBe(b);
  });
  it("a later setActiveEditor hands the slot over; clearing the old owner is a no-op", () => {
    setActiveEditor(a);
    setActiveEditor(b); // focus moved to b
    clearActiveEditorIf(a); // a unmounts later
    expect(getActiveEditor()).toBe(b);
  });
});

describe("editor registry by document id", () => {
  // Distinct fake Crepe instances; identity is all that matters.
  const e1 = {} as Crepe;
  const e2 = {} as Crepe;

  beforeEach(() => {
    // Ensure a clean registry between tests.
    unregisterEditor("doc-1", e1);
    unregisterEditor("doc-1", e2);
    unregisterEditor("doc-2", e1);
    unregisterEditor("doc-2", e2);
  });

  it("returns [] when no editor is registered for a doc", () => {
    expect(getEditorsForDoc("doc-1")).toEqual([]);
  });

  it("returns both editors when two instances of the same doc are mounted", () => {
    registerEditor("doc-1", e1);
    registerEditor("doc-1", e2);
    const editors = getEditorsForDoc("doc-1");
    expect(editors).toHaveLength(2);
    expect(editors).toContain(e1);
    expect(editors).toContain(e2);
  });

  it("unregistering one editor leaves the other", () => {
    registerEditor("doc-1", e1);
    registerEditor("doc-1", e2);
    unregisterEditor("doc-1", e1);
    expect(getEditorsForDoc("doc-1")).toEqual([e2]);
  });

  it("unregistering the last editor empties the doc", () => {
    registerEditor("doc-1", e1);
    unregisterEditor("doc-1", e1);
    expect(getEditorsForDoc("doc-1")).toEqual([]);
  });

  it("registering the same editor twice does not duplicate it", () => {
    registerEditor("doc-1", e1);
    registerEditor("doc-1", e1);
    expect(getEditorsForDoc("doc-1")).toEqual([e1]);
  });

  it("keeps separate sets per document id", () => {
    registerEditor("doc-1", e1);
    registerEditor("doc-2", e2);
    expect(getEditorsForDoc("doc-1")).toEqual([e1]);
    expect(getEditorsForDoc("doc-2")).toEqual([e2]);
  });
});
