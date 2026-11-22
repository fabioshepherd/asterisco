import { describe, expect, it } from "vitest";

import {
  countMatches,
  findMatches,
  isInvalidRegex,
  replaceAllMatches,
  type FindOptions,
} from "./find-utils";

const plain: FindOptions = {
  regex: false,
  caseSensitive: false,
  wholeWord: false,
};

describe("countMatches", () => {
  it("counts case-insensitively by default", () => {
    expect(countMatches("Foo foo FOO", "foo", plain)).toBe(3);
  });

  it("respects case sensitivity", () => {
    expect(countMatches("Foo foo", "foo", { ...plain, caseSensitive: true })).toBe(1);
  });

  it("respects whole-word matching", () => {
    expect(countMatches("cat category", "cat", { ...plain, wholeWord: true })).toBe(1);
  });

  it("treats the query literally unless regex is enabled", () => {
    expect(countMatches("a.b axb", "a.b", plain)).toBe(1);
    expect(countMatches("a.b axb", "a.b", { ...plain, regex: true })).toBe(2);
  });

  it("returns 0 for an invalid regex", () => {
    expect(countMatches("text", "(", { ...plain, regex: true })).toBe(0);
  });
});

describe("findMatches", () => {
  it("returns the offset and length of every match", () => {
    expect(findMatches("a b a b", "a", plain)).toEqual([
      { index: 0, length: 1 },
      { index: 4, length: 1 },
    ]);
  });

  it("returns no matches for an empty query", () => {
    expect(findMatches("anything", "", plain)).toEqual([]);
  });

  it("returns no matches for an invalid regex", () => {
    expect(findMatches("text", "(", { ...plain, regex: true })).toEqual([]);
  });

  it("terminates on a zero-length regex match", () => {
    // `a*` matches the empty string at every position; the guard must advance.
    const result = findMatches("bbb", "a*", { ...plain, regex: true });
    expect(result.every((m) => m.length === 0)).toBe(true);
    expect(result.length).toBe("bbb".length + 1);
  });
});

describe("isInvalidRegex", () => {
  it("is false for plain-mode queries even with regex metacharacters", () => {
    expect(isInvalidRegex("(", plain)).toBe(false);
  });

  it("is false for an empty query in regex mode", () => {
    expect(isInvalidRegex("", { ...plain, regex: true })).toBe(false);
  });

  it("is false for a valid regex", () => {
    expect(isInvalidRegex("a.*b", { ...plain, regex: true })).toBe(false);
  });

  it("is true for a malformed regex in regex mode", () => {
    expect(isInvalidRegex("(", { ...plain, regex: true })).toBe(true);
    expect(isInvalidRegex("a[", { ...plain, regex: true })).toBe(true);
  });
});

describe("replaceAllMatches", () => {
  it("replaces every literal match", () => {
    expect(replaceAllMatches("foo foo", "foo", "bar", plain)).toBe("bar bar");
  });

  it("keeps a literal $ in the replacement", () => {
    expect(replaceAllMatches("price", "price", "$5", plain)).toBe("$5");
  });

  it("supports group references in regex mode", () => {
    expect(
      replaceAllMatches("2026-05-31", "(\\d+)-(\\d+)", "$2/$1", {
        ...plain,
        regex: true,
      }),
    ).toBe("05/2026-31");
  });
});
