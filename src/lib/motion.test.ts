import { describe, expect, it } from "vitest";

import { DURATION, EASE, tween } from "./motion";

describe("motion tokens", () => {
  it("exposes positive, ordered durations in seconds (motion uses seconds)", () => {
    expect(DURATION.fast).toBeGreaterThan(0);
    expect(DURATION.fast).toBeLessThan(DURATION.base);
    expect(DURATION.base).toBeLessThan(DURATION.slow);
    expect(DURATION.slow).toBeLessThanOrEqual(0.3); // snappy & quiet: nothing slow
  });

  it("exposes cubic-bezier easings as 4-tuples", () => {
    expect(EASE.out).toHaveLength(4);
    expect(EASE.standard).toHaveLength(4);
  });

  it("exposes a fast tween mirroring the base duration", () => {
    expect(tween.fast.duration).toBe(DURATION.base);
  });
});
