import { gray, orange } from "@radix-ui/colors";
import { afterEach, describe, expect, it } from "vitest";

import {
  buildExportCss,
  FALLBACK_LIGHT,
  snapshotExportTheme,
  type ExportTheme,
} from "./theme-snapshot";

const root = document.documentElement;

afterEach(() => {
  root.classList.remove("dark");
  delete root.dataset.neutral;
  delete root.dataset.accent;
  for (const name of [
    "--bg",
    "--fg",
    "--accent",
    "--orange-11",
    "--blue-11",
    "--muted",
    "--surface",
    "--border",
    "--muted-fg",
    "--editor-font-default",
    "--font-mono",
  ]) {
    root.style.removeProperty(name);
  }
});

describe("snapshotExportTheme", () => {
  it("reads inline-set tokens off the root", () => {
    root.style.setProperty("--bg", "#101014");
    root.style.setProperty("--fg", "#fafafa");
    root.style.setProperty("--accent", "#22c55e");
    const theme = snapshotExportTheme("active");
    expect(theme.bg).toBe("#101014");
    expect(theme.fg).toBe("#fafafa");
    expect(theme.accent).toBe("#22c55e");
  });

  it("falls back to light defaults when a token is unset", () => {
    const theme = snapshotExportTheme("active");
    expect(theme.bg).toBe(FALLBACK_LIGHT.bg);
    expect(theme.fg).toBe(FALLBACK_LIGHT.fg);
  });

  it("falls back to the app default palette, Gray + Orange, at THEMING's steps", () => {
    expect(FALLBACK_LIGHT).toMatchObject({
      bg: gray.gray1,
      surface: gray.gray2,
      muted: gray.gray3,
      border: gray.gray6,
      mutedFg: gray.gray11,
      fg: gray.gray12,
      accent: orange.orange9,
      linkColor: orange.orange11,
    });
  });

  it("active target mirrors the live .dark class in colorScheme", () => {
    root.classList.add("dark");
    expect(snapshotExportTheme("active").colorScheme).toBe("dark");
  });

  it("light target reports light even when the app is dark", () => {
    root.classList.add("dark");
    expect(snapshotExportTheme("light").colorScheme).toBe("light");
  });

  it("restores the original .dark class after a light snapshot from dark", () => {
    root.classList.add("dark");
    snapshotExportTheme("light");
    expect(root.classList.contains("dark")).toBe(true);
  });

  it("leaves the class untouched for an active snapshot", () => {
    snapshotExportTheme("active");
    expect(root.classList.contains("dark")).toBe(false);
  });

  // jsdom does not load the app stylesheets or resolve nested var(), so we set
  // the already-resolved value here. Real var() resolution (--editor-font-default
  // → var(--font-serif) → "Source Serif 4 Variable", …) is the browser's job and
  // is exercised in the live app, not assertable in jsdom.
  it("prefers the editor reading font, falling back to font-mono for code", () => {
    root.style.setProperty("--editor-font-default", '"Source Serif 4 Variable", serif');
    root.style.setProperty("--font-mono", '"Source Code Pro Variable", monospace');
    const theme = snapshotExportTheme("active");
    expect(theme.bodyFont).toContain("Source Serif 4 Variable");
    expect(theme.codeFont).toContain("Source Code Pro Variable");
  });

  // The neutral base is a selectable axis (data-neutral) that re-points
  // --bg/--fg/--muted/… to the chosen Radix gray scale. jsdom can't resolve the
  // var() chain from neutrals.css, so we stand in the already-resolved values a
  // non-sand neutral would yield and assert the snapshot reads THOSE — proving the
  // export follows the active neutral and never hard-pins the sand fallback.
  it("reads the active neutral's resolved tokens, not the sand fallback", () => {
    // Slate-flavoured values, distinct from both the sand look and the fallbacks.
    root.dataset.neutral = "slate";
    root.style.setProperty("--bg", "#fcfcfd");
    root.style.setProperty("--fg", "#11181c");
    root.style.setProperty("--muted", "#f1f3f5");
    root.style.setProperty("--border", "#d7dbdf");
    const theme = snapshotExportTheme("active");
    expect(theme.bg).toBe("#fcfcfd");
    expect(theme.fg).toBe("#11181c");
    expect(theme.muted).toBe("#f1f3f5");
    expect(theme.border).toBe("#d7dbdf");
    // Guard against a tautology: these must NOT be the hard-coded sand fallbacks.
    expect(theme.bg).not.toBe(FALLBACK_LIGHT.bg);
    expect(theme.fg).not.toBe(FALLBACK_LIGHT.fg);
  });

  it("reads the active accent's accessible -11 step for link text", () => {
    root.dataset.accent = "blue";
    root.style.setProperty("--accent", "#0090ff"); // blue-9 (solid fill, too light for text)
    root.style.setProperty("--blue-11", "#0d74ce"); // blue-11 (accessible text step)
    expect(snapshotExportTheme("active").linkColor).toBe("#0d74ce");
  });

  it("follows the live neutral's ink for link text under the monochrome accent", () => {
    // The monochrome accent is not pinned to one gray scale: it rides whichever
    // neutral is active, so the export must read the neutral's own secondary ink.
    root.dataset.accent = "gray";
    root.style.setProperty("--accent", "#646464");
    root.style.setProperty("--muted-fg", "#646464");
    expect(snapshotExportTheme("active").linkColor).toBe("#646464");
  });

  it("falls back to the accent when the -11 step is unavailable", () => {
    root.style.setProperty("--accent", "#22c55e");
    // No --orange-11 set (default accent) → link colour falls back to the accent.
    expect(snapshotExportTheme("active").linkColor).toBe("#22c55e");
  });

  it("rejects a token value carrying CSS-structure characters and falls back", () => {
    // A user-loaded custom CSS theme could poison a semantic token; the snapshot
    // must not carry an injection into the exported <style>.
    root.style.setProperty("--accent", "red; } body { display: none");
    expect(snapshotExportTheme("active").accent).toBe(FALLBACK_LIGHT.accent);
  });
});

describe("buildExportCss", () => {
  const theme: ExportTheme = {
    bg: "#101014",
    fg: "#fafafa",
    accent: "#22c55e",
    linkColor: "#3dd68c",
    muted: "#26262b",
    surface: "#1c1c20",
    border: "#3a3a40",
    mutedFg: "#a1a1aa",
    bodyFont: '"Source Serif 4 Variable", serif',
    codeFont: '"Source Code Pro Variable", monospace',
    colorScheme: "dark",
  };

  it("injects the snapshot tokens", () => {
    const css = buildExportCss(theme);
    expect(css).toContain("background: #101014");
    expect(css).toContain("color: #fafafa");
    expect(css).toContain("a { color: #3dd68c");
    expect(css).toContain("text-decoration: underline");
    expect(css).toContain("color-scheme: dark");
    expect(css).toContain('"Source Serif 4 Variable"');
  });

  it("still includes the KaTeX stylesheet", () => {
    expect(buildExportCss(theme)).toContain(".katex");
  });

  it("wraps code blocks in print so long lines don't clip off the page", () => {
    const css = buildExportCss(theme);
    expect(css).toContain("@media print");
    expect(css).toContain("white-space: pre-wrap");
  });
});
