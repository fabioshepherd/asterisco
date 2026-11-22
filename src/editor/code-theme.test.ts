import { describe, expect, it } from "vitest";

import { tokenHighlightStyle } from "./code-theme";

/**
 * Every colour the shared highlight style paints must be a token whose contrast is
 * pinned by `src/styles/contrast.test.ts` (≥ 4.5:1 on the page and raised surface,
 * every neutral, both modes): the `--syntax-*` roles, the neutral inks and error copy.
 * A hex or an unmeasured token here would bypass that guarantee.
 */
const MEASURED_TEXT_TOKENS = new Set([
  "var(--syntax-keyword)",
  "var(--syntax-string)",
  "var(--syntax-literal)",
  "var(--syntax-type)",
  "var(--fg)",
  "var(--muted-fg)",
  "var(--danger-text)",
]);

describe("tokenHighlightStyle", () => {
  const rules = tokenHighlightStyle.module?.getRules() ?? "";

  it("paints colours only with measured text tokens", () => {
    const colors = [...rules.matchAll(/(?<![-\w])color:\s*([^;}]+)/g)].map((m) =>
      (m[1] as string).trim(),
    );
    expect(colors.length).toBeGreaterThan(0);
    expect(colors.filter((color) => !MEASURED_TEXT_TOKENS.has(color))).toEqual([]);
  });

  it("sets no background behind code text", () => {
    expect(rules).not.toMatch(/background/);
  });
});
