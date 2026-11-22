import { describe, expect, it } from "vitest";

import { sanitizeThemeCss } from "./apply-theme";

describe("sanitizeThemeCss", () => {
  it("strips @import rules", () => {
    expect(sanitizeThemeCss('@import url("evil.css"); :root{--bg:red}')).not.toContain("@import");
  });

  it("neutralizes remote url() references", () => {
    const out = sanitizeThemeCss(":root{background:url(https://evil.example/x.png)}");
    expect(out).not.toContain("https://");
    expect(out).toContain("none");
  });

  it("keeps local custom properties intact", () => {
    expect(sanitizeThemeCss(":root{--bg:#fff;--fg:#000}")).toBe(":root{--bg:#fff;--fg:#000}");
  });
});
