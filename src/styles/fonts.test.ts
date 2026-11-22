// Node-side test (reads files from disk); the app tsconfig ships no Node types.
/// <reference types="node" />

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, it, expect } from "vitest";

const stylesDir = resolve(process.cwd(), "src/styles");
const fontsCss = readFileSync(resolve(stylesDir, "fonts.css"), "utf8");
const globalCss = readFileSync(resolve(stylesDir, "global.css"), "utf8");

describe("self-hosted typography", () => {
  it("declares the three cuts of the one superfamily", () => {
    expect(fontsCss).toContain('font-family: "Source Serif 4 Variable"');
    expect(fontsCss).toContain('font-family: "Source Sans 3 Variable"');
    expect(fontsCss).toContain('font-family: "Source Code Pro Variable"');
  });

  it("includes the latin AND latin-ext subsets", () => {
    // The reading serif ships the `standard` cut (wght + opsz); chrome and code
    // ship the wght-only cut.
    expect(fontsCss).toContain("source-serif-4-latin-standard-normal.woff2");
    expect(fontsCss).toContain("source-serif-4-latin-ext-standard-normal.woff2");
    for (const face of ["source-sans-3", "source-code-pro"]) {
      expect(fontsCss).toContain(`${face}-latin-wght-normal.woff2`);
      expect(fontsCss).toContain(`${face}-latin-ext-wght-normal.woff2`);
    }
  });

  it("bundles the reading serif's TRUE italic (not synthesised)", () => {
    expect(fontsCss).toContain("source-serif-4-latin-standard-italic.woff2");
    expect(fontsCss).toContain("font-style: italic");
  });

  it("keeps the optical-size axis on the reading face", () => {
    // `standard` is the fontsource cut that carries opsz alongside wght; the
    // `wght` cut would silently drop optical sizing (DESIGN.md §3).
    expect(fontsCss).not.toContain("source-serif-4-latin-wght-normal.woff2");
  });

  it("loads every face from the local bundle — no CDN / network origin", () => {
    expect(fontsCss).not.toMatch(/https?:\/\//);
    expect(fontsCss).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
    // Every src must point at a bundled @fontsource-variable woff2.
    const srcUrls = [...fontsCss.matchAll(/src:\s*url\(([^)]+)\)/g)].map((m) => m[1]);
    expect(srcUrls.length).toBeGreaterThan(0);
    for (const url of srcUrls) {
      expect(url).toContain("@fontsource-variable/");
      expect(url).toMatch(/\.woff2$/);
    }
  });

  it("maps the semantic font tokens onto the three cuts", () => {
    expect(globalCss).toMatch(/--font-sans:\s*"Source Sans 3 Variable"/);
    expect(globalCss).toMatch(/--font-serif:\s*"Source Serif 4 Variable"/);
    expect(globalCss).toMatch(/--font-mono:\s*"Source Code Pro Variable"/);
  });

  it("leaves no trace of the previous families", () => {
    for (const css of [fontsCss, globalCss]) {
      expect(css).not.toMatch(/Geist|Lora|JetBrains|IBM Plex/i);
    }
  });
});
