import { describe, expect, it } from "vitest";

import { resolveTabDrop, TAB_STRIP_END } from "./tab-dnd";

describe("resolveTabDrop", () => {
  const tabs = ["a", "b", "c"];

  it("targets the slot of the tab it was dropped on", () => {
    expect(resolveTabDrop(tabs, "a", "c")).toBe(2);
    expect(resolveTabDrop(tabs, "c", "a")).toBe(0);
  });

  it("moves the tab to the end when dropped on empty strip space", () => {
    expect(resolveTabDrop(tabs, "a", TAB_STRIP_END)).toBe(2);
    expect(resolveTabDrop(tabs, "c", TAB_STRIP_END)).toBeNull();
    expect(resolveTabDrop(tabs, "x", TAB_STRIP_END)).toBeNull();
  });

  it("is a no-op outside the strip or on itself", () => {
    expect(resolveTabDrop(tabs, "a", null)).toBeNull();
    expect(resolveTabDrop(tabs, "b", "b")).toBeNull();
  });

  it("is a no-op for ids that are not open tabs", () => {
    expect(resolveTabDrop(tabs, "x", "a")).toBeNull();
    expect(resolveTabDrop(tabs, "a", "x")).toBeNull();
  });
});
