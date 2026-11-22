import { describe, it, expect } from "vitest";

import { NEUTRALS, DEFAULT_NEUTRAL, NEUTRAL_KEY, resolveNeutral } from "./neutrals";

describe("resolveNeutral", () => {
  it("returns a known neutral unchanged", () => {
    expect(resolveNeutral("sand")).toBe("sand");
    expect(resolveNeutral("slate")).toBe("slate");
    expect(resolveNeutral("gray")).toBe("gray");
  });

  it("falls back to the default for unknown/missing values", () => {
    expect(resolveNeutral("olive")).toBe(DEFAULT_NEUTRAL);
    expect(resolveNeutral("")).toBe(DEFAULT_NEUTRAL);
    expect(resolveNeutral(null)).toBe(DEFAULT_NEUTRAL);
    expect(resolveNeutral(undefined)).toBe(DEFAULT_NEUTRAL);
  });
});

describe("neutral registry", () => {
  it("defaults to the chroma-0 gray and lists the curated neutrals", () => {
    expect(DEFAULT_NEUTRAL).toBe("gray");
    expect(NEUTRALS).toEqual(["gray", "sand", "slate"]);
    expect(NEUTRALS).toContain(DEFAULT_NEUTRAL);
  });

  it("exposes the bootstrap localStorage key", () => {
    expect(NEUTRAL_KEY).toBe("asterisco.neutral");
  });
});
