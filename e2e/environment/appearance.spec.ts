import type { Page } from "@playwright/test";

import { expect, test } from "../support/fixtures";

/*
 * The OS appearance settings the app must honour (WCAG 2.2 AA): the colour
 * scheme, when the theme preference is "system" (the default), and reduced
 * motion. Both are emulated by Playwright as CSS media features.
 */

/** Relative luminance (WCAG) of the page background, read back from a canvas. */
function backgroundLuminance(page: Page): Promise<number> {
  return page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("no 2d context");
    context.fillStyle = getComputedStyle(document.body).backgroundColor;
    context.fillRect(0, 0, 1, 1);
    const [r = 0, g = 0, b = 0] = context.getImageData(0, 0, 1, 1).data;
    const linear = (c: number) => {
      const s = c / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  });
}

/** The longest transition or animation declared anywhere in the page, in seconds. */
function longestMotion(page: Page): Promise<number> {
  return page.evaluate(() => {
    let longest = 0;
    for (const el of document.querySelectorAll("*")) {
      const style = getComputedStyle(el);
      for (const value of [style.transitionDuration, style.animationDuration]) {
        for (const part of value.split(",")) longest = Math.max(longest, parseFloat(part) || 0);
      }
    }
    return longest;
  });
}

test.describe("dark colour scheme", () => {
  test.use({ colorScheme: "dark" });

  test("follows the OS into the dark theme", async ({ app }) => {
    const { page } = app;
    await app.launch({ open: ["notes.md"] });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    expect(await backgroundLuminance(page)).toBeLessThan(0.1);
  });
});

test.describe("light colour scheme", () => {
  test.use({ colorScheme: "light" });

  test("follows the OS into the light theme", async ({ app }) => {
    const { page } = app;
    await app.launch({ open: ["notes.md"] });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    expect(await backgroundLuminance(page)).toBeGreaterThan(0.8);
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("no transition or animation outlasts 0.01 ms", async ({ app }) => {
    const { page } = app;
    await app.launch({ open: ["notes.md"] });
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(
      true,
    );
    // Open an animated surface too.
    await page.keyboard.press("ControlOrMeta+Shift+P");
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await longestMotion(page)).toBeLessThanOrEqual(0.00001);
  });
});

test.describe("motion allowed", () => {
  test.use({ reducedMotion: "no-preference" });

  // Guards the check above: without the preference the page does animate, so a
  // reduced-motion pass is not just a page with no motion at all.
  test("the same page declares motion", async ({ app }) => {
    const { page } = app;
    await app.launch({ open: ["notes.md"] });
    await page.keyboard.press("ControlOrMeta+Shift+P");
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await longestMotion(page)).toBeGreaterThan(0.00001);
  });
});
