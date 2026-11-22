import { beforeEach, describe, expect, it } from "vitest";

import { useSelection } from "./selection";

beforeEach(() => {
  useSelection.setState({ text: "", caret: null });
});

describe("selection store", () => {
  it("stores the selected text", () => {
    useSelection.getState().setText("hello world");

    expect(useSelection.getState().text).toBe("hello world");
  });

  it("clears the selection", () => {
    useSelection.getState().setText("hello world");
    useSelection.getState().clear();

    expect(useSelection.getState().text).toBe("");
  });

  it("stores the caret position", () => {
    useSelection.getState().setCaret({ line: 12, column: 4 });

    expect(useSelection.getState().caret).toEqual({ line: 12, column: 4 });
  });

  it("keeps the caret when the selection is cleared", () => {
    // Collapsing a selection is the common case and still leaves a caret; only
    // an editor going away nulls it.
    useSelection.getState().setCaret({ line: 3, column: 1 });
    useSelection.getState().setText("hello");
    useSelection.getState().clear();

    expect(useSelection.getState().caret).toEqual({ line: 3, column: 1 });
  });

  it("drops the caret when a view without lines takes over", () => {
    useSelection.getState().setCaret({ line: 3, column: 1 });
    useSelection.getState().setCaret(null);

    expect(useSelection.getState().caret).toBeNull();
  });
});
