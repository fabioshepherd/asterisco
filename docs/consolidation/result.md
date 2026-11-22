# Consolidation result (1.0)

> **Historical record** of the 1.0 consolidation (November 2026), closed on
> 2026-11-19. It was written in the project's previous repository, now kept as a
> private archive: commit hashes, PR numbers, branch names, `file:line`
> references and scripts cited here refer to that tree and may no longer exist.
> The current state is in [`docs/ROADMAP.md`](../ROADMAP.md) and
> [`CHANGELOG.md`](../../CHANGELOG.md).

- Date: 2026-11-19
- Final commit measured: b5c6e8a (branch `consolidation/wave-4`; product code identical to `682b38b`, the merged Wave 3)
- Command: `bun scripts/consolidation-metrics.mjs` (fresh `vite build`, vitest, cargo test, playwright `--list`)
- Installer: `bun tauri build --bundles deb --config '{"bundle":{"createUpdaterArtifacts":false}}'` on this commit, Linux x86_64 only (same method as `baseline.md`). AppImage, macOS and Windows sizes are not measured.
- Sources for the earlier columns: `baseline.md` — "Baseline (corrected, JS incl. .mjs)" for the JS rows, the Wave 0 table for every other row, and "After Wave 3".

## Before / after

| Metric | Baseline (Wave 0) | After Wave 3 | Final | Final − Baseline |
| --- | ---: | ---: | ---: | ---: |
| JS bundle, raw | 10,018,699 B | 6,646,062 B | 6,646,062 B | −3,372,637 B |
| JS bundle, gzip | 3,106,381 B | 2,077,567 B | 2,077,567 B | −1,028,814 B |
| CSS bundle, raw | 167,494 B | 165,140 B | 165,140 B | −2,354 B |
| CSS bundle, gzip | 37,666 B | 36,833 B | 36,833 B | −833 B |
| npm direct dependencies | 53 | 42 | 42 | −11 |
| npm direct devDependencies | 28 | 26 | 26 | −2 |
| npm installed packages (total) | 1047 | 948 | 948 | −99 |
| cargo direct dependencies | 22 | 18 | 18 | −4 |
| cargo direct dev-dependencies | 0 | 0 | 0 | 0 |
| cargo total packages | 618 | 602 | 602 | −16 |
| LOC src/app | 1,695 | 1,805 | 1,805 | +110 |
| LOC src/components | 556 | 718 | 718 | +162 |
| LOC src/editor | 3,282 | 3,099 | 3,099 | −183 |
| LOC src/i18n | 36 | 38 | 38 | +2 |
| LOC src/lib | 936 | 1,156 | 1,156 | +220 |
| LOC src/stores | 1,233 | 903 | 903 | −330 |
| LOC src/styles | 1,130 | 1,011 | 1,011 | −119 |
| LOC src/types | 10 | — | — | −10 (folder removed) |
| LOC src (top-level files) | 31 | 31 | 31 | 0 |
| LOC src/features/command-palette | 917 | 479 | 479 | −438 |
| LOC src/features/export | 1,135 | 843 | 843 | −292 |
| LOC src/features/file-drop | — | 84 | 84 | +84 (new folder) |
| LOC src/features/file-ops | 319 | 312 | 312 | −7 |
| LOC src/features/file-sync | 213 | 220 | 220 | +7 |
| LOC src/features/file-tree | 1,896 | 1,905 | 1,905 | +9 |
| LOC src/features/find-replace | 537 | 512 | 512 | −25 |
| LOC src/features/import | 526 | — | — | −526 (removed) |
| LOC src/features/notifications | 156 | 178 | 178 | +22 |
| LOC src/features/outline | 196 | 179 | 179 | −17 |
| LOC src/features/search | 315 | 328 | 328 | +13 |
| LOC src/features/settings | 2,318 | 1,780 | 1,780 | −538 |
| LOC src/features/split | 569 | — | — | −569 (removed) |
| LOC src/features/status-bar | 295 | 246 | 246 | −49 |
| LOC src/features/tabs | 988 | 1,065 | 1,065 | +77 |
| LOC src/features/themes | 338 | 226 | 226 | −112 |
| LOC src/features/updates | 37 | 45 | 45 | +8 |
| LOC src/features/welcome | 211 | 199 | 199 | −12 |
| LOC frontend total (rows above) | 19,875 | 17,362 | 17,362 | −2,513 |
| LOC src-tauri/src | 2,142 | 1,990 | 1,990 | −152 |
| vitest tests | 1118 (135 files) | 1149 (129 files) | 1149 (129 files) | +31 |
| vitest duration | 49.11s | 42.77s | 41.93s | single run, noisy |
| cargo tests | 67 | 65 | 65 | −2 |
| e2e tests (listed) | 8 | 50 | 50 | +42 |
| Installer size (deb) | 13,486,576 B | 8,325,530 B | 8,325,518 B | −5,161,058 B |
| Main binary size | 35,184,712 B | 14,473,424 B | 14,473,424 B | −20,711,288 B |

LOC are non-blank lines, tests excluded (see `baseline.md` "How measured"). The final run had exit 0 for vitest and cargo test; e2e tests are counted, not run, by the script (none is marked `test.fail`). The Final column equals After Wave 3 except the vitest duration and the `.deb` (12 bytes smaller on a rebuild of the same code; the binary is byte-for-byte the same size). Cold start and idle RAM were not measured (owner decision 2026-11-17).

## Decisions per wave

Full records in `w1-decisions.md` … `w4-decisions.md`; owner decisions are dated there.

### Wave 0 — safety net and baseline

