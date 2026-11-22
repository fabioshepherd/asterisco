import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSettings } from "@/stores/settings";

import { inlineExportFonts } from "./embed-fonts";

const okFetch = () =>
  vi
    .fn()
    .mockResolvedValue({ arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3]).buffer) });

beforeEach(() => {
  useSettings.getState().setEditorFontFamily("serif");
});

afterEach(() => {
  vi.restoreAllMocks();
  useSettings.getState().setEditorFontFamily("serif");
});

describe("inlineExportFonts", () => {
  it("embeds the serif reading font plus the code face as base64 woff2", async () => {
    vi.stubGlobal("fetch", okFetch());
    const css = await inlineExportFonts();
    expect(css).toContain('font-family: "Source Serif 4 Variable"');
    expect(css).toContain('font-family: "Source Code Pro Variable"');
    expect(css).toContain("font-style: italic"); // the reading serif ships a true italic face
    expect(css).toContain("src: url(data:font/woff2;base64,");
  });

  it("embeds latin and latin-ext subsets, each scoped by unicode-range", async () => {
    vi.stubGlobal("fetch", okFetch());
    const css = await inlineExportFonts();
    // Latin (basic) and latin-ext faces both present, distinguished by range.
    expect(css).toContain("unicode-range: U+0000-00FF"); // latin
    expect(css).toContain("unicode-range: U+0100-02BA"); // latin-ext
    // The reading serif ships normal + italic, each in two subsets → 4 faces.
    const serifFaces = css.split('font-family: "Source Serif 4 Variable"').length - 1;
    expect(serifFaces).toBe(4);
  });

  it("embeds the code face once, as latin + latin-ext", async () => {
    vi.stubGlobal("fetch", okFetch());
    const css = await inlineExportFonts();
    const count = css.split('font-family: "Source Code Pro Variable"').length - 1;
    expect(count).toBe(2);
  });

  it("returns empty (no throw) when every fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(inlineExportFonts()).resolves.toBe("");
  });
});
