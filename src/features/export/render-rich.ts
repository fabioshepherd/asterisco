import DOMPurify from "dompurify";
import katex from "katex";
import { Marked, type TokenizerAndRendererExtension } from "marked";

import { renderMermaidToSvg } from "@/editor/mermaid";
import i18n from "@/i18n";

/**
 * Escape characters that would break out of HTML text or an attribute value.
 * Used for author-supplied footnote labels (the orphan marker) and as defense
 * for interpolated i18n strings placed into attributes.
 */
function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"]/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char] ?? char,
  );
}

type KatexOutput = "htmlAndMathml" | "mathml";

/**
 * Build the inline/block math `marked` extensions for a given KaTeX output mode.
 * Export uses `htmlAndMathml` (visual KaTeX + MathML); the clipboard uses
 * `mathml` so pasted math is clean MathML — editable in Word, rendered by
 * MathML-Core browsers — with no dependency on katex.css.
 */
function makeMathExtensions(output: KatexOutput): TokenizerAndRendererExtension[] {
  const inlineMath: TokenizerAndRendererExtension = {
    name: "inlineMath",
    level: "inline",
    start(src: string) {
      return src.indexOf("$");
    },
    tokenizer(src: string) {
      const match = /^\$([^$\n]+?)\$/.exec(src);
      if (match) return { type: "inlineMath", raw: match[0], text: match[1] ?? "" };
      return undefined;
    },
    renderer(token) {
      return katex.renderToString(token.text as string, { throwOnError: false, output });
    },
  };

  const blockMath: TokenizerAndRendererExtension = {
    name: "blockMath",
    level: "block",
    start(src: string) {
      return src.indexOf("$$");
    },
    tokenizer(src: string) {
      const match = /^\$\$([\s\S]+?)\$\$/.exec(src);
      if (match) return { type: "blockMath", raw: match[0], text: (match[1] ?? "").trim() };
      return undefined;
    },
    renderer(token) {
      const html = katex.renderToString(token.text as string, {
        throwOnError: false,
        displayMode: true,
        output,
      });
      return `<p class="katex-block">${html}</p>`;
    },
  };

  return [inlineMath, blockMath];
}

// Export renderer: visual KaTeX HTML + MathML (unchanged behavior).
const markedRich = new Marked({ gfm: true });
markedRich.use({ extensions: makeMathExtensions("htmlAndMathml") });

// Clipboard renderer: MathML-only math (self-contained, no katex.css needed).
const markedMathml = new Marked({ gfm: true });
markedMathml.use({ extensions: makeMathExtensions("mathml") });

/**
 * Resolve GFM footnotes before Markdown parsing.
 *
 * `marked` has no footnote support, so `[^label]` references leak as literal
 * text and `[^label]: …` definition lines render as plain paragraphs (or get
 * mis-parsed as reference-style links). This preprocessor:
 *  - collects definitions (multi-line: continuation on indented lines),
 *  - numbers labels by order of first *reference* (not definition order),
 *  - replaces references with numbered superscript anchors,
 *  - appends a `<section class="footnotes">` with one `<li>` per footnote, and
 *  - keeps defined-but-unreferenced (orphan) definitions, shown with their raw
 *    label as the marker (no fabricated number, no backlink) so their content is
 *    never silently dropped on export — matching the editor and the design doc.
 *
 * Footnote syntax inside fenced/inline code is masked out first so code
 * listings export untouched. Definition bodies are markdown rendered with the
 * block-level `parse` (so paragraphs/lists/bold inside a definition render
 * inside the `<li>`). The whole output is sanitized by DOMPurify downstream,
 * which neutralizes any malicious label or body.
 */
/**
 * Make a footnote label safe to embed in `id`/`href` attributes. Labels are
 * author-supplied and may contain characters that break out of an attribute
 * (e.g. a `"`), so reduce them to a slug of word chars and hyphens. Applied
 * identically to references and definitions so the anchors still match.
 */
function slugifyLabel(label: string): string {
  const slug = label.replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "fn";
}

// Private-use code point used to delimit code placeholders. It cannot appear in
// normal Markdown source, so the sentinel is collision-safe, and it is not a
// control character, so the restore regex stays lint-clean.
const FN_SENTINEL = "";

