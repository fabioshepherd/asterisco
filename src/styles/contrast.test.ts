// Node-side test (reads files from disk); the app tsconfig ships no Node types.
/// <reference types="node" />

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, it, expect } from "vitest";

import { ACCENTS, DEFAULT_ACCENT } from "@/features/themes/accents";
import { NEUTRALS } from "@/features/themes/neutrals";

/**
 * Contrast guardrail for the palette layer (DESIGN.md §2).
 *
 * DESIGN.md claims measured numbers rather than inherited ones: Radix guarantees
 * its own text steps against its own surface steps, but says nothing about white
 * on a solid fill or about a focus ring against the page — and both of those fail
 * WCAG AA at the steps Radix documents for them (white on step 9 is 2.97:1 → 3.91:1
 * on all but the two darkest scales; step 8 as a ring is 2.29:1 in light). This
 * test pins the mapping the app actually
 * ships, for every accent × neutral × mode, so a "nicer looking" step can never be
 * swapped in silently.
 *
 * Thresholds: WCAG 2.2 AA — 4.5:1 for normal-size text, 3:1 for non-text (SC 1.4.11).
 */

const AA_TEXT = 4.5;
const AA_NON_TEXT = 3;

const radixDir = resolve(process.cwd(), "node_modules/@radix-ui/colors");
const accentsCss = readFileSync(resolve(process.cwd(), "src/styles/accents.css"), "utf8");
const globalCss = readFileSync(resolve(process.cwd(), "src/styles/global.css"), "utf8");

/** Read one Radix scale as {step: hex}. Only the sRGB block — the P3 `@supports`
 *  block that follows re-declares the same vars in `color(display-p3 …)`. */
