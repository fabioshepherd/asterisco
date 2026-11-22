import katexCss from "katex/dist/katex.min.css?raw";

import { DEFAULT_ACCENT } from "@/features/themes/accents";

export interface ExportTheme {
  bg: string;
  fg: string;
  accent: string;
  /** Accessible accent step for link *text* (accent-9 is a solid fill, too light for body text). */
  linkColor: string;
  muted: string;
  surface: string;
  border: string;
  mutedFg: string;
  bodyFont: string;
  codeFont: string;
  colorScheme: "light" | "dark";
}

/**
 * Hard-coded light values — the safety net if a token can't be read. They are
 * the app default, Gray neutral + Orange accent, at the steps THEMING.md maps
 * each token to (Radix Colors light scales; `theme-snapshot.test.ts` pins them).
 */
export const FALLBACK_LIGHT = {
  bg: "#fcfcfc", // gray-1
  fg: "#202020", // gray-12
  accent: "#f76b15", // orange-9
  // The accent's text step, so the safety-net path still gives readable links.
  linkColor: "#cc4e00", // orange-11
  muted: "#f0f0f0", // gray-3
  surface: "#f9f9f9", // gray-2
  border: "#d9d9d9", // gray-6
  mutedFg: "#646464", // gray-11
  // Serif (not sans) on purpose: the product reading font is a serif, so the
  // fallback body should match the editor — unlike the old sans-serif EXPORT_CSS.
  bodyFont: 'ui-serif, Georgia, "Times New Roman", serif',
  codeFont: 'ui-monospace, "SF Mono", Menlo, monospace',
} as const;

/**
 * Token values are interpolated raw into the export `<style>`. They normally come
 * from internal Radix tokens, but a user-loaded custom CSS theme can override the
 * semantic tokens — so reject any value carrying CSS-structure characters (which a
 * legitimate colour/font value never holds) and fall back, preventing a malicious
 * token from injecting rules into the exported document.
 */
function isSafeTokenValue(value: string): boolean {
  return /^[^<>{}@;]*$/.test(value) && !value.includes("/*");
}

/**
 * Read the resolved design tokens for the export target off the live <html>.
 * For "light" we momentarily force `.dark` off and restore it synchronously, so
 * the neutral tokens (declared on :root) recompute to their light values without
 * the browser ever painting the change. The current accent is left untouched.
 */
export function snapshotExportTheme(target: "light" | "active"): ExportTheme {
  if (typeof document === "undefined") {
    return { ...FALLBACK_LIGHT, colorScheme: "light" };
  }
  const root = document.documentElement;
  const hadDark = root.classList.contains("dark");
  const wantDark = target === "active" ? hadDark : false;
  if (wantDark !== hadDark) root.classList.toggle("dark", wantDark);
  try {
    const cs = getComputedStyle(root);
    const read = (name: string, fallback: string) => {
      const value = cs.getPropertyValue(name).trim();
      return value && isSafeTokenValue(value) ? value : fallback;
    };
    const accent = read("--accent", FALLBACK_LIGHT.accent);
    // `--accent` is the accent-9 signal step (too light for body-size text). Read
    // the active accent's accessible text step (Radix step 11 — DESIGN.md's
    // Measured-Fill Rule) so exported links clear WCAG AA. The accent id
    // (`data-accent`) is the scale name; absent = the app default.
    const accentId = root.dataset.accent || DEFAULT_ACCENT;
    // The monochrome accent follows whichever neutral is live rather than
    // pinning one scale, so its text step is the neutral's own secondary ink.
    const linkVar = accentId === "gray" ? "--muted-fg" : `--${accentId}-11`;
    return {
      bg: read("--bg", FALLBACK_LIGHT.bg),
      fg: read("--fg", FALLBACK_LIGHT.fg),
      accent,
      linkColor: read(linkVar, accent),
      muted: read("--muted", FALLBACK_LIGHT.muted),
      surface: read("--surface", FALLBACK_LIGHT.surface),
      border: read("--border", FALLBACK_LIGHT.border),
      mutedFg: read("--muted-fg", FALLBACK_LIGHT.mutedFg),
      bodyFont: read("--editor-font-default", "") || read("--font-serif", FALLBACK_LIGHT.bodyFont),
      codeFont: read("--font-mono", FALLBACK_LIGHT.codeFont),
      colorScheme: wantDark ? "dark" : "light",
    };
  } finally {
    if (wantDark !== hadDark) root.classList.toggle("dark", hadDark);
  }
}

