import { describe, expect, it } from "vitest";

import type { FindMatch } from "@/features/find-replace/find-utils";

import { buildCmDecorations } from "./source-search";

function ranges(matches: FindMatch[], current: number) {
  const set = buildCmDecorations(matches, current);
  const out: { from: number; to: number; cls: string | undefined }[] = [];
  set.between(0, Number.MAX_SAFE_INTEGER, (from, to, value) => {
    out.push({ from, to, cls: (value.spec as { class?: string }).class });
  });
  return out;
}

describe("buildCmDecorations", () => {
  it("marks each match, with the current one distinct", () => {
    expect(
      ranges(
        [
          { index: 0, length: 3 },
          { index: 5, length: 2 },
        ],
        1,
      ),
    ).toEqual([
      { from: 0, to: 3, cls: "cm-find-match" },
      { from: 5, to: 7, cls: "cm-find-current" },
    ]);
  });

  it("skips zero-length matches", () => {
    expect(
      ranges(
        [
          { index: 0, length: 0 },
          { index: 4, length: 2 },
        ],
        0,
      ),
    ).toEqual([{ from: 4, to: 6, cls: "cm-find-match" }]);
  });

  it("produces an empty set for no matches", () => {
    expect(ranges([], -1)).toEqual([]);
  });
});