/**
 * Replace fenced code blocks (```` ``` ````) and inline code spans (`` ` ``)
 * with opaque placeholders so footnote processing (definition collection and
 * reference rewriting) never touches code. The placeholders are restored
 * verbatim afterwards, so the original code returns byte-identical and `marked`
 * renders it untouched.
 */
function maskCode(markdown: string): { masked: string; restore: (s: string) => string } {
  const store: string[] = [];
  const place = (raw: string): string => {
    // Surround with spaces so the placeholder never glues onto adjacent text.
    const token = ` ${FN_SENTINEL}FNCODE${store.length}${FN_SENTINEL} `;
    store.push(raw);
    return token;
  };
  // Fenced blocks first (``` or ~~~), then single/multi-backtick inline spans.
  let masked = markdown.replace(
    /(^|\n)([ \t]*)(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\2\3[ \t]*(?=\n|$)/g,
    (m) => place(m),
  );
  masked = masked.replace(/(`+)(?:[^`]|(?!\1)`)*?\1/g, (m) => place(m));
  const restoreRe = new RegExp(`${FN_SENTINEL}FNCODE(\\d+)${FN_SENTINEL}`, "g");
  const restore = (s: string): string =>
    s.replace(restoreRe, (_m, i: string) => store[Number(i)] ?? "");
  return { masked, restore };
}

/**
 * Collect footnote definitions from already-code-masked Markdown, removing them
 * from the body. A definition is `[^label]: text` plus any following lines that
 * are blank or indented (GFM continuation) up to the next non-indented line.
 * Continuation lines are dedented by the common leading indent so a second
 * paragraph or list is not misread as a code block. Returns the body with
 * definitions stripped and the definitions in source order.
 */
function collectDefinitions(masked: string): {
  body: string;
  defs: Map<string, string>;
  defOrder: string[];
} {
  const lines = masked.split("\n");
  const defs = new Map<string, string>();
  const defOrder: string[] = [];
  const out: string[] = [];
  const headRe = /^\[\^([^\]]+)\]:[ \t]*(.*)$/;
  const indentRe = /^(?: {1,}|\t)/;

  for (let i = 0; i < lines.length; i++) {
    const head = headRe.exec(lines[i] ?? "");
    if (!head) {
      out.push(lines[i] ?? "");
      continue;
    }
    const label = head[1] ?? "";
    const collected = [head[2] ?? ""];
    // Pull in continuation lines: blank lines, or lines indented past the
    // marker. Stop at the first non-indented, non-blank line. Drop trailing
    // blank lines so the next block keeps its own spacing.
    let j = i + 1;
    while (j < lines.length) {
      const line = lines[j] ?? "";
      if (line.trim() === "") {
        collected.push(line);
        j++;
        continue;
      }
      if (!indentRe.test(line)) break;
      collected.push(line);
      j++;
    }
    while (collected.length > 1 && (collected[collected.length - 1] ?? "").trim() === "") {
      collected.pop();
    }
    // Dedent continuation lines by the smallest indent among the non-blank
    // continuation lines (the first line is already un-indented after the
    // `[^label]:` marker).
    let common = Infinity;
    for (let k = 1; k < collected.length; k++) {
      const c = collected[k] ?? "";
      if (c.trim() === "") continue;
      const lead = /^[ \t]*/.exec(c)?.[0].length ?? 0;
      if (lead < common) common = lead;
    }
    if (common !== Infinity && common > 0) {
      for (let k = 1; k < collected.length; k++) {
        collected[k] = (collected[k] ?? "").slice(common);
      }
    }
    const text = collected.join("\n").trim();
    if (!defs.has(label)) defOrder.push(label);
    defs.set(label, text);
    i = j - 1; // resume after the consumed continuation lines
  }
  return { body: out.join("\n"), defs, defOrder };
}

function renderFootnotes(markdown: string, marked: Marked): string {
  // Mask code so footnote syntax inside fences/inline spans is never rewritten
  // or collected, then process footnotes on the masked text.
  const { masked, restore } = maskCode(markdown);

  const { body: strippedBody, defs, defOrder } = collectDefinitions(masked);

  // Number labels by order of first reference.
  const order: string[] = [];
  const referencedBody = strippedBody.replace(/\[\^([^\]\s]+)\]/g, (_m, label: string) => {
    if (!order.includes(label)) order.push(label);
    const n = order.indexOf(label) + 1;
    const id = slugifyLabel(label);
    return `<sup class="footnote-ref" id="fnref-${id}"><a href="#fn-${id}">${n}</a></sup>`;
  });

  // Restore code placeholders so fenced/inline code returns byte-identical and
  // `marked` renders it as untouched `<pre><code>` / `<code>`.
  const body = restore(referencedBody);

  // Orphan definitions: defined but never referenced. Per the design doc, only
  // referenced definitions are numbered; orphans are appended after them showing
  // their raw label as the marker (no fabricated number) and without a backlink
  // (they have no reference to return to, so a backlink would dangle).
  const orphans = defOrder.filter((label) => !order.includes(label));

  if (order.length === 0 && orphans.length === 0) return body;

  // Render a definition body as block-level markdown so paragraphs/lists/bold
  // inside it render correctly. Code placeholders are restored first so any
  // code inside a definition survives untouched.
  const renderBody = (raw: string): string =>
    raw ? marked.parse(restore(raw), { async: false }).trim() : "";

  const referencedItems = order.map((label) => {
    const n = order.indexOf(label) + 1;
    const id = slugifyLabel(label);
    const text = renderBody(defs.get(label) ?? "");
    // Localized backlink aria-label (matches the editor's `footnotes.backToReference`).
    const backLabel = escapeHtml(i18n.t("footnotes.backToReference", { ns: "editor", number: n }));
    return `<li id="fn-${id}"><span class="fn-num">${n}.</span> ${text} <a href="#fnref-${id}" class="fn-back" aria-label="${backLabel}">↩</a></li>`;
  });

  const orphanItems = orphans.map((label) => {
    const id = slugifyLabel(label);
    const text = renderBody(defs.get(label) ?? "");
    // Orphans get no number (only referenced defs are numbered) and no backlink
    // (no reference to return to). Show the raw label as the marker, escaped.
    return `<li id="fn-${id}"><span class="fn-num">${escapeHtml(label)}</span> ${text}</li>`;
  });

  const items = [...referencedItems, ...orphanItems].join("\n");

  // Blank lines around the block keep `marked` treating it as an HTML block
  // rather than wrapping it in a paragraph.
  return `${body}\n\n<section class="footnotes">\n<ol>\n${items}\n</ol>\n</section>\n`;
}

/** Replace ```mermaid fences with rendered SVG before Markdown parsing. */
async function preRenderMermaid(markdown: string): Promise<string> {
  const matches = [...markdown.matchAll(/```mermaid\r?\n([\s\S]*?)```/g)];
  let result = markdown;
  for (const match of matches) {
    const svg = await renderMermaidToSvg(match[1] ?? "");
    if (svg) result = result.replace(match[0], `\n\n<div class="mermaid-export">${svg}</div>\n\n`);
  }
  return result;
}

/** Shared rich pipeline: strip front matter → footnotes → Mermaid SVG → parse → sanitize. */
async function renderWith(markdown: string, marked: Marked): Promise<string> {
  const withoutFrontmatter = markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
  const withFootnotes = renderFootnotes(withoutFrontmatter, marked);
  const withMermaid = await preRenderMermaid(withFootnotes);
  const raw = marked.parse(withMermaid, { async: false });
  return DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true, svg: true, svgFilters: true, mathMl: true },
    ADD_ATTR: ["id", "href", "aria-label"],
  });
}

/** Render markdown to sanitized HTML with visual math + diagrams (for HTML/PDF export). */
export async function renderRichContentHtml(markdown: string): Promise<string> {
  return renderWith(markdown, markedRich);
}

/**
 * Render markdown to sanitized HTML for the clipboard: math as MathML (editable
 * in Word, rendered by MathML-Core browsers) and ```mermaid as inline SVG.
 */
export async function renderClipboardRichHtml(markdown: string): Promise<string> {
  return renderWith(markdown, markedMathml);
}