/** Build the self-contained prose stylesheet for export/print from a theme snapshot. */
export function buildExportCss(theme: ExportTheme): string {
  return `
  :root { color-scheme: ${theme.colorScheme}; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: ${theme.bg};
    color: ${theme.fg};
    font-family: ${theme.bodyFont};
    font-optical-sizing: auto;
    line-height: 1.7;
    /* Prose wraps to avoid orphans; headings override with balance below. */
    text-wrap: pretty;
  }
  main { max-width: 46rem; margin: 0 auto; padding: 3rem 1.5rem; }
  /* The title sits flush at the top — no leading heading margin on the page. */
  main > :first-child { margin-top: 0; }
  h1, h2, h3, h4, h5, h6 {
    font-weight: 600;
    line-height: 1.3;
    margin: 1.8em 0 0.6em;
    text-wrap: balance;
  }
  /* The document title carries the display weight + size of the editor's H1. */
  h1 { font-size: 2.1rem; font-weight: 700; line-height: 1.2; }
  h2 { font-size: 1.6rem; }
  h3 { font-size: 1.3rem; }
  h4 { font-size: 1.1rem; }
  h5 { font-size: 1rem; }
  h6 { font-size: 0.9rem; }
  p, ul, ol, blockquote, table, pre { margin: 0 0 1rem; }
  /* Underlined so links read as links in grayscale print, not by colour alone. */
  a { color: ${theme.linkColor}; text-decoration: underline; text-underline-offset: 0.15em; }
  code {
    font-family: ${theme.codeFont};
    font-size: 0.9em;
    background: ${theme.muted};
    padding: 0.15em 0.35em;
    /* Brand rounded scale: sm for inline code, md for code blocks (see DESIGN.md). */
    border-radius: 6px;
  }
  pre {
    background: ${theme.surface};
    padding: 1rem;
    border-radius: 10px;
    overflow: auto;
  }
  pre code { background: none; padding: 0; }
  blockquote {
    border-left: 3px solid ${theme.border};
    margin-inline: 0;
    padding-left: 1rem;
    color: ${theme.mutedFg};
  }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid ${theme.border}; padding: 0.45rem 0.7rem; text-align: left; }
  img { max-width: 100%; }
  hr { border: none; border-top: 1px solid ${theme.border}; margin: 2rem 0; }
  .footnote-ref { font-size: 0.75em; vertical-align: super; line-height: 0; }
  /* The superscript number is the marker; underlining it would clutter it. */
  .footnote-ref a { text-decoration: none; }
  .footnotes {
    margin-top: 2.5rem;
    padding-top: 1rem;
    border-top: 1px solid ${theme.border};
    font-size: 0.85em;
  }
  /* Explicit .fn-num supplies the number, so suppress native list markers. */
  .footnotes ol { margin: 0; padding: 0; list-style: none; }
  .footnotes li { margin: 0 0 0.4rem; }
  .footnotes .fn-num { font-variant-numeric: tabular-nums; }
  .footnotes .fn-back { text-decoration: none; }
  .katex-block { text-align: center; margin: 1.2rem 0; }
  .mermaid-export { display: flex; justify-content: center; margin: 1.2rem 0; }
  .mermaid-export svg { max-width: 100%; height: auto; }
  @media print {
    main { max-width: none; padding: 0; }
    /* On paper there is no horizontal scroll, so wrap long code lines instead
       of letting them run off (and get clipped at) the page edge. */
    pre, pre code { white-space: pre-wrap; overflow-wrap: anywhere; }
  }
  ${katexCss}
`;
}
