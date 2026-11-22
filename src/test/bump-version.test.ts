import { describe, expect, it } from "vitest";

import {
  isValidSemver,
  releaseChangelog,
  setCargoVersion,
  setJsonVersion,
} from "../../scripts/bump-version.mjs";

describe("isValidSemver", () => {
  it("accepts plain and pre-release versions", () => {
    expect(isValidSemver("1.0.0")).toBe(true);
    expect(isValidSemver("0.1.0")).toBe(true);
    expect(isValidSemver("1.2.3-rc.1")).toBe(true);
    expect(isValidSemver("10.20.30-beta.2")).toBe(true);
  });

  it("rejects malformed versions", () => {
    expect(isValidSemver("1.0")).toBe(false);
    expect(isValidSemver("v1.0.0")).toBe(false);
    expect(isValidSemver("1.0.0.0")).toBe(false);
    expect(isValidSemver("1.0.x")).toBe(false);
    expect(isValidSemver("")).toBe(false);
  });
});

describe("setJsonVersion", () => {
  it("sets the top-level version with 2-space indent and a trailing newline (package.json shape)", () => {
    const input = `{\n  "name": "project-asterisco",\n  "version": "0.1.0"\n}\n`;
    const out = setJsonVersion(input, "1.0.0");
    const data = JSON.parse(out) as { version: string };
    expect(data.version).toBe("1.0.0");
    expect(out.endsWith("\n")).toBe(true);
    expect(out).toContain('  "version": "1.0.0"');
  });

  it("sets the top-level version for a tauri.conf.json shape", () => {
    const input = `{\n  "$schema": "../schema.json",\n  "productName": "asterisco",\n  "version": "0.1.0"\n}\n`;
    const data = JSON.parse(setJsonVersion(input, "2.3.4")) as { version: string };
    expect(data.version).toBe("2.3.4");
  });

  it("only changes the version, leaving other keys intact", () => {
    const input = `{\n  "name": "project-asterisco",\n  "version": "0.1.0",\n  "private": true\n}\n`;
    const data = JSON.parse(setJsonVersion(input, "2.3.4")) as {
      name: string;
      private: boolean;
      version: string;
    };
    expect(data.name).toBe("project-asterisco");
    expect(data.private).toBe(true);
    expect(data.version).toBe("2.3.4");
  });

  it("preserves surrounding formatting, leaving inline arrays byte-for-byte unchanged", () => {
    // Regression guard for tauri.conf.json: a full JSON round-trip would explode
    // this inline array onto one element per line. Only the version line may change.
    const inlineArrayLine = `  "csp": ["a", "b", "c"]`;
    const input = `{\n  "version": "0.1.0",\n${inlineArrayLine}\n}\n`;
    const out = setJsonVersion(input, "9.9.9");

    expect(out).toBe(`{\n  "version": "9.9.9",\n${inlineArrayLine}\n}\n`);
    // The inline array survives verbatim (no per-element line expansion).
    expect(out).toContain(inlineArrayLine);
    expect(out).not.toContain('"a",\n');
  });

  it("round-trips a real-ish tauri.conf.json snippet without expanding CSP arrays", () => {
    const input = [
      "{",
      '  "$schema": "../node_modules/@tauri-apps/cli/config.schema.json",',
      '  "productName": "asterisco",',
      '  "version": "0.1.0",',
      '  "app": {',
      '    "security": {',
      '      "csp": {',
      `        "default-src": ["'self'"],`,
      `        "img-src": ["'self'", "data:", "blob:", "asset:", "http://asset.localhost"]`,
      "      }",
      "    }",
      "  }",
      "}",
      "",
    ].join("\n");
    const out = setJsonVersion(input, "1.2.3");

    expect((JSON.parse(out) as { version: string }).version).toBe("1.2.3");
    // Inline CSP arrays are preserved exactly — no diff beyond the version line.
    expect(out).toContain(`        "default-src": ["'self'"],`);
    expect(out).toContain(
      `        "img-src": ["'self'", "data:", "blob:", "asset:", "http://asset.localhost"]`,
    );
    // Only the version line differs from the input.
    expect(out).toBe(input.replace('"version": "0.1.0"', '"version": "1.2.3"'));
  });
});

describe("setCargoVersion", () => {
  const cargo = [
    "[package]",
    'name = "project-asterisco"',
    'version = "0.1.0"',
    'edition = "2021"',
    "",
    "[dependencies]",
    'tauri = { version = "2.11.2", features = ["protocol-asset"] }',
    'serde = { version = "1", features = ["derive"] }',
    "",
  ].join("\n");

  it("changes the [package] version", () => {
    const out = setCargoVersion(cargo, "1.0.0");
    expect(out).toContain('version = "1.0.0"');
  });

  it("does NOT touch dependency version pins", () => {
    const out = setCargoVersion(cargo, "1.0.0");
    // The dependency line with the same shape must be preserved verbatim.
    expect(out).toContain('tauri = { version = "2.11.2", features = ["protocol-asset"] }');
    // And there must be exactly one bumped [package] version.
    expect(out.match(/^version = "1\.0\.0"$/m)).not.toBeNull();
    expect(out.match(/^version = "0\.1\.0"$/m)).toBeNull();
  });
});

describe("releaseChangelog", () => {
  const changelog = [
    "# Changelog",
    "",
    "## [Unreleased]",
    "",
    "### Added",
    "",
    "- A thing.",
    "",
  ].join("\n");

  it("rewrites the Unreleased heading into a dated release entry", () => {
    const out = releaseChangelog(changelog, "1.0.0", "2026-06-07");
    // Em dash, matching every entry the changelog already carries.
    expect(out).toContain("## [1.0.0] — 2026-06-07");
    expect(out).not.toContain("## [Unreleased]");
    // Body is preserved.
    expect(out).toContain("- A thing.");
  });

  it("leaves text unchanged when there is no Unreleased heading", () => {
    const noUnreleased = "# Changelog\n\n## [0.9.0] - 2026-01-01\n";
    expect(releaseChangelog(noUnreleased, "1.0.0", "2026-06-07")).toBe(noUnreleased);
  });
});
