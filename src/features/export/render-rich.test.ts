import { describe, expect, it, vi } from "vitest";

vi.mock("@/editor/mermaid", () => ({
  renderMermaidToSvg: vi.fn(() => Promise.resolve("<svg data-mock-mermaid></svg>")),
}));

import { renderClipboardRichHtml, renderRichContentHtml } from "./render-rich";

describe("renderRichContentHtml", () => {
  it("renders inline and block math with KaTeX and strips front matter", async () => {
    const markdown =
      "---\ntitle: Secret\n---\n\n# Heading\n\nInline $a^2$ and a block:\n\n$$\nb^2\n$$\n";
    const html = await renderRichContentHtml(markdown);

    expect(html).not.toContain("title: Secret");
    expect(html).toContain("katex");
    expect(html).toMatch(/<h1[^>]*>Heading/);
  });

  it("returns sanitized HTML for ordinary content", async () => {
    const html = await renderRichContentHtml("**bold** and `code`");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<code>code</code>");
  });

  it("still emits KaTeX HTML spans for export (htmlAndMathml)", async () => {
    const html = await renderRichContentHtml("Inline $a^2$");
    expect(html).toContain("katex-html");
  });
});

describe("render-rich: footnotes", () => {
  it("renders footnotes as a section with backlinks, no literal [^1]", async () => {
    const html = await renderRichContentHtml(
      `Claim.[^1] More.[^note]\n\n[^1]: First.\n[^note]: Second.\n`,
    );
    expect(html).not.toContain("[^1]");
    expect(html).toContain('class="footnotes"');
    expect(html).toMatch(/<sup[^>]*>[\s\S]*1[\s\S]*<\/sup>/);
    expect(html).toContain("First.");
    expect(html).toContain("Second.");
  });

  it("renders markdown inside a definition body (bold → strong)", async () => {
    const html = await renderRichContentHtml(`X.[^1]\n\n[^1]: bold **here**.\n`);
    expect(html).toContain("<strong>here</strong>");
  });

  it("numbers footnotes by first-reference order, not definition order", async () => {
    // Reference order: b then a; definitions listed a then b.
    const html = await renderRichContentHtml(`First[^b] then[^a].\n\n[^a]: Alpha.\n[^b]: Beta.\n`);
    // The "b" reference should be numbered 1, the "a" reference 2.
    expect(html).toMatch(/id="fnref-b"[^>]*>[\s\S]*?>1</);
    expect(html).toMatch(/id="fnref-a"[^>]*>[\s\S]*?>2</);
  });

  it("renders a reference with no matching definition without crashing", async () => {
    const html = await renderRichContentHtml(`Dangling[^missing].\n`);
    expect(html).not.toContain("[^missing]");
    expect(html).toContain('class="footnotes"');
    expect(html).toMatch(/<sup[^>]*>[\s\S]*1[\s\S]*<\/sup>/);
  });

  it("leaves text without footnotes unchanged", async () => {
    const html = await renderRichContentHtml("Just a paragraph.\n");
    expect(html).toContain("Just a paragraph.");
    expect(html).not.toContain("footnotes");
  });

  it("does not allow a malicious space-free label to inject script or event handlers", async () => {
    // The label must be space-free to pass the reference char class `[^\]\s]+`
    // and genuinely drive the slugify/anchor path.
    const label = `a"><img/src=x/onerror=alert(1)>`;
    const html = await renderRichContentHtml(`Bad.[^${label}]\n\n[^${label}]: nope.\n`);
    expect(html).not.toContain("onerror=");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script");
  });

  it("does not allow a quote in a label to break out of an attribute", async () => {
    // `"` passes the reference char class, so the label is slugified for use
    // in id/href attributes — it must not introduce an event handler.
    const label = `a"onmouseover="alert(1)`;
    const html = await renderRichContentHtml(`Hit.[^${label}]\n\n[^${label}]: body.\n`);
    expect(html).not.toContain("onmouseover=");
  });

  it("does not allow a script in the definition body to survive", async () => {
    const html = await renderRichContentHtml(`Y.[^1]\n\n[^1]: <script>alert(1)</script> safe.\n`);
    expect(html).not.toContain("<script");
  });

  it("does not rewrite footnote refs inside code fences or inline code", async () => {
    const md = [
      "Real ref.[^1]",
      "",
      "```js",
      "const x = arr[^1]; // looks like a ref but is code",
      "```",
      "",
      "Inline `also [^1] here` stays put.",
      "",
      "[^1]: A real footnote.",
      "",
    ].join("\n");
    const html = await renderRichContentHtml(md);

    // The fenced block keeps `[^1]` intact (HTML-escaped), NOT turned into a <sup>.
    expect(html).toMatch(/<pre><code[^>]*>[\s\S]*\[\^1\][\s\S]*<\/code><\/pre>/);
    // The inline code span keeps `[^1]` intact too.
    expect(html).toMatch(/<code>[^<]*\[\^1\][^<]*<\/code>/);
    // But the real footnote ref outside the fence still works.
    expect(html).toContain('class="footnotes"');
    expect(html).toContain("A real footnote.");
    expect(html).toMatch(/<sup[^>]*id="fnref-1"[^>]*>[\s\S]*?>1</);
  });

  it("does not collect a definition line that lives inside a code fence", async () => {
    const md = [
      "Text with no real footnote.",
      "",
      "```",
      "[^1]: this is code, not a definition",
      "```",
      "",
    ].join("\n");
    const html = await renderRichContentHtml(md);
    // No footnotes section, and the line survives verbatim inside the code block.
    expect(html).not.toContain("footnotes");
    expect(html).toMatch(/<pre><code[^>]*>[\s\S]*\[\^1\]: this is code[\s\S]*<\/code><\/pre>/);
  });

  it("renders a multi-paragraph definition fully inside the <li> with nothing left in the body", async () => {
    const md = [
      "See note.[^1]",
      "",
      "[^1]: First paragraph of the note.",
      "",
      "    Second paragraph of the note.",
      "",
    ].join("\n");
    const html = await renderRichContentHtml(md);

    const section = html.slice(html.indexOf('<section class="footnotes"'));
    expect(section).toContain("First paragraph of the note.");
    expect(section).toContain("Second paragraph of the note.");
    // The continuation must NOT leak into the body as a stray code block.
    const beforeSection = html.slice(0, html.indexOf('<section class="footnotes"'));
    expect(beforeSection).not.toContain("Second paragraph of the note.");
    // Dedented continuation must not be misread as a code block anywhere.
    expect(html).not.toMatch(/<pre><code[^>]*>[\s\S]*Second paragraph[\s\S]*<\/code><\/pre>/);
  });

  it("renders a definition containing a list block-level inside the <li>", async () => {
    const md = [
      "See list.[^1]",
      "",
      "[^1]: Intro line.",
      "",
      "    - item one",
      "    - item two",
      "",
    ].join("\n");
    const html = await renderRichContentHtml(md);

    const section = html.slice(html.indexOf('<section class="footnotes"'));
    expect(section).toContain("Intro line.");
    expect(section).toContain("item one");
    expect(section).toContain("item two");
    // The list items should be real <li> inside a <ul>, not stray body text.
    expect(section).toMatch(/<ul>[\s\S]*<li>item one<\/li>[\s\S]*<\/ul>/);
  });

  it("preserves a defined-but-unreferenced (orphan) footnote in the export", async () => {
    const md = [
      "Has a ref.[^used]",
      "",
      "[^used]: Used definition.",
      "[^orphan]: Orphan definition with no reference.",
      "",
    ].join("\n");
    const html = await renderRichContentHtml(md);

    expect(html).toContain('class="footnotes"');
    // Both the used and the orphan definition content survive.
    expect(html).toContain("Used definition.");
    expect(html).toContain("Orphan definition with no reference.");
    // The orphan must NOT produce a dangling backlink to a non-existent fnref.
    expect(html).not.toContain("fnref-orphan");
  });

  it("shows an orphan definition with its label, not a fabricated number", async () => {
    // Only [^used] is referenced. The orphan [^orphan] must show its raw label as
    // the marker — never a continuing sequential number like "2." — matching the
    // editor + design doc (only referenced defs are numbered).
    const md = [
      "Has a ref.[^used]",
      "",
      "[^used]: Used definition.",
      "[^orphan]: Orphan definition with no reference.",
      "",
    ].join("\n");
    const html = await renderRichContentHtml(md);

    const section = html.slice(html.indexOf('<section class="footnotes"'));
    // The referenced def keeps its number "1.".
    expect(section).toContain("1.");
    // The orphan li shows the label "orphan" as its marker, not "2.".
    expect(section).toMatch(/<li id="fn-orphan">\s*<span class="fn-num">orphan<\/span>/);
    expect(section).not.toContain("2.");
  });

  it("emits a backlink with a localized aria-label for referenced footnotes", async () => {
    const html = await renderRichContentHtml(`Claim.[^1]\n\n[^1]: First.\n`);
    // The backlink carries an aria-label, following i18n (en default text here),
    // not a hardcoded literal divorced from the export's localization.
    expect(html).toContain('aria-label="Back to reference 1"');
    expect(html).toContain('class="fn-back"');
  });
});

