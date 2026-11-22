import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";

/**
 * The one syntax palette for code, shared by Crepe's code blocks and Source mode.
 *
 * Every colour is a design token: the `--syntax-*` roles (global.css, bound to
 * Radix step 11 and measured ≥ 4.5:1 on the page in every neutral and both modes
 * by `src/styles/contrast.test.ts`) plus the neutral ink tokens. Light/dark and
 * neutral switches are therefore pure CSS — no re-highlight.
 *
 * Markdown markup (Source mode) stays quiet: syntax characters in `--muted-fg`,
 * structure carried by weight and style, never by the accent (Signal Rule).
 */
export const tokenHighlightStyle = HighlightStyle.define([
  {
    tag: [
      tags.keyword,
      tags.operatorKeyword,
      tags.controlKeyword,
      tags.definitionKeyword,
      tags.moduleKeyword,
      tags.modifier,
      tags.self,
      tags.tagName,
    ],
    color: "var(--syntax-keyword)",
  },
  {
    tag: [
      tags.string,
      tags.special(tags.string),
      tags.regexp,
      tags.escape,
      tags.character,
      tags.attributeValue,
      tags.inserted,
    ],
    color: "var(--syntax-string)",
  },
  {
    tag: [tags.number, tags.bool, tags.null, tags.atom, tags.constant(tags.variableName)],
    color: "var(--syntax-literal)",
  },
  {
    tag: [tags.typeName, tags.className, tags.namespace, tags.attributeName, tags.macroName],
    color: "var(--syntax-type)",
  },
  { tag: [tags.invalid, tags.deleted], color: "var(--danger-text)" },
  { tag: tags.comment, color: "var(--muted-fg)", fontStyle: "italic" },
  {
    tag: [
      tags.meta,
      tags.processingInstruction,
      tags.contentSeparator,
      tags.labelName,
      tags.url,
      tags.punctuation,
    ],
    color: "var(--muted-fg)",
  },
  // Markdown structure (Source mode): weight and style, in ink.
  { tag: tags.heading, color: "var(--fg)", fontWeight: "700" },
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.link, color: "var(--fg)", textDecoration: "underline" },
]);

/** The token highlight style as an editor extension (Source mode and code blocks). */
export const tokenHighlighting = syntaxHighlighting(tokenHighlightStyle);

/**
 * Crepe code-block theme (`Crepe.Feature.CodeMirror`): replaces Crepe's default
 * `oneDark`, whose dark chrome and unmeasured palette showed even in light mode.
 * The block sits on the page surface; gutters and the active line stay quiet.
 */
export const codeBlockTheme = [
  EditorView.theme({
    "&": { backgroundColor: "transparent", color: "var(--fg)" },
    ".cm-content": { caretColor: "var(--fg)" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--fg)" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
      backgroundColor: "var(--selection)",
    },
    ".cm-gutters": {
      backgroundColor: "transparent",
      color: "var(--muted-fg)",
      border: "none",
    },
    ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "transparent" },
    ".cm-selectionMatch": { backgroundColor: "var(--muted)" },
    "&.cm-focused .cm-matchingBracket": {
      backgroundColor: "var(--muted)",
      outline: "1px solid var(--border)",
    },
    "&.cm-focused .cm-nonmatchingBracket": {
      backgroundColor: "transparent",
      outline: "1px solid var(--danger)",
    },
  }),
  tokenHighlighting,
];
