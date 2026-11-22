import { describe, expect, it } from "vitest";

import { countMarkdownWords, countWords } from "./word-count";

describe("countMarkdownWords", () => {
  it("counts words", () => {
    expect(countMarkdownWords("hello brave new world")).toBe(4);
  });

  it("reports zero for an empty document", () => {
    expect(countMarkdownWords("")).toBe(0);
  });
});

describe("countMarkdownWords — counts rendered prose, not markdown syntax", () => {
  it("does not count heading markers as words", () => {
    expect(countMarkdownWords("# Heading One")).toBe(2);
  });

  it("strips strong/emphasis/strikethrough/inline-code markers", () => {
    expect(countMarkdownWords("Text **bold** *italic* ~~no~~ `code`.")).toBe(5);
  });

  it("counts an empty table as zero words", () => {
    expect(countMarkdownWords("|  |  |\n| --- | --- |\n|  |  |")).toBe(0);
  });

  it("counts link text, not the URL or brackets", () => {
    expect(countMarkdownWords("see [the docs](https://example.com)")).toBe(3);
  });

  it("drops images entirely", () => {
    expect(countMarkdownWords("![alt text](pic.png)")).toBe(0);
  });

  it("ignores YAML front matter", () => {
    const md = "---\ntitle: Hello\ntags: [a, b]\n---\n\nBody text here";
    expect(countMarkdownWords(md)).toBe(3);
  });

  it("strips list and blockquote markers", () => {
    expect(countMarkdownWords("- one\n- two\n\n> quoted line")).toBe(4);
  });

  it("keeps code-block contents but drops the fences", () => {
    expect(countMarkdownWords("```ts\nconst x = 1;\n```")).toBe(4);
  });
});

describe("countWords — plain selection text", () => {
  it("counts words of plain text", () => {
    expect(countWords("hello brave new world")).toBe(4);
  });

  it("normalizes surrounding and repeated whitespace", () => {
    expect(countWords("  hello   world \n")).toBe(2);
  });

  it("reports zero for an empty selection", () => {
    expect(countWords("")).toBe(0);
  });
});
