import { describe, expect, it } from "vitest";

import type { DirEntry } from "@/lib/tauri/fs";

import { filterDocuments, isMarkdownFile, MARKDOWN_EXTENSIONS, visibleEntries } from "./tree-utils";

function entry(name: string, isDir: boolean, ignored = false): DirEntry {
  return { name, path: `/root/${name}`, isDir, ignored };
}

describe("isMarkdownFile", () => {
  it("matches every document extension, case-insensitively", () => {
    expect(isMarkdownFile("notes.md")).toBe(true);
    expect(isMarkdownFile("README.MARKDOWN")).toBe(true);
    expect(isMarkdownFile("post.mdx")).toBe(true);
    // In PRODUCT.md's scope, and the open dialog already accepted it.
    expect(isMarkdownFile("THIRD-PARTY-NOTICES.txt")).toBe(true);
    expect(isMarkdownFile("image.png")).toBe(false);
    expect(isMarkdownFile("README")).toBe(false);
  });

  it("covers exactly the shared extension list", () => {
    expect(MARKDOWN_EXTENSIONS).toEqual(["md", "markdown", "mdx", "txt"]);
    for (const ext of MARKDOWN_EXTENSIONS) {
      expect(isMarkdownFile(`file.${ext}`)).toBe(true);
    }
  });
});

describe("visibleEntries", () => {
  it("keeps folders and documents, drops everything else", () => {
    const result = visibleEntries([
      entry("image.png", false),
      entry("notes.md", false),
      entry("src", true),
    ]);

    expect(result.map((e) => e.name)).toEqual(["src", "notes.md"]);
  });

  it("sorts directories first, then alphabetically", () => {
    const result = visibleEntries([
      entry("b.md", false),
      entry("zeta", true),
      entry("a.md", false),
      entry("alpha", true),
    ]);

    expect(result.map((e) => e.name)).toEqual(["alpha", "zeta", "a.md", "b.md"]);
  });

  it("keeps dot-folders and drops the ones Rust flagged as ignored", () => {
    // `.github`, `.claude` and `.cursor` are where this audience keeps the files
    // the product exists for; `node_modules` is flagged by src-tauri/src/fs_policy.rs.
    const result = visibleEntries([
      entry(".github", true),
      entry("node_modules", true, true),
      entry(".note.md", false),
      entry(".gitignore", false),
      entry("notes.md", false),
    ]);

    // .gitignore is neither a folder nor a document -> still filtered out.
    expect(result.map((e) => e.name)).toEqual([".github", ".note.md", "notes.md"]);
  });

  it("shows ignored folders when the setting is on", () => {
    const result = visibleEntries(
      [entry("node_modules", true, true), entry("notes.md", false)],
      true,
    );
    expect(result.map((e) => e.name)).toEqual(["node_modules", "notes.md"]);
  });
});

describe("filterDocuments", () => {
  const docs = [
    { name: "README.md", path: "/root/README.md" },
    { name: "docs/readme-assets/notes.md", path: "/root/docs/readme-assets/notes.md" },
    { name: "docs/guide.md", path: "/root/docs/guide.md" },
  ];

  it("matches on the whole relative path, case-insensitively", () => {
    expect(filterDocuments(docs, "DOCS/").rows.map((f) => f.name)).toEqual([
      "docs/readme-assets/notes.md",
      "docs/guide.md",
    ]);
  });

  it("puts name hits before path-only hits", () => {
    // Someone typing "readme" wants the README, not a file that happens to sit
    // in a folder called readme-assets.
    expect(filterDocuments(docs, "readme").rows.map((f) => f.name)).toEqual([
      "README.md",
      "docs/readme-assets/notes.md",
    ]);
  });

  it("reports what the render cap left out instead of just showing fewer rows", () => {
    const many = Array.from({ length: 5 }, (_, i) => ({
      name: `note-${i}.md`,
      path: `/root/note-${i}.md`,
    }));

    const capped = filterDocuments(many, "note", 2);
    expect(capped.rows).toHaveLength(2);
    expect(capped.total).toBe(5);
    expect(capped.capped).toBe(true);

    const whole = filterDocuments(many, "note", 5);
    expect(whole.capped).toBe(false);
  });

  it("returns everything for an empty query", () => {
    expect(filterDocuments(docs, "   ").total).toBe(3);
  });
});
