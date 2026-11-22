import { beforeEach, describe, expect, test } from "vitest";

import { useDocuments } from "./document";

/** Seed only the strip — these actions operate on tab order, not docs. */
function seed(tabs: string[], activeId: string): void {
  useDocuments.setState({ tabs, activeId });
}

describe("moveActiveTab", () => {
  beforeEach(() => {
    seed(["x", "y", "z"], "y");
  });

  test("delta +1 moves the active tab one slot right", () => {
    useDocuments.getState().moveActiveTab(1);
    expect(useDocuments.getState().tabs).toEqual(["x", "z", "y"]);
  });

  test("delta -1 moves the active tab one slot left", () => {
    useDocuments.getState().moveActiveTab(-1);
    expect(useDocuments.getState().tabs).toEqual(["y", "x", "z"]);
  });

  test("clamps at the last slot (no wrap)", () => {
    seed(["x", "y", "z"], "z");
    useDocuments.getState().moveActiveTab(1);
    expect(useDocuments.getState().tabs).toEqual(["x", "y", "z"]);
  });
});
