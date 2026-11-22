# CLAUDE.md — Asterisco

> **Asterisco** — native, cross-platform, **local-first** Markdown editor for the files a codebase is made of — READMEs, ADRs, specs, changelogs, and the agent briefs (`CLAUDE.md`, `AGENTS.md`) beside them. It sits **beside** the IDE, never in place of it, and reading a `.md` is as much the job as editing one.
> **Free and open source — MIT** (see `LICENSE`). Do not add per-file license headers: MIT does not require them.
> **Product truth lives in `PRODUCT.md` (who it is for, what it claims, what it refuses to become) and `docs/ROADMAP.md` (phase status, what remains for 1.0) — read both before starting any work.** How to contribute is in `CONTRIBUTING.md`. This file is the lean, always-loaded brief for anyone working on the project with a coding agent.

## Personal preferences
This file is shared by every contributor. Keep your own preferences — the language the agent answers you in, your local paths, how you coordinate your own sessions — in an untracked `CLAUDE.local.md` in the repository root (git-ignored; start from `CLAUDE.local.md.example`), and personal agent permissions in your own (git-ignored) settings, never in this file.

## Tech stack
- Tauri 2 (Rust) shell + React 19 + TypeScript + Vite; Milkdown/Crepe (WYSIWYG) and CodeMirror 6 (source mode); Zustand; i18next. See `ARCHITECTURE.md`.
- **Package manager:** bun.

## Commands
- Frontend: `bun run typecheck` · `bun run lint` (ESLint + Prettier, Markdown included) · `bun run test` (Vitest) · `bun run test:e2e` (Playwright) · `bun tauri dev` (the app).
- Rust: `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings && cargo test --manifest-path src-tauri/Cargo.toml && cargo fmt --manifest-path src-tauri/Cargo.toml`

## Code conventions
- TypeScript strict; avoid `any` (justify with a comment if unavoidable).
- Functional components + hooks; small, single-responsibility components; feature-based structure under `src/features`.
- **All filesystem / native I/O goes through Rust commands** (`src-tauri/src/commands`). The frontend never touches the filesystem outside declared Tauri capabilities.
- **All colors via CSS variables / design tokens** — every component must work in both light and dark mode. The palette is built on official **Radix Colors** scales: a **selectable** neutral base (default **Gray**, true chroma-0) plus a user-selectable **accent** (default **Orange**, the signal colour), switched live via `data-neutral` and `data-accent` attributes on `<html>`. Use the semantic tokens (`--bg`, `--fg`, `--primary`, `--accent`, `--ring`, …); never hand-author hex/oklch for these. **Solid fills that carry text and the focus ring bind to step 11; step 9 is signal-only (dots, indicators, borders) and never sits under small text** — `src/styles/contrast.test.ts` enforces it. See `docs/THEMING.md`.
- **All fonts via the typography tokens** — one superfamily in three cuts: `--font-sans` (**Source Sans 3**, app chrome), `--font-serif` (**Source Serif 4**, editor reading body + document titles), `--font-mono` (**Source Code Pro**, code, source mode, and machine data such as paths, counts and shortcuts). Self-hosted variable fonts (latin + latin-ext, the serif with `opsz` and a true italic); no CDN. Never hardcode a `font-family`; use the tokens. See `docs/THEMING.md`.
- English for code, comments, commit messages and pull requests. **UI strings only via i18n (`it` + `en`) — never hardcoded.**
- Conventional Commits; one logical change per commit.

