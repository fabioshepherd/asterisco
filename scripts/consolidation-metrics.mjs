#!/usr/bin/env node
// Baseline metrics for the 1.0 consolidation. Prints one markdown table.
//
//   bun scripts/consolidation-metrics.mjs [--no-build] [--no-tests]
//
// --no-build  reuse an existing `dist/` instead of running `vite build`
// --no-tests  skip the vitest / cargo / playwright runs (test rows read "skipped")
//
// Plain Node ESM, no dependencies. See docs/consolidation/baseline.md for how each
// number is obtained.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const rows = [];
const add = (metric, value, note = "") => rows.push([metric, String(value), note]);
const bin = (name) => join(ROOT, "node_modules", ".bin", name);
// eslint-disable-next-line no-control-regex
const stripAnsi = (s) => s.replace(/\u001b\[[0-9;]*m/g, "");
const n = (v) => v.toLocaleString("en-US");

function run(cmd, argv, opts = {}) {
  const r = spawnSync(cmd, argv, { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 28, ...opts });
  return { code: r.status, out: stripAnsi((r.stdout ?? "") + (r.stderr ?? "")) };
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// ---- Bundle size -----------------------------------------------------------
function bundle() {
  let dir = join(ROOT, "dist");
  let tmp = null;
  if (!args.has("--no-build")) {
    tmp = mkdtempSync(join(tmpdir(), "asterisco-dist-"));
    dir = tmp;
    const r = run(bin("vite"), ["build", "--outDir", tmp, "--emptyOutDir"]);
    if (r.code !== 0) throw new Error(`vite build failed:\n${r.out.slice(-2000)}`);
  } else if (!existsSync(dir)) {
    throw new Error("--no-build given but dist/ does not exist");
  }
  const sums = { js: [0, 0], css: [0, 0] };
  for (const f of walk(dir)) {
    const ext = /\.m?js$/.test(f) ? "js" : f.endsWith(".css") ? "css" : null;
    if (!ext) continue;
    const buf = readFileSync(f);
    sums[ext][0] += buf.length;
    sums[ext][1] += gzipSync(buf).length;
  }
  if (tmp) rmSync(tmp, { recursive: true, force: true });
  const src = args.has("--no-build") ? "existing dist/" : "fresh vite build";
  add("JS bundle, raw", `${n(sums.js[0])} B`, `all .js and .mjs in output (${src})`);
  add("JS bundle, gzip", `${n(sums.js[1])} B`, "gzip level 6 per file, summed");
  add("CSS bundle, raw", `${n(sums.css[0])} B`, "all .css in output");
  add("CSS bundle, gzip", `${n(sums.css[1])} B`, "gzip level 6 per file, summed");
}

// ---- npm deps --------------------------------------------------------------
function npmDeps() {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  add(
    "npm direct dependencies",
    Object.keys(pkg.dependencies ?? {}).length,
    "package.json `dependencies`",
  );
  add(
    "npm direct devDependencies",
    Object.keys(pkg.devDependencies ?? {}).length,
    "package.json `devDependencies`",
  );
  // bun.lock is JSONC (trailing commas); its `packages` map has one key per installed
  // package instance, including nested copies of the same package at different versions.
  const text = readFileSync(join(ROOT, "bun.lock"), "utf8");
  const start = text.indexOf('"packages": {');
  const block = text.slice(start);
  const keys = [...block.matchAll(/^ {4}"([^"]+)": \[/gm)].map((m) => m[1]);
  add(
    "npm installed packages (total)",
    keys.length,
    "entries in bun.lock `packages` (all, incl. dev, nested copies)",
  );
}

// ---- cargo deps ------------------------------------------------------------
function cargoDeps() {
  const r = spawnSync(
    "cargo",
    ["metadata", "--format-version", "1", "--manifest-path", "src-tauri/Cargo.toml"],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 29 },
  );
  if (r.status !== 0) throw new Error(`cargo metadata failed:\n${r.stderr}`);
  const meta = JSON.parse(r.stdout);
  const members = new Set(meta.workspace_members);
  const root = meta.packages.find((p) => members.has(p.id));
  const deps = root.dependencies;
  const names = (pred) => new Set(deps.filter(pred).map((d) => d.name)).size;
  add(
    "cargo direct dependencies",
    names((d) => d.kind !== "dev"),
    "[dependencies] + [build-dependencies] of the app crate",
  );
  add(
    "cargo direct dev-dependencies",
    names((d) => d.kind === "dev"),
    "[dev-dependencies]",
  );
  add(
    "cargo total packages",
    meta.packages.filter((p) => !members.has(p.id)).length,
    "resolved packages in `cargo metadata` minus workspace crate (all targets/platforms)",
  );
}

// ---- LOC -------------------------------------------------------------------
const isTestFile = (f) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(f) || /(^|\/)__tests__\//.test(f);
const CODE_EXT = /\.(tsx?|jsx?|css|rs)$/;

function locOf(file) {
  const lines = readFileSync(file, "utf8").split("\n");
  if (!file.endsWith(".rs")) return lines.filter((l) => l.trim()).length;
  // Rust: drop `#[cfg(test)] mod ... { ... }` blocks by brace counting.
  let count = 0;
  let skipping = false;
  let pending = false;
  let depth = 0;
  for (const line of lines) {
    const t = line.trim();
    if (!skipping) {
      if (t.startsWith("#[cfg(test)]")) {
        pending = true;
        continue;
      }
      if (pending) {
        pending = false;
        if (/^(pub\s+)?mod\s+\w+\s*\{/.test(t)) {
          skipping = true;
          depth = 0;
        } else if (t) {
          // `#[cfg(test)]` on a single item/`mod x;` — count nothing for the line
          continue;
        }
      }
    }
    if (skipping) {
      for (const ch of line) {
        if (ch === "{") depth++;
        else if (ch === "}") depth--;
      }
      if (depth <= 0) skipping = false;
      continue;
    }
    if (t) count++;
  }
  return count;
}

function locTree(dir) {
  let total = 0;
  for (const f of walk(dir)) {
    const rel = relative(ROOT, f).split("\\").join("/");
    if (!CODE_EXT.test(f) || isTestFile(rel) || /(^|\/)tests?\//.test(rel)) continue;
    total += locOf(f);
  }
  return total;
}

function loc() {
  const src = join(ROOT, "src");
  for (const e of readdirSync(src, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.name === "features") continue;
    add(`LOC src/${e.name}`, n(locTree(join(src, e.name))));
  }
  const loose = readdirSync(src, { withFileTypes: true })
    .filter((e) => e.isFile() && CODE_EXT.test(e.name) && !isTestFile(e.name))
    .reduce((s, e) => s + locOf(join(src, e.name)), 0);
  add("LOC src (top-level files)", n(loose));
  const feats = join(src, "features");
  if (existsSync(feats)) {
    for (const e of readdirSync(feats, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name))) {
      add(`LOC src/features/${e.name}`, n(locTree(join(feats, e.name))));
    }
  }
  add(
    "LOC src-tauri/src",
    n(locTree(join(ROOT, "src-tauri", "src"))),
    "Rust, `#[cfg(test)] mod` blocks excluded",
  );
  add(
    "LOC note",
    "-",
    "non-blank lines; .ts/.tsx/.js/.css/.rs; test files excluded (`*.test.*`, `*.spec.*`, `__tests__/`); JSON locale files not counted",
  );
  // src/features is also counted inside the per-feature rows, not in the src/* rows above.
}

// ---- Installer size --------------------------------------------------------
// Reports bundles already built under src-tauri/target/release/bundle (this script
// never builds one). Build with: bun tauri build --bundles deb
function installer() {
  const rel = join(ROOT, "src-tauri", "target", "release");
  const bundleDir = join(rel, "bundle");
  const found = existsSync(bundleDir)
    ? walk(bundleDir).filter((f) => /\.(deb|AppImage|rpm|dmg|msi|exe)$/.test(f))
    : [];
  if (found.length === 0) {
    add("Installer size", "not built", "no bundle under src-tauri/target/release/bundle");
    return;
  }
  for (const f of found) {
    add(`Installer size (${f.split(".").pop()})`, `${n(statSync(f).size)} B`, relative(ROOT, f));
  }
  const conf = JSON.parse(readFileSync(join(ROOT, "src-tauri", "tauri.conf.json"), "utf8"));
  // Without mainBinaryName, Cargo names the binary after the package, not productName.
  const cargo = readFileSync(join(ROOT, "src-tauri", "Cargo.toml"), "utf8");
  const pkg = /^name\s*=\s*"([^"]+)"/m.exec(cargo)?.[1];
  const bin = join(rel, conf.mainBinaryName ?? pkg ?? "");
  if (existsSync(bin) && statSync(bin).isFile()) {
    add("Main binary size", `${n(statSync(bin).size)} B`, relative(ROOT, bin));
  }
}

