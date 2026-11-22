import { $nodeSchema, $remark } from "@milkdown/kit/utils";
import remarkFrontmatter from "remark-frontmatter";

import i18n from "@/i18n";

/**
 * YAML front matter support.
 *
 * Commonmark would otherwise read a leading `---\n…\n---` as a thematic break,
 * silently destroying the front matter on round-trip — and what the app did not
 * write, it must not destroy. `remark-frontmatter` parses/stringifies it as a
 * `yaml` mdast node,
 * and the schema below maps that node to a read-only, collapsible block in the
 * editor (edit the raw YAML in source mode). The markdown round-trips losslessly.
 */

const FRONTMATTER_NODE = "frontmatter";

/** remark plugin that recognises `---` YAML front matter (the `yaml` preset). */
export const remarkFrontmatterPlugin = $remark(
  "remarkFrontmatter",
  () => remarkFrontmatter,
  "yaml",
);

export const frontmatterSchema = $nodeSchema(FRONTMATTER_NODE, () => ({
  group: "block",
  atom: true,
  // The block is a non-editable leaf; its YAML is edited via source mode.
  selectable: false,
  isolating: true,
  attrs: { value: { default: "" } },
  parseDOM: [
    {
      tag: `details[data-type="${FRONTMATTER_NODE}"]`,
      getAttrs: (dom) => ({ value: dom.dataset.value ?? "" }),
    },
  ],
  toDOM: (node) => {
    const value = String(node.attrs.value ?? "");
    return [
      "details",
      {
        "data-type": FRONTMATTER_NODE,
        "data-value": value,
        class: "frontmatter-block",
        contenteditable: "false",
        open: "open",
      },
      ["summary", { class: "frontmatter-summary" }, i18n.t("frontmatter.label", { ns: "editor" })],
      ["pre", { class: "frontmatter-content" }, value],
    ];
  },
  parseMarkdown: {
    match: (node) => node.type === "yaml",
    runner: (state, node, type) => {
      state.addNode(type, { value: typeof node.value === "string" ? node.value : "" });
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === FRONTMATTER_NODE,
    runner: (state, node) => {
      const value: unknown = node.attrs.value;
      state.addNode("yaml", undefined, typeof value === "string" ? value : "");
    },
  },
}));