## Rules — important
- **Read the CURRENT official docs before using ANY library's API**, and verify the latest stable version (see Reference docs below). Do NOT rely on training-memory API — the whole stack moves, and Milkdown/Crepe, Tauri 2 and Tailwind 4 in particular change fast, so recollection may be outdated or invented.
- **IMPORTANT:** run `bun run typecheck` and `bun run lint` after every series of changes and fix issues before moving on.
- **Make minimal changes — do NOT refactor unrelated code.**
- **Build incrementally by phase** (`docs/ROADMAP.md`). Each phase must end with a working, testable app before starting the next.
- **Local-first:** no network calls unless strictly required. AI / sync / image-upload features are **opt-in**, isolated behind flags, and require explicit user consent before any data leaves the device.
- **Security:** respect Tauri capabilities/ACL; keep a restrictive CSP; sanitize any HTML rendered from Markdown.
- **Never permanently delete user files** — use the system trash; always prompt on unsaved changes.
- Write tests for core logic and critical components as you build.
- **Discuss first** (an issue, or ask the person you are working with): adding a major dependency, changing the architecture, or any irreversible/destructive operation. Agents ask before acting on these.
- Code-signing, notarization and updater-signing secrets live only in the repository's encrypted secrets, managed by the maintainer — set up scripts/CI but never embed credentials.
- **Licensing:** the project is **MIT** (`LICENSE`). Dependencies stay under their own (mostly MIT/Apache-2.0) licenses, so the build MUST generate and bundle a THIRD-PARTY-NOTICES file with their license texts (e.g. `cargo about` for Rust, a license-checker for the npm tree). Before adding any dependency, confirm its license is compatible with MIT redistribution and avoid copyleft (GPL/AGPL) libraries unless the maintainer approves them — they would force the whole project to relicense.

## Changes and pull requests
- Run the local checks (`bun run typecheck`, `bun run lint`, `bun run test`, and the Rust command above when Rust changes) before every commit.
- Conventional Commits; one logical change per commit. Open pull requests as **draft** until the change is finished: the long `bundle` job runs only on ready PRs.
- `main` is protected: changes land only through a reviewed pull request with green CI (`frontend`, `e2e`, `rust`, `bundle`).
- Files many changes touch (IPC commands, settings migrations, `tauri.conf.json`/capabilities, lockfiles, i18n locales, workflows) are best changed in one PR at a time.
- New or changed user-facing strings (it + en) are reviewed by the maintainer in the PR.
- The maintainer's own multi-session workflow is described in `docs/regia.md` (Italian); you do not need it to contribute.

## Accessibility (WCAG 2.2 AA)
Full keyboard navigation, always-visible focus, correct ARIA on custom UI, sufficient contrast in every theme, honor `prefers-reduced-motion` and `prefers-color-scheme`.

## Definition of done (per task)
`bun run typecheck` + `bun run lint` pass · relevant tests pass · app runs via `bun tauri dev` with no console errors · all user-facing strings localized.

## Reference docs
Official docs — the starting point. Always read the page matching the version you actually install, and prefer the docs over memory.
- Tauri 2 — https://v2.tauri.app
- React — https://react.dev
- TypeScript — https://www.typescriptlang.org/docs
- Vite — https://vite.dev
- Milkdown / Crepe — https://milkdown.dev
- CodeMirror 6 — https://codemirror.net/docs
- KaTeX — https://katex.org/docs
- Mermaid — https://mermaid.js.org
- Zustand — https://zustand.docs.pmnd.rs
- Tailwind CSS — https://tailwindcss.com/docs
- i18next / react-i18next — https://www.i18next.com · https://react.i18next.com
- Vitest — https://vitest.dev
- Playwright — https://playwright.dev

## Design Context
- **`PRODUCT.md`** (root) — strategic design brief: register (**product**), users, product purpose, brand personality, anti-references, the 5 design principles, accessibility. Read it before any UI/design work.
- **`DESIGN.md`** (root) — the visual system (Radix three-axis tokens, typography, components) in Google Stitch format; **normative** for colours/type/components.
- Both are the source of truth for design decisions; keep them in sync when the design system changes — `DESIGN.md` wins on visual decisions, `PRODUCT.md` on strategic/voice ones. A local `/impeccable` design skill may consume them for tooling, but that layer is optional and not part of this repository.
