import { describe, expect, it } from "vitest";

import { cycleOrder, promote } from "./tab-mru";

describe("promote", () => {
  it("moves an id to the front without duplicating it", () => {
    expect(promote(["a", "b", "c"], "c")).toEqual(["c", "a", "b"]);
  });

  it("adds an id the list has never seen", () => {
    expect(promote(["a"], "b")).toEqual(["b", "a"]);
  });

  it("leaves an already-first id where it is", () => {
    expect(promote(["a", "b"], "a")).toEqual(["a", "b"]);
  });
});

describe("cycleOrder", () => {
  it("walks the strip's tabs most-recently-used first", () => {
    // Visited c, then b, then a — so from a, one step back is b.
    expect(cycleOrder(["a", "b", "c"], ["a", "b", "c"], "a")).toEqual(["a", "b", "c"]);
  });

  it("ignores documents that are not open tabs", () => {
    expect(cycleOrder(["z", "b", "a"], ["a", "b"], "b")).toEqual(["b", "a"]);
  });

  it("appends never-activated tabs in strip order", () => {
    expect(cycleOrder(["b"], ["a", "b", "c"], "b")).toEqual(["b", "a", "c"]);
  });

  it("falls back to strip order on a cold start", () => {
    // Nothing recorded yet: the first Ctrl+Tab of a session is "the next tab".
    expect(cycleOrder([], ["a", "b", "c"], "a")).toEqual(["a", "b", "c"]);
  });

  it("anchors the walk on the active tab wherever the MRU list had it", () => {
    // Active is `c` even though `a` is the most recent — step 1 must be `a`,
    // the one visited before this, not `c` itself.
    expect(cycleOrder(["a", "b", "c"], ["a", "b", "c"], "c")).toEqual(["c", "a", "b"]);
  });

  it("copes with no active document", () => {
    expect(cycleOrder(["b"], ["a", "b"], null)).toEqual(["b", "a"]);
  });

  it("copes with an active document that is not in the strip", () => {
    expect(cycleOrder([], ["a", "b"], "z")).toEqual(["a", "b"]);
  });
});
