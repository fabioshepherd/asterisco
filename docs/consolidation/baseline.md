# Baseline metrics (Wave 0)

> **Historical record** of the 1.0 consolidation (November 2026), closed on
> 2026-11-19. It was written in the project's previous repository, now kept as a
> private archive: commit hashes, PR numbers, branch names, `file:line`
> references and scripts cited here refer to that tree and may no longer exist.
> The current state is in [`docs/ROADMAP.md`](../ROADMAP.md) and
> [`CHANGELOG.md`](../../CHANGELOG.md).

- Date: 2026-11-17
- Commit measured: 4682f32 (branch `consolidation/wave-0`, dependencies already refreshed, `docs/` reconciliation applied; no product code differs from `5a5ebb8`)
- Reproduce: `bun scripts/consolidation-metrics.mjs` (`--no-build` reuses `dist/`, `--no-tests` skips the test runs)

| Metric | Value | Note |
| --- | ---: | --- |
| JS bundle, raw | 8,706,582 B | all .js in output (fresh vite build) |
| JS bundle, gzip | 2,708,254 B | gzip level 6 per file, summed |
| CSS bundle, raw | 167,494 B | all .css in output |
| CSS bundle, gzip | 37,666 B | gzip level 6 per file, summed |
| npm direct dependencies | 53 | package.json `dependencies` |
| npm direct devDependencies | 28 | package.json `devDependencies` |
| npm installed packages (total) | 1047 | entries in bun.lock `packages` (all, incl. dev, nested copies) |
| cargo direct dependencies | 22 | [dependencies] + [build-dependencies] of the app crate |
| cargo direct dev-dependencies | 0 | [dev-dependencies] |
| cargo total packages | 618 | resolved packages in `cargo metadata` minus workspace crate (all targets/platforms) |
| LOC src/app | 1,695 |  |
| LOC src/components | 556 |  |
| LOC src/editor | 3,282 |  |
| LOC src/i18n | 36 |  |
| LOC src/lib | 936 |  |
| LOC src/stores | 1,233 |  |
| LOC src/styles | 1,130 |  |
| LOC src/test | 0 |  |
| LOC src/types | 10 |  |
| LOC src (top-level files) | 31 |  |
| LOC src/features/command-palette | 917 |  |
| LOC src/features/export | 1,135 |  |
| LOC src/features/file-ops | 319 |  |
| LOC src/features/file-sync | 213 |  |
| LOC src/features/file-tree | 1,896 |  |
| LOC src/features/find-replace | 537 |  |
| LOC src/features/import | 526 |  |
| LOC src/features/notifications | 156 |  |
| LOC src/features/outline | 196 |  |
| LOC src/features/search | 315 |  |
| LOC src/features/settings | 2,318 |  |
| LOC src/features/split | 569 |  |
| LOC src/features/status-bar | 295 |  |
| LOC src/features/tabs | 988 |  |
| LOC src/features/themes | 338 |  |
| LOC src/features/updates | 37 |  |
| LOC src/features/welcome | 211 |  |
| LOC src-tauri/src | 2,142 | Rust, `#[cfg(test)] mod` blocks excluded |
| LOC note | - | non-blank lines; .ts/.tsx/.js/.css/.rs; test files excluded (`*.test.*`, `*.spec.*`, `__tests__/`); JSON locale files not counted |
| vitest tests | 1118 | 135 files; exit 0; parsed from `vitest run` summary |
| vitest duration | 49.11s | wall time reported by vitest (includes transform/collect) |
| cargo tests | 67 | exit 0; summed `test result` lines |
| e2e tests | 8 | `playwright test --list` (counted, not run; includes `test.fail` cases) |
| Installer size (deb) | 13,486,576 B | src-tauri/target/release/bundle/deb/asterisco_0.5.1_amd64.deb |
| Main binary size | 35,184,712 B | src-tauri/target/release/asterisco (release, unstripped as built) |

## How measured

