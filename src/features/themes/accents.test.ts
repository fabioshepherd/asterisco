import { describe, it, expect } from "vitest";

import { ACCENTS, DEFAULT_ACCENT, resolveAccent } from "./accents";

describe("resolveAccent", () => {
  it("returns a known accent unchanged", () => {
    expect(resolveAccent("grass")).toBe("grass");
    expect(resolveAccent("gray")).toBe("gray");
    expect(resolveAccent("jade")).toBe("jade");
  });

  it("falls back to the default accent for unknown values", () => {
    expect(resolveAccent("rebeccapurple")).toBe(DEFAULT_ACCENT);
    expect(resolveAccent("")).toBe(DEFAULT_ACCENT);
  });

  it("falls back to the default accent for missing values", () => {
    expect(resolveAccent(null)).toBe(DEFAULT_ACCENT);
    expect(resolveAccent(undefined)).toBe(DEFAULT_ACCENT);
  });
});

describe("accent registry", () => {
  it("defaults to orange — the signal colour", () => {
    expect(DEFAULT_ACCENT).toBe("orange");
  });

  it("contains the curated set and the monochrome option", () => {
    expect(ACCENTS).toEqual([
      "orange",
      "jade",
      "grass",
      "teal",
      "blue",
      "indigo",
      "plum",
      "bronze",
      "gold",
      "tomato",
      "gray",
    ]);
  });

  it("includes the default accent", () => {
    expect(ACCENTS).toContain(DEFAULT_ACCENT);
  });
});