// ---- Tests -----------------------------------------------------------------
function tests() {
  if (args.has("--no-tests")) {
    for (const k of ["vitest tests", "cargo tests", "e2e tests", "vitest duration"])
      add(k, "skipped");
    return;
  }
  const v = run(bin("vitest"), ["run"]);
  const tm = v.out.match(
    /Tests\s+(?:(\d+) failed \| )?(\d+) passed(?: \| (\d+) skipped)?(?: \((\d+)\))?/,
  );
  const fm = v.out.match(/Test Files\s+.*?\((\d+)\)|Test Files\s+(?:\d+ failed \| )?(\d+) passed/);
  const dur = v.out.match(/Duration\s+([\d.]+m?s)/);
  add(
    "vitest tests",
    tm ? (tm[4] ?? tm[2]) : "unparsed",
    `${fm ? (fm[1] ?? fm[2]) : "?"} files; exit ${v.code}; parsed from \`vitest run\` summary`,
  );
  add(
    "vitest duration",
    dur ? dur[1] : "unparsed",
    "wall time reported by vitest (includes transform/collect)",
  );

  const c = run("cargo", ["test", "--manifest-path", "src-tauri/Cargo.toml"]);
  const passed = [...c.out.matchAll(/test result: \w+\. (\d+) passed; (\d+) failed/g)];
  add(
    "cargo tests",
    passed.reduce((s, m) => s + Number(m[1]), 0),
    `exit ${c.code}; summed \`test result\` lines`,
  );

  const e = run(bin("playwright"), ["test", "--list"]);
  const em = e.out.match(/Total: (\d+) tests?/);
  add(
    "e2e tests",
    em ? em[1] : "unparsed",
    "`playwright test --list` (counted, not run; includes `test.fail` cases)",
  );
}

try {
  let sha = "unknown";
  try {
    sha = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: ROOT,
      encoding: "utf8",
    }).trim();
  } catch {
    // not a git checkout: keep "unknown"
  }
  bundle();
  npmDeps();
  cargoDeps();
  loc();
  tests();
  installer();
  console.log(`<!-- commit ${sha} -->`);
  console.log("| Metric | Value | Note |\n| --- | ---: | --- |");
  for (const [a, b, c] of rows) console.log(`| ${a} | ${b} | ${c} |`);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
