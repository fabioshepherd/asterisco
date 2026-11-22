import { describe, expect, it } from "vitest";

import { welcomeDocument } from "./welcome-doc";

describe("welcomeDocument", () => {
  it("returns localized content per language", () => {
    expect(welcomeDocument("en")).toContain("# Asterisco");
    expect(welcomeDocument("it")).toContain("# Asterisco");
    expect(welcomeDocument("en")).toContain("A local-first editor");
    expect(welcomeDocument("it")).toContain("Un editor local-first");
  });

  it("demonstrates the Markdown a codebase is made of, in both languages", () => {
    for (const language of ["en", "it"] as const) {
      const doc = welcomeDocument(language);
      // A fenced block with a language tag (syntax highlighting).
      expect(doc).toMatch(/```ts[\s\S]*```/);
      // A GFM table (header + delimiter row).
      expect(doc).toMatch(/\|[^\n]*\|\n\|\s*---/);
      // Inline code survives the template literal un-escaped.
      expect(doc).toContain("`Cmd/Ctrl + Shift + P`");
    }
  });

  it("demonstrates a mermaid diagram in both languages", () => {
    for (const language of ["en", "it"] as const) {
      expect(welcomeDocument(language)).toMatch(/```mermaid[\s\S]*flowchart[\s\S]*```/);
    }
  });

  it("cites only shortcuts the app actually binds", () => {
    // Guards against the doc drifting from menu-model.ts / keybindings.ts.
    for (const language of ["en", "it"] as const) {
      const doc = welcomeDocument(language);
      for (const combo of [
        "Cmd/Ctrl + Shift + P",
        "Cmd/Ctrl + O",
        "Cmd/Ctrl + F",
        "Cmd/Ctrl + S",
      ]) {
        expect(doc).toContain(combo);
      }
    }
  });
});