describe("renderClipboardRichHtml", () => {
  it("renders inline math as MathML, not KaTeX HTML spans", async () => {
    const html = await renderClipboardRichHtml("Inline $a^2$ here");
    expect(html).toContain("<math");
    expect(html).not.toContain("katex-html");
  });

  it("renders block math as MathML in display mode", async () => {
    const html = await renderClipboardRichHtml("$$\nb^2\n$$\n");
    expect(html).toContain("<math");
    expect(html).toContain('display="block"'); // see Pre-flight; weaken if KaTeX differs
    expect(html).not.toContain("katex-html");
  });

  it("renders mermaid fences as inline SVG", async () => {
    const html = await renderClipboardRichHtml("```mermaid\ngraph TD; A-->B;\n```\n");
    expect(html).toContain("<svg");
  });

  it("renders footnotes like the export path", async () => {
    const html = await renderClipboardRichHtml("Claim.[^1]\n\n[^1]: First.\n");
    expect(html).toContain('class="footnotes"');
    expect(html).toContain("First.");
    expect(html).not.toContain("[^1]");
  });

  it("sanitizes a script injected via a footnote body", async () => {
    const html = await renderClipboardRichHtml("Y.[^1]\n\n[^1]: <script>alert(1)</script> ok.\n");
    expect(html).not.toContain("<script");
  });

  it("sanitizes raw inline script in the body", async () => {
    const html = await renderClipboardRichHtml("Hi <script>alert(1)</script> there");
    expect(html).not.toContain("<script");
  });

  it("strips front matter", async () => {
    const html = await renderClipboardRichHtml("---\ntitle: Secret\n---\n\n# H\n");
    expect(html).not.toContain("title: Secret");
  });
});
