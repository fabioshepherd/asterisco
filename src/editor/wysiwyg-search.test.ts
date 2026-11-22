import { Schema } from "@milkdown/kit/prose/model";
import { describe, expect, it } from "vitest";

import type { FindOptions } from "@/features/find-replace/find-utils";

import type { FindQuery } from "./editor-search";
import { buildSearchText, findPmMatches, mapMatchToPmRange } from "./wysiwyg-search";

// A minimal schema mirroring the relevant shape of real docs: blocks of inline
// text, an inline atom (image), and a strong mark to split text into nodes.
const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "inline*", toDOM: () => ["p", 0] },
    image: { group: "inline", inline: true, atom: true, toDOM: () => ["img"] },
    text: { group: "inline" },
  },
  marks: {
    strong: { toDOM: () => ["strong", 0] },
  },
});

const plain: FindOptions = { regex: false, caseSensitive: false, wholeWord: false };
const q = (query: string, options: FindOptions = plain): FindQuery => ({ query, options });

function para(...inline: ReturnType<typeof schema.text>[]) {
  return schema.node("paragraph", null, inline);
}
function doc(...blocks: ReturnType<typeof schema.node>[]) {
  return schema.node("doc", null, blocks);
}

describe("buildSearchText", () => {
  it("maps a single text node's chars to contiguous PM positions", () => {
    const d = doc(para(schema.text("hello world")));
    const st = buildSearchText(d);
    expect(st.text).toBe("hello world");
    // First char sits at PM position 1 (inside the opening paragraph token).
    expect(st.segments).toEqual([{ offset: 0, from: 1, len: 11 }]);
  });

  it("keeps mark-split text contiguous (no separator)", () => {
    const d = doc(para(schema.text("he"), schema.text("llo", [schema.mark("strong")])));
    const st = buildSearchText(d);
    expect(st.text).toBe("hello");
  });

  it("inserts a separator across block boundaries", () => {
    const d = doc(para(schema.text("foo")), para(schema.text("bar")));
    const st = buildSearchText(d);
    expect(st.text).toBe("foo\nbar");
  });

  it("inserts a separator around inline atoms", () => {
    const d = doc(para(schema.text("a"), schema.node("image"), schema.text("b")));
    const st = buildSearchText(d);
    expect(st.text).toBe("a\nb");
  });
});

describe("mapMatchToPmRange", () => {
  it("maps a match within a single text node", () => {
    const st = buildSearchText(doc(para(schema.text("hello world hello"))));
    expect(mapMatchToPmRange(st, { index: 12, length: 5 })).toEqual({ from: 13, to: 18 });
  });

  it("maps a match spanning two contiguous (mark-split) nodes as one range", () => {
    const st = buildSearchText(
      doc(para(schema.text("he"), schema.text("llo", [schema.mark("strong")]))),
    );
    expect(mapMatchToPmRange(st, { index: 0, length: 5 })).toEqual({ from: 1, to: 6 });
  });

  it("drops a match that crosses a separator gap", () => {
    const st = buildSearchText(doc(para(schema.text("foo")), para(schema.text("bar"))));
    // "foo\nbar" → matching the whole thing crosses the block gap.
    expect(mapMatchToPmRange(st, { index: 0, length: 7 })).toBeNull();
  });

  it("drops zero-length matches", () => {
    const st = buildSearchText(doc(para(schema.text("foo"))));
    expect(mapMatchToPmRange(st, { index: 1, length: 0 })).toBeNull();
  });
});

describe("findPmMatches", () => {
  it("finds every occurrence in visible text", () => {
    const d = doc(para(schema.text("cat dog cat")));
    expect(findPmMatches(d, q("cat"))).toEqual([
      { from: 1, to: 4 },
      { from: 9, to: 12 },
    ]);
  });

  it("matches across a mark boundary", () => {
    const d = doc(para(schema.text("he"), schema.text("llo", [schema.mark("strong")])));
    expect(findPmMatches(d, q("hello"))).toEqual([{ from: 1, to: 6 }]);
  });

  it("does not match across a block boundary", () => {
    const d = doc(para(schema.text("foo")), para(schema.text("bar")));
    expect(findPmMatches(d, q("foobar"))).toEqual([]);
  });

  it("does not match across an inline atom", () => {
    const d = doc(para(schema.text("a"), schema.node("image"), schema.text("b")));
    expect(findPmMatches(d, q("ab"))).toEqual([]);
  });

  it("filters out zero-length regex matches", () => {
    const d = doc(para(schema.text("foo")));
    expect(findPmMatches(d, q("x*", { ...plain, regex: true }))).toEqual([]);
  });

  it("honours whole-word matching next to a separator", () => {
    const d = doc(para(schema.text("foo")), para(schema.text("bar")));
    expect(findPmMatches(d, q("foo", { ...plain, wholeWord: true }))).toEqual([{ from: 1, to: 4 }]);
  });
});
