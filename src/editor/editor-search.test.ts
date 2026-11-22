import { beforeEach, describe, expect, it } from "vitest";

import {
  clearSearchControllerIf,
  getSearchController,
  setSearchController,
  type EditorSearchController,
} from "./editor-search";

// Two distinct fake controllers — only identity matters here.
const a = {} as EditorSearchController;
const b = {} as EditorSearchController;

describe("clearSearchControllerIf", () => {
  beforeEach(() => setSearchController(null));

  it("clears the slot when the controller owns it", () => {
    setSearchController(a);
    clearSearchControllerIf(a);
    expect(getSearchController()).toBeNull();
  });

  it("does NOT clear when a different controller owns the slot", () => {
    setSearchController(b);
    clearSearchControllerIf(a);
    expect(getSearchController()).toBe(b);
  });

  it("a later setSearchController hands the slot over; clearing the old owner is a no-op", () => {
    setSearchController(a);
    setSearchController(b); // focus moved to b's editor
    clearSearchControllerIf(a); // a unmounts later
    expect(getSearchController()).toBe(b);
  });
});
