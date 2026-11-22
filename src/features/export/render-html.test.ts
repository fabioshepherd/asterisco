import { afterEach, describe, expect, it } from "vitest";

import i18n from "@/i18n";

import { wrapStandaloneHtml } from "./render-html";

describe("wrapStandaloneHtml", () => {
  it("produces a full document with the title, content, css and fonts inlined", () => {
    const doc = wrapStandaloneHtml("<p>Body</p>", "My Note", "body{color:red}", "@font-face{}");
    expect(doc.startsWith("<!doctype html>")).toBe(true);
    expect(doc).toContain("<title>My Note</title>");
    expect(doc).toContain("<p>Body</p>");
    expect(doc).toContain("body{color:red}");
    expect(doc).toContain("@font-face{}");
  });

  it("escapes the title", () => {
    const doc = wrapStandaloneHtml("", "<x>", "");
    expect(doc).toContain("<title>&lt;x&gt;</title>");
  });

  describe("document language", () => {
    afterEach(() => {
      void i18n.changeLanguage("en");
    });

    it("reflects the active locale on the <html> tag", async () => {
      await i18n.changeLanguage("it");
      expect(wrapStandaloneHtml("", "T", "")).toContain('<html lang="it">');

      await i18n.changeLanguage("en");
      expect(wrapStandaloneHtml("", "T", "")).toContain('<html lang="en">');
    });
  });
});
