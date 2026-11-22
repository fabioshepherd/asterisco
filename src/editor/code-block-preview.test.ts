import { describe, expect, it, vi } from "vitest";

import { isMermaidLanguage, renderCodeBlockPreview } from "./code-block-preview";
import { renderMermaidPreview } from "./mermaid";

describe("isMermaidLanguage", () => {
  it("matches the mermaid language case- and whitespace-insensitively", () => {
    expect(isMermaidLanguage("mermaid")).toBe(true);
    expect(isMermaidLanguage("Mermaid")).toBe(true);
    expect(isMermaidLanguage("  MERMAID ")).toBe(true);
  });

  it("does not match other languages", () => {
    expect(isMermaidLanguage("ts")).toBe(false);
    expect(isMermaidLanguage("latex")).toBe(false);
    expect(isMermaidLanguage("")).toBe(false);
  });
});

describe("renderMermaidPreview", () => {
  it("returns null and skips rendering for empty content", () => {
    const applyPreview = vi.fn();
    expect(renderMermaidPreview("   ", applyPreview)).toBeNull();
    expect(applyPreview).not.toHaveBeenCalled();
  });

  it("returns undefined (async: keep the previous diagram) and defers to applyPreview", () => {
    const applyPreview = vi.fn();
    // The async render path is verified end-to-end under the production CSP
    // (Playwright); here we only assert the synchronous contract. `null` would
    // make Crepe hide the panel on every keystroke.
    expect(renderMermaidPreview("flowchart LR\n A --> B", applyPreview)).toBeUndefined();
  });
});

describe("renderCodeBlockPreview", () => {
  it("gives a plain code fence no preview, so Crepe hides the panel", () => {
    const applyPreview = vi.fn();
    expect(renderCodeBlockPreview("ts", "const x = 1;", applyPreview)).toBeNull();
    expect(renderCodeBlockPreview("", "plain", applyPreview)).toBeNull();
    expect(applyPreview).not.toHaveBeenCalled();
  });

  it("still routes mermaid fences to the diagram renderer", () => {
    const applyPreview = vi.fn();
    // Mermaid is genuinely async: it returns undefined and defers to the callback.
    expect(
      renderCodeBlockPreview("mermaid", "flowchart LR\n A --> B", applyPreview),
    ).toBeUndefined();
  });
});