Gate snapshot (`gate-snapshot.md`), Playwright e2e on a mocked backend, patch/minor dependency refresh, baseline metrics (`baseline.md`). No decisions file.

### Wave 1 — UX cuts

- Required: V1-01 flush the editor before save/export/copy/auto-save; V1-02 localize the remaining strings (regex-engine detail tooltip removed instead); V1-03 superseded by UX-03; V1-04 metrics script counts `.mjs`.
- Cut: UX-01 image resize/align (alt and title round-trip verbatim); UX-03 smart punctuation; UX-04 all importers; UX-05 DOCX export; UX-06/07 split editor and tree→editor drag (tab drag-reorder kept); UX-08 definition lists; UX-09 base64 image mode, auto-save interval mode (one on/off switch), settings import/export, default auto-save toggle shortcut.
- Simplified: UX-10 Export PDF → File ▸ Print… (Mod+P); UX-11 menu duplicates removed, "Close Tab"; UX-12 status bar (no characters or reading time; line:col in Source only); UX-13 decorative motion removed; UX-14 palette accent picker removed; UX-15 settings scroll-spy removed; UX-16 updater kept, dead silent-check branch removed.

### Wave 2 — UI and accessibility

- Required: V1-05 Source view crash with two documents; V1-06 design-system defects; V1-07 accessibility defects A11Y-02 … A11Y-18; V1-08 `e2e/a11y.spec.ts` (no new dependency; axe rejected by the owner 2026-11-18); A11Y-01 option A, Crepe indent plugin removed (Tab moves focus outside lists and code).
- Owner: UI-02 code shown once, preview only for Mermaid/LaTeX, `@tanstack/highlight` dropped; UI-04 one text measure, default 66ch; UI-08/09/10 one segmented control, dialog and icon button; UI-11 presets cut; UI-12/13/16 chrome hidden without a document, sidebar ignored-folders button and duplicate root row removed; UI-17 mono reading font dropped; UI-18/19/20 Mermaid neutral theme, unsaved dot in the close slot, plain success toasts.

### Wave 3 — code review

- Required: V1-09 File/app accelerators off macOS and per-platform `reserved-combos`; V1-10 settings persistence race; V1-11 wrong palette shortcut hint; V1-12 symlinked save keeps the link; V1-13 Rust file commands off the main thread; V1-14 search skips unreadable folders, `create_file` uses `create_new`; V1-15 updater checks unsaved changes on Windows; V1-16 docs corrected on file access and permissions; V1-17 unedited content and selection count; V1-18 notices generation fixed and no longer hidden.
- Owner: CODE-01 option A, Reading-view links (navigation guard, browser for web links, `.md` links in a new tab, scoped opener); CODE-02 option A+B, byte-exact save (skip clean writes, keep EOL/BOM/final newline); CODE-03 option A, tab-by-position dropped; CODE-04 option B, Crepe ListItem feature disabled; CODE-05 one command registry; CODE-06 cleanup cuts (unused deps, dead keys, dead exports); CODE-07 small fixes (Mermaid flicker, Source→edit undo step, label observer, launch language, palette order, print-window permissions, CI token permissions, bounded image save, typecheck coverage, `rust-version`, CSP); CODE-08 Oxc minifier, one KaTeX copy, lazy export path, size-tuned release profile; CODE-09 motion 14, eslint-config-prettier 10, eslint-plugin-react-refresh 0.5, globals 17; CODE-10 Mermaid kept on 11.
- Coordinator rulings (owner may correct): no Ctrl+PageUp/Down tab switching added (it never existed); all Format keys reserved, stored custom bindings on them drop at load; palette uses menu labels and lists Quit/Close Tab/Help; SHELL-14 half skipped as churn; cancel after the update download is silent; KaTeX `overrides` kept (−76 KB gz measured); `rust-version` 1.91 and `opt-level = "s"`.

### Wave 4 — close

- V1-19 unmeasured performance claims removed from copy (0403b2c); coordinator ruling 2026-11-19: PRODUCT.md's non-numeric "opens fast enough…" kept.
- V1-20 this result, docs matched to the app, CHANGELOG 1.0 entry, notices regenerated, version bump prepared. Coordinator ruling 2026-11-19: manifests stay at 0.5.1; the 1.0.0 notes sit under `## [Unreleased]`, bumped with `bun run version:set 1.0.0 <date>` at release time with the product-name decision.
- V1-21 independent verifier, PR, owner merge.
- W4-01: all 20 strings marked "da approvare" approved (owner 2026-11-19).

## Later (not 1.0)

- Restrict custom Rust commands per window (app ACL manifest) and restrict file-command paths.
- Per-document image scope (instead of `$HOME/**`).
- Math inside Mermaid labels (needs a sanitizer decision).
- Setext headings and `1)` lists preserved on edited save (serializer limit).
- Files with mixed line endings are normalised on edited save (known limit, `gate-snapshot.md`).
- Search reports a skipped unreadable folder as "stopped at its limit" (needs a `skipped` field).
- SettingsPanel split and settings key table (FEATURES-05, SHELL-06/12/13).
- `CrepeBuilder` (−12.9 KB gz) and the unused KaTeX font files.
- CODE-09 later upgrades: i18next 27, eslint 10 + react-hooks 7, jsdom 31, jest-axe 11 / jest-dom 7, TypeScript 7, vitest 5. Never for 1.0: mermaid 12, `@types/node` > 22.
- Wave 1 "Later": Open Recent submenu, disabled menu states, relaunch after update, reveal in Finder/Explorer.

Release gates still open (outside this work): the product name; a smoke test of a real release on each platform.
