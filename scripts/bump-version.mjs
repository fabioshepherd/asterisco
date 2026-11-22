// Bump the project version across all three manifests (package.json,
// src-tauri/tauri.conf.json, src-tauri/Cargo.toml) and roll the CHANGELOG's
// "[Unreleased]" section into a dated release entry.
//
// Usage:
//   node scripts/bump-version.mjs <semver> [YYYY-MM-DD]
//   bun run version:set 1.0.0 2026-06-07
//
// The date is intentionally NOT fabricated here — the caller supplies it so the
// release date is deliberate and reproducible. If omitted, the CHANGELOG's
// "[Unreleased]" heading is left untouched and a reminder is printed.
//
// Pure string transforms are exported so they can be unit-tested in isolation.

import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const SEMVER_RE = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True when `v` is a valid (optionally pre-release) semantic version. */
export function isValidSemver(v) {
  return typeof v === "string" && SEMVER_RE.test(v);
}

/**
 * Set the top-level `version` of a JSON manifest with a TARGETED line
 * replacement that preserves all surrounding formatting. Used for both
 * package.json and tauri.conf.json. A full `JSON.parse`/`JSON.stringify`
 * round-trip would reformat the file (e.g. exploding tauri.conf.json's inline
 * CSP arrays onto one element per line), producing a large unrelated diff that
 * also fails `prettier --check`. So, mirroring `setCargoVersion`, only the first
 * top-level `"version": "..."` entry is rewritten — the captured indentation and
 * spacing are kept verbatim. Both manifests have their top-level `"version"` as
 * the first `"version":` occurrence, so a single line-anchored replace is safe.
 * The result is validated with `JSON.parse` so a malformed input fails loudly.
 */
export function setJsonVersion(text, version) {
  let replaced = false;
  const out = text.replace(
    /^(?<indent>[ \t]*)"version":(?<sp>\s*)"[^"]*"/m,
    (match, indent, sp) => {
      if (replaced) return match;
      replaced = true;
      return `${indent}"version":${sp}"${version}"`;
    },
  );
  // Validate: the output must still be valid JSON and the version must have taken.
  const data = JSON.parse(out);
  if (data.version !== version) {
    throw new Error("setJsonVersion: failed to set top-level version");
  }
  return out;
}

/**
 * Set ONLY the `[package]` table's `version = "..."` line in a Cargo.toml.
 * Anchors to the first `version = "..."` (which Cargo requires to be in the
 * `[package]` table) and replaces it exactly once, so dependency versions like
 * `version = "2.11.2"` further down the file are never touched.
 */
export function setCargoVersion(text, version) {
  let replaced = false;
  return text.replace(/^version = "[^"]*"/m, (match) => {
    if (replaced) return match;
    replaced = true;
    return `version = "${version}"`;
  });
}

/**
 * Convert the `## [Unreleased]` heading into `## [<version>] — <date>`. Only the
 * heading line is rewritten; the section body is preserved as-is. Returns the
 * unchanged text if no `## [Unreleased]` heading is present.
 */
export function releaseChangelog(text, version, date) {
  return text.replace(/^## \[Unreleased\].*$/m, `## [${version}] — ${date}`);
}

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

function main(argv) {
  const [version, date] = argv;

  if (!version) {
    fail("missing version argument\n  usage: node scripts/bump-version.mjs <semver> [YYYY-MM-DD]");
  }
  if (!isValidSemver(version)) {
    fail(`"${version}" is not a valid semver (expected e.g. 1.0.0 or 1.0.0-rc.1)`);
  }
  if (date !== undefined && !DATE_RE.test(date)) {
    fail(`"${date}" is not a valid date (expected YYYY-MM-DD)`);
  }

  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolve(here, "..");

  const targets = [
    { path: resolve(root, "package.json"), transform: (t) => setJsonVersion(t, version) },
    {
      path: resolve(root, "src-tauri/tauri.conf.json"),
      transform: (t) => setJsonVersion(t, version),
    },
    {
      path: resolve(root, "src-tauri/Cargo.toml"),
      transform: (t) => setCargoVersion(t, version),
    },
  ];

  const changed = [];
  for (const { path, transform } of targets) {
    const before = readFileSync(path, "utf8");
    const after = transform(before);
    writeFileSync(path, after);
    changed.push(path);
  }

  const changelogPath = resolve(root, "CHANGELOG.md");
  const changelogBefore = readFileSync(changelogPath, "utf8");
  if (date) {
    const changelogAfter = releaseChangelog(changelogBefore, version, date);
    if (changelogAfter !== changelogBefore) {
      writeFileSync(changelogPath, changelogAfter);
      changed.push(changelogPath);
    } else {
      console.warn("warning: CHANGELOG.md has no '## [Unreleased]' heading — left unchanged");
    }
  } else {
    console.warn(
      "note: no date passed — CHANGELOG '## [Unreleased]' left intact.\n" +
        `      re-run with a date to cut the entry: node scripts/bump-version.mjs ${version} <YYYY-MM-DD>`,
    );
  }

  console.log(`Set version ${version} in:`);
  for (const path of changed) {
    console.log(`  - ${path}`);
  }
}

// Only run side effects when executed as a script (not when imported by tests).
// realpathSync normalizes symlinks (e.g. macOS /var → /private/var) so the
// entry-point check is robust regardless of how the path was spelled.
const entry = process.argv[1] ? realpathSync(process.argv[1]) : "";
if (entry && entry === realpathSync(fileURLToPath(import.meta.url))) {
  main(process.argv.slice(2));
}
