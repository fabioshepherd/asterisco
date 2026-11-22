import { describe, expect, it } from "vitest";

import { extractHeadings } from "./outline-utils";

describe("extractHeadings", () => {
  it("extracts ATX headings with levels and order", () => {
    const md = "# One\n\ntext\n\n## Two\n\n### Three\n";
    expect(extractHeadings(md)).toEqual([
      { level: 1, text: "One", index: 0 },
      { level: 2, text: "Two", index: 1 },
      { level: 3, text: "Three", index: 2 },
    ]);
  });

  it("skips headings inside fenced code blocks", () => {
    const md = "# Real\n\n```md\n# Not a heading\n```\n\n## Also real\n";
    expect(extractHeadings(md).map((h) => h.text)).toEqual(["Real", "Also real"]);
  });

  it("skips a leading YAML front matter block", () => {
    const md = "---\ntitle: x\n---\n\n# Body\n";
    expect(extractHeadings(md)).toEqual([{ level: 1, text: "Body", index: 0 }]);
  });

  it("strips inline emphasis and code markers from the display text", () => {
    expect(extractHeadings("# A **bold** `code` _word_")[0]?.text).toBe("A bold code word");
  });

  it("ignores non-heading hash usage", () => {
    expect(extractHeadings("#nospace\ntext # not heading")).toEqual([]);
  });

  it("extracts setext headings (=== as h1, --- as h2)", () => {
    const md = "Title\n===\n\ntext\n\nSubtitle\n---\n";
    expect(extractHeadings(md)).toEqual([
      { level: 1, text: "Title", index: 0 },
      { level: 2, text: "Subtitle", index: 1 },
    ]);
  });

  it("keeps index aligned when ATX and setext headings are mixed", () => {
    const md = "# One\n\nTwo\n---\n\n### Three\n";
    expect(extractHeadings(md)).toEqual([
      { level: 1, text: "One", index: 0 },
      { level: 2, text: "Two", index: 1 },
      { level: 3, text: "Three", index: 2 },
    ]);
  });

  it("treats a --- after a blank line as a rule, not a heading", () => {
    expect(extractHeadings("text\n\n---\n\nmore")).toEqual([]);
  });

  it("does not treat fenced underlines as setext headings", () => {
    const md = "```\nTitle\n===\n```\n";
    expect(extractHeadings(md)).toEqual([]);
  });
});
