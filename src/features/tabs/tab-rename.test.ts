import { describe, expect, it } from "vitest";

import type { AppError } from "@/lib/tauri/errors";

import { buildTargetPath, mapRenameError, splitName, validateStem } from "./tab-rename";

describe("splitName", () => {
  it("splits a normal filename into stem and extension", () => {
    expect(splitName("notes.md")).toEqual({ stem: "notes", ext: ".md" });
  });
  it("splits on the last dot only", () => {
    expect(splitName("a.b.md")).toEqual({ stem: "a.b", ext: ".md" });
  });
  it("preserves non-md extensions", () => {
    expect(splitName("draft.markdown")).toEqual({ stem: "draft", ext: ".markdown" });
    expect(splitName("note.txt")).toEqual({ stem: "note", ext: ".txt" });
  });
  it("treats a name with no extension as all stem", () => {
    expect(splitName("README")).toEqual({ stem: "README", ext: "" });
  });
  it("treats a leading-dot dotfile as all stem", () => {
    expect(splitName(".gitignore")).toEqual({ stem: ".gitignore", ext: "" });
  });
});

describe("validateStem", () => {
  it("accepts a changed, valid stem", () => {
    expect(validateStem("ideas", "notes")).toBeNull();
  });
  it("flags an empty or whitespace-only stem", () => {
    expect(validateStem("", "notes")).toBe("empty");
    expect(validateStem("   ", "notes")).toBe("empty");
  });
  it("flags illegal characters", () => {
    expect(validateStem("a/b", "notes")).toBe("invalidChars");
    expect(validateStem('q?:*"<>|', "notes")).toBe("invalidChars");
  });
  it("reports an unchanged stem (after trimming)", () => {
    expect(validateStem("notes", "notes")).toBe("unchanged");
    expect(validateStem("  notes  ", "notes")).toBe("unchanged");
  });
});

describe("buildTargetPath", () => {
  it("rebuilds the path in the same directory with the original extension (posix)", () => {
    expect(buildTargetPath("/docs/notes.md", "ideas", ".md")).toBe("/docs/ideas.md");
  });
  it("uses a backslash separator for windows-style paths", () => {
    expect(buildTargetPath("C:\\docs\\notes.md", "ideas", ".md")).toBe("C:\\docs\\ideas.md");
  });
  it("trims the stem before building", () => {
    expect(buildTargetPath("/docs/notes.md", "  ideas  ", ".md")).toBe("/docs/ideas.md");
  });
});

describe("mapRenameError", () => {
  const appErr = (kind: AppError["kind"]): AppError => ({ kind, message: "x" });
  it("maps a duplicate target to a keep-open error", () => {
    expect(mapRenameError(appErr("alreadyExists"))).toEqual({
      key: "tabs.rename.exists",
      keepOpen: true,
    });
  });
  it("maps a vanished source to a closing error", () => {
    expect(mapRenameError(appErr("notFound"))).toEqual({
      key: "tabs.rename.notFound",
      keepOpen: false,
    });
  });
  it("maps any other failure to a generic closing error", () => {
    expect(mapRenameError(appErr("io"))).toEqual({ key: "tabs.rename.failed", keepOpen: false });
    expect(mapRenameError(new Error("boom"))).toEqual({
      key: "tabs.rename.failed",
      keepOpen: false,
    });
  });
});
