/**
 * Strip Markdown syntax down to the prose a reader actually sees, so word and
 * the word count reflects content rather than markup. Without this, `#`, table
 * pipes, `**`, fences, etc. are counted as words (an empty table
 * reads as dozens of "words"). Rough by design — good enough for a status bar.
 */
export function markdownToPlainText(markdown: string): string {
  let text = markdown;
  // YAML front matter at the very top of the document.
  text = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
  // Fenced code blocks: keep the code text, drop the ``` fence lines.
  text = text.replace(/^[ \t]*```[^\n]*\n([\s\S]*?)\n[ \t]*```[ \t]*$/gm, "$1");
  // Inline code: keep the contents, drop the backticks.
  text = text.replace(/`([^`]+)`/g, "$1");
  // Images: drop entirely (the alt text isn't authored prose).
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
  // Links: keep the visible link text, drop the target.
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
  // Autolinks <https://…>.
  text = text.replace(/<([^>\s]+)>/g, "$1");
  // ATX heading markers.
  text = text.replace(/^[ \t]*#{1,6}[ \t]+/gm, "");
  // Blockquote markers (possibly nested).
  text = text.replace(/^[ \t]*>+[ \t]?/gm, "");
  // List markers and task-list checkboxes.
  text = text.replace(/^[ \t]*(?:[-*+]|\d+[.)])[ \t]+(?:\[[ xX]\][ \t]+)?/gm, "");
  // Thematic breaks (---, ***, ___).
  text = text.replace(/^[ \t]*([-*_])(?:[ \t]*\1){2,}[ \t]*$/gm, "");
  // Table delimiter rows (| --- | :--: | …).
  text = text.replace(
    /^[ \t]*\|?[ \t]*:?-{2,}:?[ \t]*(?:\|[ \t]*:?-{2,}:?[ \t]*)+\|?[ \t]*$/gm,
    "",
  );
  // Remaining table cell separators become spaces.
  text = text.replace(/\|/g, " ");
  // Emphasis / strong / strikethrough markers.
  text = text.replace(/\*\*|__|~~|\*|_/g, "");
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Words in an already-plain string (no markdown stripping). Used for selection
 * counts, where the editor hands us visible text.
 */
export function countWords(plainText: string): number {
  const text = plainText.replace(/\s+/g, " ").trim();
  return text === "" ? 0 : text.split(" ").length;
}

/** Rough word count for the prose in a markdown document. */
export function countMarkdownWords(markdown: string): number {
  return countWords(markdownToPlainText(markdown));
}
