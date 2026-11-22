# Dependency inventory (Wave 0, Task 1b)

> **Historical record** of the 1.0 consolidation (November 2026), closed on
> 2026-11-19. It was written in the project's previous repository, now kept as a
> private archive: commit hashes, PR numbers, branch names, `file:line`
> references and scripts cited here refer to that tree and may no longer exist.
> The current state is in [`docs/ROADMAP.md`](../ROADMAP.md) and
> [`CHANGELOG.md`](../../CHANGELOG.md).

Date: 2026-11-17. Policy: patch/minor within the installed major only; majors are Wave 3 candidates and untouched.
For 0.x packages a bump of the leading non-zero number counts as a major.

## Updated (one commit per group)

| Group | Package | Before | After | Changelog read |
| --- | --- | --- | --- | --- |
| Tauri | tauri (crate) | 2.11.2 | 2.12.6 | tauri-apps/tauri `crates/tauri/CHANGELOG.md` (only Android breaking change; MSRV 1.90, toolchain is 1.97) |
| Tauri | tauri-build / @tauri-apps/cli | 2.6.2 / 2.11.2 | 2.7.5 / 2.12.5 | same repo |
| Tauri | @tauri-apps/api | 2.11.0 | 2.12.5 | same repo |
| Tauri | plugin-dialog (JS+crate) | 2.7.1 | 2.8.4 | tauri-apps/plugins-workspace `plugins/<name>/CHANGELOG.md` (v2 branch) |
| Tauri | plugin-fs | 2.5.1 | 2.7.1 | same |
| Tauri | plugin-store | 2.4.3 | 2.5.1 | same |
| Tauri | plugin-os | 2.3.2 | 2.4.0 | same |
| Tauri | plugin-window-state | 2.4.1 | 2.5.0 | same |
| Tauri | plugin-clipboard-manager | 2.3.2 | 2.5.0 | same |
| Tauri | plugin-updater | 2.10.1 | 2.14.1 | same (zip 9 / base64 0.23 are transitive only) |
| Tauri | plugin-log | 2.8.0 | 2.10.2 | same |
| Tauri | plugin-opener | 2.5.4 | 2.7.3 | same |
| Tauri | plugin-single-instance (crate only) | 2.4.3 | 2.5.5 | same |
| Editor | @milkdown/crepe, kit, react (kept exact, same version) | 7.21.1 | 7.23.0 | `packages/crepe/CHANGELOG.md`, `packages/kit/CHANGELOG.md` on Milkdown/milkdown main; no breaking changes 7.21.2 to 7.23.0 |
| Editor | @codemirror/commands | 6.10.3 | 6.11.1 | not read (no changelog reachable); gated |
| Editor | @codemirror/lang-markdown | 6.5.0 | 6.5.2 | same |
| Editor | @codemirror/language | 6.12.3 | 6.13.1 | same |
| Editor | @codemirror/state | 6.6.0 | 6.7.6 | same |
| Editor | @codemirror/view | 6.43.0 | 6.43.15 | same |
| Build | vite | 8.0.14 | 8.3.8 | vitejs/vite `packages/vite/CHANGELOG.md` (no breaking entries 8.1 to 8.3) |
| Build | @vitejs/plugin-react | 6.0.2 | 6.3.0 | vitejs/vite-plugin-react changelog |
| Build | tailwindcss, @tailwindcss/vite | 4.3.0 | 4.3.5 | tailwindlabs/tailwindcss `CHANGELOG.md` (fixes only) |
| Build | esbuild | 0.28.0 | 0.28.2 | patch |
| Build | eslint, @eslint/js | 9.39.4 | 9.39.5 | patch |
| Build | typescript-eslint | 8.60.0 | 8.73.0 | minor, lint-only |
| Build | prettier | 3.8.3 | 3.10.1 | minor; reformatted one union type in `NoticesDialog.tsx` |
| Build | @types/node | 22.19.19 | 22.20.5 | types |
| Rest | react, react-dom (exact) | 19.2.6 | 19.3.1 | facebook/react `CHANGELOG.md` has 19.3.0 (transitions render independently, new APIs); 19.3.1 not listed there |
| Rest | @types/react, @types/react-dom | 19.2.15 / 19.2.3 | 19.3.0 / 19.3.0 | types |
| Rest | @radix-ui/react-dialog, menubar, slot | 1.1.15 / 1.1.17 / 1.2.4 | 1.3.1 / 1.2.1 / 1.5.0 | radix-ui/primitives per-package CHANGELOG.md (type and a11y fixes) |
| Rest | mermaid | 11.15.0 | 11.17.2 | mermaid `CHANGELOG.md` (11.17.0: classDiagram now uses the v2 renderer by default; visual change only) |
| Rest | motion | 12.40.0 | 12.43.0 | motiondivision/motion `CHANGELOG.md` |
| Rest | mammoth | 1.12.0 | 1.13.0 | NEWS (bluebird removed; repo does not use `.done()`) |
| Rest | dompurify, turndown, @joplin/turndown-plugin-gfm, @fontsource-variable/source-{code-pro,sans-3,serif-4}, mdast-util-definition-list, micromark-extension-definition-list, generate-license-file, @testing-library/react, @testing-library/user-event | patch bumps | latest patch | no changelog reachable; patch-level only, gated |
| Cargo lock | all semver-compatible crates (`cargo update`), incl. trash 5.2.6 to 5.4.0, notify 8.2.0 to 8.2.2, ignore 0.4.33 to 0.4.34, serde, thiserror | | | n/a (lockfile only) |

