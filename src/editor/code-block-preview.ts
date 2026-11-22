import { renderMermaidPreview } from "./mermaid";

/** Whether a code-block language should be rendered as a Mermaid diagram. */
export function isMermaidLanguage(language: string): boolean {
  return language.trim().toLowerCase() === "mermaid";
}

/**
 * Crepe code-block preview renderer. Only blocks whose source is not what the reader
 * wants to see get a preview: ```mermaid renders as a diagram (SVG, asynchronous —
 * hence `applyPreview`), and the Latex feature wraps this again at the Crepe level
 * (it registers after the CodeMirror feature), so `latex` blocks render as KaTeX
 * before this is reached. Every other language returns `null`, which makes Crepe
 * hide the preview panel: the code is shown once, highlighted by CodeMirror itself
 * (`code-theme.ts`), never twice.
 */
export function renderCodeBlockPreview(
  language: string,
  content: string,
  applyPreview: (value: null | string | HTMLElement) => void,
): void | null | string | HTMLElement {
  if (isMermaidLanguage(language)) {
    return renderMermaidPreview(content, applyPreview);
  }
  return null;
}
