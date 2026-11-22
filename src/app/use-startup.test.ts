import { afterEach, describe, expect, it } from "vitest";

import i18n from "@/i18n";

import { shouldSeedWelcome, syncDocumentLang } from "./use-startup";

describe("shouldSeedWelcome", () => {
  const firstRun = { openedRequestedFile: false, openDocuments: 0, hasSeenWelcome: false };

  it("seeds the welcome document on an empty first run", () => {
    expect(shouldSeedWelcome(firstRun)).toBe(true);
  });

  it("never seeds it when the launch came from a file", () => {
    // Double-clicking a README must open that README and nothing else.
    expect(shouldSeedWelcome({ ...firstRun, openedRequestedFile: true })).toBe(false);
  });

  it("does not seed it over a restored session or a returning user", () => {
    expect(shouldSeedWelcome({ ...firstRun, openDocuments: 2 })).toBe(false);
    expect(shouldSeedWelcome({ ...firstRun, hasSeenWelcome: true })).toBe(false);
  });
});

describe("syncDocumentLang", () => {
  afterEach(() => {
    void i18n.changeLanguage("en");
    document.documentElement.lang = "en";
  });

  it("reflects the given locale on the document root", () => {
    syncDocumentLang("it");
    expect(document.documentElement.lang).toBe("it");

    syncDocumentLang("en");
    expect(document.documentElement.lang).toBe("en");
  });

  it("keeps the document lang in sync via i18next languageChanged", async () => {
    const handler = (lng: string): void => syncDocumentLang(lng);
    i18n.on("languageChanged", handler);
    try {
      await i18n.changeLanguage("it");
      expect(document.documentElement.lang).toBe("it");

      await i18n.changeLanguage("en");
      expect(document.documentElement.lang).toBe("en");
    } finally {
      i18n.off("languageChanged", handler);
    }
  });
});