- **Bundles:** the script runs `vite build` into a temp dir and sums every `.js` / `.css` file (all chunks, including lazy ones such as Mermaid). Gzip is Node `zlib.gzipSync` default level, per file, summed.
- **npm:** direct counts come from `package.json`; the total counts entries in the `bun.lock` `packages` map (every installed instance, dev included, nested copies counted separately).
- **cargo:** `cargo metadata --format-version 1`; direct = the app crate's normal + build dependencies; total = resolved packages minus the workspace crate, across all targets and platforms (more than any single platform compiles).
- **LOC:** non-blank lines of `.ts/.tsx/.js/.css/.rs`. Test files (`*.test.*`, `*.spec.*`, `__tests__/`) are excluded; in Rust, `#[cfg(test)] mod { }` blocks are dropped by brace counting. JSON (locales) is not counted, so `src/i18n` is small. `src/features/*` rows are not included in the `src/*` rows.
- **Tests:** vitest counts and duration are parsed from the `vitest run` summary (duration is a single run on this sandbox, so noisy: the gate snapshot saw 43.3 s); cargo is the sum of `test result` lines; e2e is the `playwright test --list` count (listed, not run), including 2 `test.fail` cases that pin known defects.
- **Installer size:** the script does not build; it reports bundles found under `src-tauri/target/release/bundle`. The .deb was built once with `bun tauri build --bundles deb --config '{"bundle":{"createUpdaterArtifacts":false}}'` (the override avoids needing the updater signing key; it does not change the binary). Linux only; AppImage, macOS and Windows sizes are not measured.

## Baseline (corrected, JS incl. .mjs)

- Commit measured: e85bc25 (`git rev-parse --short HEAD`; code identical to the original baseline commit, `4682f32`)
- Command: `bun scripts/consolidation-metrics.mjs --no-tests` (fresh `vite build`)

| Metric | Value | Note |
| --- | ---: | --- |
| JS bundle, raw | 10,018,699 B | all .js and .mjs in output (fresh vite build) |
| JS bundle, gzip | 3,106,381 B | gzip level 6 per file, summed |

Correction: the original script summed only `.js` files and missed `pdf.worker.min.mjs` (about 379 KB gzip); the script now counts `.mjs` too, so JS totals rise from 8,706,582 B raw / 2,708,254 B gzip to the values above. CSS and all other rows are unchanged.

## After Wave 1 (commit 4a0e379)

Same script and method (JS includes `.mjs`; compare with "Baseline (corrected)": 3,106,381 B gzip). Installer/binary rows below are the stale Wave 0 build left in `target/` — not rebuilt for Wave 1; re-measured in Wave 4.

| Metric | Value | Note |
| --- | ---: | --- |
| JS bundle, raw | 7,023,058 B | all .js and .mjs in output (fresh vite build) |
| JS bundle, gzip | 2,218,928 B | gzip level 6 per file, summed |
| CSS bundle, raw | 164,694 B | all .css in output |
| CSS bundle, gzip | 37,176 B | gzip level 6 per file, summed |
| npm direct dependencies | 45 | package.json `dependencies` |
| npm direct devDependencies | 27 | package.json `devDependencies` |
| npm installed packages (total) | 982 | entries in bun.lock `packages` (all, incl. dev, nested copies) |
| cargo direct dependencies | 19 | [dependencies] + [build-dependencies] of the app crate |
| cargo direct dev-dependencies | 0 | [dev-dependencies] |
| cargo total packages | 602 | resolved packages in `cargo metadata` minus workspace crate (all targets/platforms) |
| LOC src/app | 1,624 |  |
| LOC src/components | 556 |  |
| LOC src/editor | 2,529 |  |
| LOC src/i18n | 36 |  |
| LOC src/lib | 885 |  |
| LOC src/stores | 880 |  |
| LOC src/styles | 1,030 |  |
| LOC src/test | 0 |  |
| LOC src (top-level files) | 31 |  |
| LOC src/features/command-palette | 773 |  |
| LOC src/features/export | 822 |  |
| LOC src/features/file-drop | 84 |  |
| LOC src/features/file-ops | 294 |  |
| LOC src/features/file-sync | 207 |  |
| LOC src/features/file-tree | 1,875 |  |
| LOC src/features/find-replace | 512 |  |
| LOC src/features/notifications | 156 |  |
| LOC src/features/outline | 192 |  |
| LOC src/features/search | 315 |  |
| LOC src/features/settings | 1,977 |  |
| LOC src/features/status-bar | 266 |  |
| LOC src/features/tabs | 1,049 |  |
| LOC src/features/themes | 338 |  |
| LOC src/features/updates | 35 |  |
| LOC src/features/welcome | 211 |  |
| LOC src-tauri/src | 1,811 | Rust, `#[cfg(test)] mod` blocks excluded |
| LOC note | - | non-blank lines; .ts/.tsx/.js/.css/.rs; test files excluded (`*.test.*`, `*.spec.*`, `__tests__/`); JSON locale files not counted |
| vitest tests | 951 | 116 files; exit 0; parsed from `vitest run` summary |
| vitest duration | 34.35s | wall time reported by vitest (includes transform/collect) |
| cargo tests | 49 | exit 0; summed `test result` lines |
| e2e tests | 9 | `playwright test --list` (counted, not run; includes `test.fail` cases) |
| Installer size (deb) | 13,486,576 B | src-tauri/target/release/bundle/deb/asterisco_0.5.1_amd64.deb |
| Main binary size | 35,184,712 B | src-tauri/target/release/asterisco |

