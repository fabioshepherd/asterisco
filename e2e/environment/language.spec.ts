import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "../support/fixtures";

/*
 * Both UI languages: the document language follows the setting, the chrome is
 * drawn from that language's catalogue, and no raw i18n key reaches the screen
 * (i18next renders the key itself when a translation is missing).
 */

const LOCALES = path.join(import.meta.dirname, "..", "..", "src/i18n/locales");
const NAMESPACES = ["common", "editor", "menu"] as const;

type Catalogue = { [key: string]: string | Catalogue };

function catalogue(language: string, namespace: string): Catalogue {
  return JSON.parse(
    readFileSync(path.join(LOCALES, language, `${namespace}.json`), "utf8"),
  ) as Catalogue;
}

/** Every dotted key path in a catalogue (`modes.reading`, …). */
function keyPaths(node: Catalogue, prefix = ""): string[] {
  return Object.entries(node).flatMap(([key, value]) => {
    const full = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? [full] : keyPaths(value, full);
  });
}

function label(language: string, namespace: string, key: string): string {
  const value = key
    .split(".")
    .reduce<string | Catalogue | undefined>(
      (node, part) => (typeof node === "object" ? node[part] : undefined),
      catalogue(language, namespace),
    );
  if (typeof value !== "string")
    throw new Error(`missing i18n key ${language}/${namespace}/${key}`);
  return value;
}

/** The keys of every namespace, bare and namespaced (`editor:modes.reading`). */
const KEYS = new Set(
  NAMESPACES.flatMap((namespace) =>
    keyPaths(catalogue("en", namespace)).flatMap((key) => [key, `${namespace}:${key}`]),
  ),
);

for (const language of ["en", "it"] as const) {
  test(`UI in ${language}`, async ({ app }) => {
    const { page } = app;
    await app.launch({ open: ["notes.md"], language });

    await expect(page.locator("html")).toHaveAttribute("lang", language);
    const views = page.getByRole("radiogroup", {
      name: label(language, "editor", "modes.viewGroup"),
    });
    for (const mode of ["edit", "source", "reading"]) {
      await expect(
        views.getByRole("radio", { name: label(language, "editor", `modes.${mode}`) }),
      ).toBeVisible();
    }

    // Open a second surface so more of the chrome is on screen.
    await page.keyboard.press("ControlOrMeta+Shift+P");
    await expect(page.getByRole("dialog")).toBeVisible();

    const shown = await page.evaluate(() => {
      const texts = document.body.innerText.split("\n").map((line) => line.trim());
      for (const el of document.querySelectorAll("[aria-label], [title], [placeholder]")) {
        for (const name of ["aria-label", "title", "placeholder"]) {
          const value = el.getAttribute(name);
          if (value) texts.push(value.trim());
        }
      }
      return texts.filter(Boolean);
    });
    expect(
      shown.filter((text) => KEYS.has(text)),
      "raw i18n keys on screen",
    ).toEqual([]);
  });
}
