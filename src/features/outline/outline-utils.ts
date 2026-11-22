export interface OutlineHeading {
  /** Heading level 1–6. */
  level: number;
  /** Display text, with inline Markdown emphasis markers stripped. */
  text: string;
  /** Zero-based position among all headings (maps to the Nth heading element). */
  index: number;
}

/** Strip the common inline emphasis/marker characters for display. */
function cleanHeadingText(raw: string): string {
  return raw
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_~]/g, "")
    .replace(/#+\s*$/, "") // closing ATX hashes
    .trim();
}

/**
 * Extract headings from Markdown, in document order. Handles both ATX
 * (`#`-style) and Setext (text underlined by `===` / `---`) headings, and skips
 * fenced code blocks plus a leading YAML front matter block (so `---` fences and
 * `#` lines inside code are not mistaken for headings).
 *
 * Setext support matters for index alignment: the editor renders setext
 * headings as real `<h1>/<h2>` elements, so counting only ATX here would offset
 * every navigation target after the first setext heading.
 *
 * The returned `index` lines up with the order of rendered heading elements.
 */
export function extractHeadings(markdown: string): OutlineHeading[] {
  const lines = markdown.split("\n");
  const headings: OutlineHeading[] = [];
  let inFence = false;
  let inFrontmatter = false;
  let index = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";

    // Leading YAML front matter delimited by `---`.
    if (i === 0 && line.trim() === "---") {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (line.trim() === "---") inFrontmatter = false;
      continue;
    }

    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const atx = /^(#{1,6})\s+(.+)$/.exec(line);
    if (atx) {
      const level = (atx[1] ?? "").length;
      const text = cleanHeadingText(atx[2] ?? "");
      if (text) headings.push({ level, text, index: index++ });
      continue;
    }

    // Setext: a non-blank text line underlined by `===` (h1) or `---` (h2).
    // Per CommonMark, "text\n---" binds as a heading underline, not a rule.
    const text = line.trim();
    const underline = (lines[i + 1] ?? "").trim();
    if (text && (/^=+$/.test(underline) || /^-+$/.test(underline))) {
      const level = underline.startsWith("=") ? 1 : 2;
      const clean = cleanHeadingText(text);
      if (clean) headings.push({ level, text: clean, index: index++ });
      i++; // consume the underline line
      continue;
    }
  }

  return headings;
}