## Remaining held packages (updated within installed major)

| Package | Before | After | Changelog |
| --- | --- | --- | --- |
| zustand (exact) | 5.0.14 | 5.1.0 | not reachable (GitHub blocked here); gated |
| pdfjs-dist | 6.0.227 | 6.5.438 | not reachable; gated |
| marked | 18.0.4 | 18.2.1 | not reachable (403 here); gated |
| lucide-react | 1.17.0 | 1.74.0 | not reachable; gated |
| tailwind-merge | 3.6.0 | 3.7.0 | not reachable; gated |
| markdown-docx | 1.6.0 | 1.7.1 | not reachable; gated |

## Pinned (owner decision)

- @milkdown/* 7.23.0 (exact). Crepe's ListItem feature is off (CODE-04), so the list-item-block caret bug no longer reaches the app.
- @playwright/test 1.63.0 (matches the preinstalled browser; latest 1.65.1).

## Majors (Wave 3 candidates, untouched)

| Package | Installed | Latest |
| --- | --- | --- |
| @tanstack/highlight (0.x leading-number change) | 0.0.9 | 1.2.12 |
| i18next | 26.3.0 | 27.1.5 |
| react-i18next | 17.0.8 | 18.0.2 |
| mermaid | 11.17.2 | 12.3.0 |
| motion | 12.43.0 | 14.14.0 |
| eslint, @eslint/js | 9.39.5 | 10.15.0 / 10.0.1 |
| eslint-config-prettier | 9.1.2 | 10.1.8 |
| eslint-plugin-react-hooks | 5.2.0 | 7.1.1 |
| eslint-plugin-react-refresh (0.x) | 0.4.26 | 0.5.8 |
| globals | 15.15.0 | 17.14.0 |
| jest-axe | 10.0.0 | 11.0.0 |
| jsdom | 25.0.1 | 31.0.1 |
| @testing-library/jest-dom | 6.9.1 | 7.0.1 |
| @types/node | 22.20.5 | 26.6.6 |
| typescript | 6.0.3 | 7.0.2 |
| vitest | 4.1.7 | 5.1.0 |
| base64 (crate) | 0.22.1 | 0.23.1 |
| calamine (crate, 0.x) | 0.35.0 | 0.38.0 |

Tauri 3.x is alpha and stays out of scope.
