import DOMPurify from "dompurify";

import i18n from "@/i18n";

/**
 * Mermaid diagram rendering for ```mermaid code blocks, plugged into Crepe's
 * code-block `renderPreview` slot.
 *
 * Mermaid is the single largest dependency in the app, so it is **lazy-loaded**
 * via a dynamic import behind a singleton — nothing is pulled in until the first
 * mermaid block is rendered. Rendering runs with `securityLevel: 'strict'` (the
 * default; it cannot be downgraded by a per-diagram `%%{init}%%` directive) and
 * the returned SVG is run through DOMPurify before injection, which keeps it
 * within our restrictive CSP. Mermaid 11.15 is eval-free, so `script-src 'self'`
 * (no `unsafe-eval`) is sufficient.
 */

type MermaidModule = typeof import("mermaid");

let mermaidPromise: Promise<MermaidModule> | null = null;
let initializedTheme: "neutral" | "dark" | null = null;
let idCounter = 0;

/** Load mermaid once, on first use. */
function loadMermaid(): Promise<MermaidModule> {
  mermaidPromise ??= import("mermaid");
  return mermaidPromise;
}

/**
 * Follow the app's light/dark theme with mermaid's built-in palettes. Light uses
 * `neutral` (greys), not the lavender `default`, so diagrams match the grey `dark`
 * palette and stay off-signal (DESIGN.md §2).
 */
function activeMermaidTheme(): "neutral" | "dark" {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "neutral";
}

/**
 * Name the `img` (WCAG 1.1.1): the diagram's own `accTitle` / `accDescr`, which
 * mermaid emits as the SVG's `<title>` / `<desc>`, else a localized "Diagram".
 */
function nameDiagram(container: HTMLElement): void {
  const svg = container.querySelector("svg");
  const title = svg?.querySelector(":scope > title")?.textContent?.trim();
  const description = svg?.querySelector(":scope > desc")?.textContent?.trim();
  container.setAttribute("aria-label", title || i18n.t("codeBlock.mermaidLabel", { ns: "editor" }));
  if (description) container.setAttribute("aria-description", description);
}

function buildContainer(svg: string): HTMLElement {
  const container = document.createElement("div");
  container.className = "mermaid-preview";
  container.setAttribute("role", "img");
  // SVG is sanitized before it reaches the DOM.
  container.innerHTML = DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
  });
  nameDiagram(container);
  return container;
}

/** A gentle, localized error block (never a raw stack trace). */
function buildError(detail: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "mermaid-error";
  el.textContent = i18n.t("codeBlock.mermaidError", { ns: "editor" });
  if (detail) el.title = detail;
  return el;
}

async function renderDiagram(content: string): Promise<HTMLElement> {
  const { default: mermaid } = await loadMermaid();

  const theme = activeMermaidTheme();
  if (initializedTheme !== theme) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme,
      // Render labels as SVG <text>, not HTML <foreignObject>: keeps the diagram
      // pure SVG so our SVG-only DOMPurify pass preserves the labels (and no HTML
      // is injected into the diagram in the first place).
      htmlLabels: false,
      flowchart: { htmlLabels: false },
    });
    initializedTheme = theme;
  }

  const id = `mermaid-preview-${(idCounter += 1)}`;
  try {
    const { svg } = await mermaid.render(id, content);
    return buildContainer(svg);
  } finally {
    // Mermaid can leave a temporary measuring node behind on failure.
    document.getElementById(id)?.remove();
    document.getElementById(`d${id}`)?.remove();
  }
}

/** Render a mermaid diagram to a sanitized SVG string (for export). Empty on error. */
export async function renderMermaidToSvg(content: string): Promise<string> {
  try {
    const node = await renderDiagram(content);
    return node.innerHTML;
  } catch {
    return "";
  }
}

/**
 * Render a ```mermaid block. Always asynchronous: returns `undefined` — Crepe's
 * async contract, which keeps the previous diagram on screen (and shows the
 * loading text only the first time) — and pushes the rendered (or error) node
 * through `applyPreview` once ready. Returning `null` here would hide the panel
 * on every keystroke and make the layout jump. An empty block returns `null`:
 * there is nothing to preview.
 */
export function renderMermaidPreview(
  content: string,
  applyPreview: (value: null | string | HTMLElement) => void,
): null | undefined {
  if (content.trim().length === 0) return null;

  void renderDiagram(content)
    .then(applyPreview)
    .catch((error: unknown) => {
      applyPreview(buildError(error instanceof Error ? error.message : String(error)));
    });

  return undefined;
}