## After Wave 3 (2026-11-18, 447da06)

Same script and method (JS includes `.mjs`; compare with "After Wave 1"). Installer/binary rows are a fresh `bun tauri build --bundles deb --config '{"bundle":{"createUpdaterArtifacts":false}}'` on this commit, with the changed Rust release profile; "After Wave 1" carried the stale Wave 0 build for these rows.

| Metric | Value | Note |
| --- | ---: | --- |
| JS bundle, raw | 6,646,062 B | all .js and .mjs in output (fresh vite build) |
| JS bundle, gzip | 2,077,567 B | gzip level 6 per file, summed |
| CSS bundle, raw | 165,140 B | all .css in output |
| CSS bundle, gzip | 36,833 B | gzip level 6 per file, summed |
| npm direct dependencies | 42 | package.json `dependencies` |
| npm direct devDependencies | 26 | package.json `devDependencies` |
| npm installed packages (total) | 948 | entries in bun.lock `packages` (all, incl. dev, nested copies) |
| cargo direct dependencies | 18 | [dependencies] + [build-dependencies] of the app crate |
| cargo direct dev-dependencies | 0 | [dev-dependencies] |
| cargo total packages | 602 | resolved packages in `cargo metadata` minus workspace crate (all targets/platforms) |
| LOC src/app | 1,805 |  |
| LOC src/components | 718 |  |
| LOC src/editor | 3,099 |  |
| LOC src/i18n | 38 |  |
| LOC src/lib | 1,156 |  |
| LOC src/stores | 903 |  |
| LOC src/styles | 1,011 |  |
| LOC src/test | 0 |  |
| LOC src (top-level files) | 31 |  |
| LOC src/features/command-palette | 479 |  |
| LOC src/features/export | 843 |  |
| LOC src/features/file-drop | 84 |  |
| LOC src/features/file-ops | 312 |  |
| LOC src/features/file-sync | 220 |  |
| LOC src/features/file-tree | 1,905 |  |
| LOC src/features/find-replace | 512 |  |
| LOC src/features/notifications | 178 |  |
| LOC src/features/outline | 179 |  |
| LOC src/features/search | 328 |  |
| LOC src/features/settings | 1,780 |  |
| LOC src/features/status-bar | 246 |  |
| LOC src/features/tabs | 1,065 |  |
| LOC src/features/themes | 226 |  |
| LOC src/features/updates | 45 |  |
| LOC src/features/welcome | 199 |  |
| LOC src-tauri/src | 1,990 | Rust, `#[cfg(test)] mod` blocks excluded |
| LOC note | - | non-blank lines; .ts/.tsx/.js/.css/.rs; test files excluded (`*.test.*`, `*.spec.*`, `__tests__/`); JSON locale files not counted |
| vitest tests | 1149 | 129 files; exit 0; parsed from `vitest run` summary |
| vitest duration | 42.77s | wall time reported by vitest (includes transform/collect) |
| cargo tests | 65 | exit 0; summed `test result` lines |
| e2e tests | 50 | `playwright test --list` (counted, not run; includes `test.fail` cases) |
| Installer size (deb) | 8,325,530 B | src-tauri/target/release/bundle/deb/asterisco_0.5.1_amd64.deb |
| Main binary size | 14,473,424 B | src-tauri/target/release/asterisco |

Delta vs After Wave 1: JS gzip 2,218,928 B to 2,077,567 B (-141,361 B); npm direct deps 45 to 42, total 982 to 948; cargo direct deps 19 to 18, total unchanged at 602.
Tests: vitest 951 to 1149, cargo 49 to 65, e2e 9 to 50. Installer .deb 13,486,576 B to 8,325,530 B (-5,161,046 B); main binary 35,184,712 B to 14,473,424 B (-20,711,288 B).
