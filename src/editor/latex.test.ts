import katex from "katex";
import { describe, expect, it } from "vitest";

/**
 * Math support is provided by Crepe's built-in Latex feature, which renders with
 * KaTeX (a transitive dependency). These tests guard that KaTeX is installed and
 * renders, so a broken/removed dependency fails fast rather than silently
 * dropping math rendering in the editor.
 */
describe("katex", () => {
  it("renders inline TeX to HTML with the katex class", () => {
    const html = katex.renderToString("E = mc^2", { throwOnError: false });
    expect(html).toContain("katex");
  });

  it("renders display-mode TeX (block math)", () => {
    const html = katex.renderToString("\\int_0^\\infty e^{-x^2}\\,dx", {
      throwOnError: false,
      displayMode: true,
    });
    expect(html).toContain("katex-display");
  });

  it("does not throw on invalid input when throwOnError is false", () => {
    expect(() => katex.renderToString("\\frac{", { throwOnError: false })).not.toThrow();
  });
});