function scale(name: string): Record<number, string> {
  const css = readFileSync(resolve(radixDir, `${name}.css`), "utf8").split("@supports")[0] ?? "";
  const out: Record<number, string> = {};
  for (const m of css.matchAll(/--[a-z]+-(\d+):\s*(#[0-9a-f]{6})/g)) {
    out[Number(m[1])] = m[2] as string;
  }
  return out;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (r as number) + 0.7152 * (g as number) + 0.0722 * (b as number);
}

/** WCAG 2.x contrast ratio between two opaque sRGB colours. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const WHITE = "#ffffff";
/** Chromatic accents: "gray" is the monochrome option and follows the live neutral. */
const CHROMATIC = ACCENTS.filter((a) => a !== "gray");

describe("palette contrast", () => {
  describe.each(CHROMATIC)("accent %s", (accent) => {
    const light = scale(accent);
    const dark = scale(`${accent}-dark`);

    it("light: white on the solid fill (step 11) clears AA text", () => {
      expect(contrast(WHITE, light[11] as string)).toBeGreaterThanOrEqual(AA_TEXT);
    });

    describe.each(NEUTRALS)("on the %s neutral", (neutral) => {
      const nLight = scale(neutral);
      const nDark = scale(`${neutral}-dark`);

      it("dark: the page ink on the solid fill clears AA text", () => {
        // --primary-fg resolves to var(--bg) in dark mode (global.css).
        expect(contrast(nDark[1] as string, dark[11] as string)).toBeGreaterThanOrEqual(AA_TEXT);
      });

      it("the focus ring (step 11) clears the 3:1 non-text floor in both modes", () => {
        expect(contrast(light[11] as string, nLight[1] as string)).toBeGreaterThanOrEqual(
          AA_NON_TEXT,
        );
        expect(contrast(dark[11] as string, nDark[1] as string)).toBeGreaterThanOrEqual(
          AA_NON_TEXT,
        );
      });
    });
  });

  it("step 9 as a text fill fails AA on most of the set — why step 11 is the rule", () => {
    // Radix's step 9 is the "solid" step, and it is safe under white text only on
    // the darkest scales (indigo, plum). Anywhere else — including the default
    // accent — it lands between 2.97:1 and 3.91:1. One uniform rule beats a
    // per-scale exception list, so the app never fills with step 9.
    const failing = CHROMATIC.filter((a) => contrast(WHITE, scale(a)[9] as string) < AA_TEXT);
    expect(failing).toContain(DEFAULT_ACCENT);
    expect(failing.length).toBeGreaterThan(CHROMATIC.length / 2);
  });

  describe("step 9 ≥ 3:1 vs steps 1–2 (non-text, SC 1.4.11)", () => {
    // State indicators (unsaved dot, selected-tab underline, success icon, drop
    // bar) sit on the page (step 1) or a raised surface (step 2). Step 9 is the
    // signal step, but in light mode it falls short of 3:1 on several accents —
    // the default among them — so those indicators draw in --primary (step 11).
    const combos = CHROMATIC.flatMap((accent) =>
      NEUTRALS.flatMap((neutral) =>
        (["light", "dark"] as const).map((mode) => {
          const suffix = mode === "dark" ? "-dark" : "";
          const a = scale(`${accent}${suffix}`);
          const n = scale(`${neutral}${suffix}`);
          const worst = (step: number) =>
            Math.min(contrast(a[step] as string, n[1] as string), contrast(a[step] as string, n[2] as string)); // prettier-ignore
          return { accent, neutral, mode, step9: worst(9), step11: worst(11) };
        }),
      ),
    );

    it.each(combos)("$accent on $neutral, $mode: step 9 clears 3:1, or the indicators use step 11", (c) => {
      if (c.step9 >= AA_NON_TEXT) return;
      expect(c.mode).toBe("light");
      expect(c.step11).toBeGreaterThanOrEqual(AA_NON_TEXT);
    }); // prettier-ignore

    it("step 9 falls short somewhere, the default accent included — why indicators use step 11", () => {
      const failing = combos.filter((c) => c.step9 < AA_NON_TEXT);
      expect(failing.map((c) => c.accent)).toContain(DEFAULT_ACCENT);
    });

    it("the monochrome accent (neutral step 11) clears 3:1 on steps 1–2 in both modes", () => {
      for (const neutral of NEUTRALS) {
        for (const ramp of [scale(neutral), scale(`${neutral}-dark`)]) {
          for (const surface of [1, 2]) {
            expect(contrast(ramp[11] as string, ramp[surface] as string)).toBeGreaterThanOrEqual(AA_NON_TEXT); // prettier-ignore
          }
        }
      }
    });

    it("state indicators are drawn in --primary, never step 9", () => {
      const sources = [
        "src/features/tabs/TabBar.tsx",
        "src/features/tabs/TabDndContext.tsx",
        "src/features/status-bar/StatusBar.tsx",
        "src/features/notifications/Toaster.tsx",
      ].map((path) => readFileSync(resolve(process.cwd(), path), "utf8"));
      for (const source of sources) {
        expect(source).not.toMatch(/\b(bg|text|border)-accent\b/);
      }
    });
  });

  describe.each(NEUTRALS)("neutral %s", (neutral) => {
    const light = scale(neutral);
    const dark = scale(`${neutral}-dark`);

    it("ink and secondary ink clear AA text on both the page and raised surfaces", () => {
      for (const [surface, ramp] of [
        [1, light],
        [2, light],
        [1, dark],
        [2, dark],
      ] as const) {
        expect(contrast(ramp[12] as string, ramp[surface] as string)).toBeGreaterThanOrEqual(
          AA_TEXT,
        );
        expect(contrast(ramp[11] as string, ramp[surface] as string)).toBeGreaterThanOrEqual(
          AA_TEXT,
        );
      }
    });

    it("the selected-option hairline (--muted-fg, step 11) clears 3:1 on the page, surface and chip", () => {
      // RadioGroup's non-colour selected cue (SC 1.4.1 / 1.4.11); the chip is step 3.
      for (const ramp of [light, dark]) {
        for (const surface of [1, 2, 3]) {
          expect(contrast(ramp[11] as string, ramp[surface] as string)).toBeGreaterThanOrEqual(AA_NON_TEXT); // prettier-ignore
        }
      }
      expect(globalCss + readFileSync(resolve(process.cwd(), "src/styles/neutrals.css"), "utf8")).toMatch(/--muted-fg:\s*var\(--[a-z]+-11\)/); // prettier-ignore
    });

    it("monochrome accent (step 11) works as fill and ring in both modes", () => {
      expect(contrast(WHITE, light[11] as string)).toBeGreaterThanOrEqual(AA_TEXT);
      expect(contrast(dark[1] as string, dark[11] as string)).toBeGreaterThanOrEqual(AA_TEXT);
    });
  });

  describe("danger", () => {
    const light = scale("red");
    const dark = scale("red-dark");

    it("the solid fill (red-11) carries text at AA in both modes", () => {
      expect(contrast(WHITE, light[11] as string)).toBeGreaterThanOrEqual(AA_TEXT);
      for (const neutral of NEUTRALS) {
        expect(contrast(scale(`${neutral}-dark`)[1] as string, dark[11] as string)).toBeGreaterThanOrEqual(AA_TEXT); // prettier-ignore
      }
    });

    it("error copy (red-11) clears AA on every neutral page", () => {
      for (const neutral of NEUTRALS) {
        expect(contrast(light[11] as string, scale(neutral)[1] as string)).toBeGreaterThanOrEqual(AA_TEXT); // prettier-ignore
        expect(contrast(dark[11] as string, scale(`${neutral}-dark`)[1] as string)).toBeGreaterThanOrEqual(AA_TEXT); // prettier-ignore
      }
    });
  });

  describe("code syntax (src/editor/code-theme.ts)", () => {
    // Every `--syntax-*` role as global.css binds it: `[token, scale, step]`.
    const syntax = [...globalCss.matchAll(/--(syntax-[a-z]+):\s*var\(--([a-z]+)-(\d+)\)/g)].map(
      (m) => [m[1] as string, m[2] as string, Number(m[3])] as const,
    );

    it("binds every syntax role to a step-11 text step", () => {
      expect(syntax.map(([token]) => token).sort()).toEqual([
        "syntax-keyword",
        "syntax-literal",
        "syntax-string",
        "syntax-type",
      ]);
      expect(syntax.filter(([, , step]) => step !== 11)).toEqual([]);
    });

    describe.each(NEUTRALS)("on the %s neutral", (neutral) => {
      const nLight = scale(neutral);
      const nDark = scale(`${neutral}-dark`);

      it.each(syntax)("%s clears AA text on the page and raised surface, both modes", (_, name) => {
        for (const surface of [1, 2]) {
          expect(contrast(scale(name)[11] as string, nLight[surface] as string)).toBeGreaterThanOrEqual(AA_TEXT); // prettier-ignore
          expect(contrast(scale(`${name}-dark`)[11] as string, nDark[surface] as string)).toBeGreaterThanOrEqual(AA_TEXT); // prettier-ignore
        }
      });
    });
  });

  describe("the mapping the CSS actually ships", () => {
    it("never binds --primary or --ring to a step below 11", () => {
      const offenders = [
        ...accentsCss.matchAll(/--(primary|ring):\s*var\(--[a-z]+-(\d+)\)/g),
      ].filter((m) => Number(m[2]) < 11);
      expect(offenders.map((m) => m[0])).toEqual([]);
    });

    it("binds --accent to step 9 — the signal, never a text background", () => {
      const bindings = [...accentsCss.matchAll(/--accent:\s*var\(--[a-z]+-(\d+)\)/g)].map((m) =>
        Number(m[1]),
      );
      expect(bindings.length).toBeGreaterThan(0);
      expect(new Set(bindings)).toEqual(new Set([9]));
    });

    it("covers every accent in the registry", () => {
      for (const accent of CHROMATIC) {
        expect(accentsCss).toMatch(new RegExp(`--primary:\\s*var\\(--${accent}-11\\)`));
      }
    });
  });
});
