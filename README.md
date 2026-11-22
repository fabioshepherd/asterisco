# Asterisco

[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/fabioshepherd/asterisco/badge)](https://scorecard.dev/viewer/?uri=github.com/fabioshepherd/asterisco)

> A native, cross-platform, **local-first** Markdown
> editor for the files a codebase is made of.
> **Free and open source** — [MIT](./LICENSE).

READMEs, ADRs, specs, changelogs, a `docs/` tree — and the agent files that live
in the same repo (`CLAUDE.md`, `AGENTS.md`, skills, prompts). These files are
opened to be *read* far more often than they are opened to be changed, and an IDE
gives prose no measure, no reading typography, no page. This shows a `.md` as it
will be read while you edit it: seamless inline WYSIWYG, one column, no split
preview. It sits **beside** the IDE, never in place of it.

Files stay plain `.md` on your own disk. No account, no telemetry, no network
except the update check you trigger. Built on a native WebView (Tauri 2) — no
bundled Chromium.

## Status

**0.5.1 — Phase 2, V1.0 done except the release gates.** Phase 0 (scaffold) and
Phase 1 (editing MVP) are done; the 1.0 notes are drafted in
[CHANGELOG.md](./CHANGELOG.md). A tagged release builds **macOS (Apple Silicon + Intel), Windows
and Linux**; the macOS bundles are **unsigned** for now, so Gatekeeper warns on
first open. See [docs/ROADMAP.md](./docs/ROADMAP.md) (what ships next) and
[ARCHITECTURE.md](./ARCHITECTURE.md).

**What works today:**

- WYSIWYG Markdown (Milkdown/Crepe) — full GFM, code blocks (CodeMirror),
  tables, auto-pairing, links via typed Markdown.
- Math (KaTeX), Mermaid diagrams, footnotes, YAML front matter
  (collapsible).
- Three views of the same column — source (CodeMirror 6), edit, reading — plus
  distraction-free. The view a document opens in is a setting.
- Files: open / save / save-as / new, auto-save, external-change watcher, tabbed
  editing with inline rename, recent files **and** recent folders.
- A file tree scoped to the nearest project root — `.gitignore`-aware, filterable
  across the whole workspace, keyboard-reachable, resizable; agent briefs and
  READMEs are marked so the way into a folder reads first.
- Outline panel, in-file find & replace, workspace-wide search, command palette.
- Export to HTML, copy as HTML / Markdown, and Print (save as PDF from the
  print dialog) — math, diagrams and footnotes render in HTML and print, and
  export follows the active theme.
- Theming: light / dark / system, selectable neutral base and accent, user
  custom CSS with hot-reload; reading typography; customizable
  keybindings; word count (selection-aware).
- Images: drag / paste → `assets/` folder with portable relative links.
- i18n (it/en), native menu, persisted window state, in-app updater.

**Still pending for V1:** the release gates tracked in
[docs/ROADMAP.md](./docs/ROADMAP.md) — publishing 1.0 from the public repository and
a smoke test of a real release on each platform. Atomic file writes, the localized Crepe slash
menu, the release matrix, File shortcuts on Windows/Linux and the Playwright
suite (`bun run test:e2e`) have landed.

## Tech stack

Tauri 2 (Rust) · React 19 · TypeScript 6 (strict) · Vite 8 · Tailwind CSS 4 ·
shadcn/ui on Radix · Zustand · i18next. Package manager: **bun**.

## Prerequisites

- [bun](https://bun.sh) ≥ 1.3
- [Rust](https://rustup.rs) (stable) + Cargo
- macOS: Xcode Command Line Tools (`xcode-select --install`)
- Node ≥ 20.19 / 22.12 (Vite 8 / Vitest 4 require it)

> Release bundles are produced for all three platforms. Day-to-day development
> happens on macOS and Windows; Linux is built by CI but gets less hands-on use.

## Develop

```bash
bun install            # install frontend deps
bun tauri dev          # run the app (first run compiles Rust — takes a few minutes)
```

| Command | What it does |
| --- | --- |
| `bun tauri dev` | Run the desktop app in development |
| `bun tauri build` | Production build / bundle |
| `bun run dev` | Vite dev server only (no native shell) |
| `bun run typecheck` | `tsc --noEmit` (strict) |
| `bun run lint` | ESLint + Prettier check (`lint:fix` to autofix) |
| `bun run test` | Vitest (unit + component) |
| `bun run test:e2e` | Playwright end-to-end suite (core flows, keyboard walkthrough) |

Rust (backend) checks:

```bash
cargo fmt   --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
cargo test  --manifest-path src-tauri/Cargo.toml
```

## Project layout

```
src/            React + TS frontend
  app/          bootstrap, providers, startup/theme/menu hooks
  editor/       Milkdown/Crepe wrapper (Phase 1)
  features/     per-domain features (Phase 1+)
  components/   reusable UI (design system; components/ui = shadcn)
  stores/       Zustand stores (settings, ui, theme logic)
  lib/          utilities, typed bridge to Tauri commands (lib/tauri)
  i18n/         translation resources (it/en)
  styles/       design tokens + themes (CSS variables)
src-tauri/      Rust backend
  src/commands/ commands exposed to the frontend (fs, …)
  src/menu/     native menu
  capabilities/ Tauri permissions (ACL)
```

## Security & privacy

Local-first: no network calls except the user-triggered update check. All filesystem/native I/O goes through declared
Rust commands (they accept any path the user's account can reach; restricting paths is planned
after 1.0); Tauri capabilities gate plugin and core
permissions only, and the frontend is **not** granted direct filesystem access. A restrictive Content-Security-Policy is enforced in the
WebView. See [ARCHITECTURE.md](./ARCHITECTURE.md) for details.

## Licensing

MIT — see [LICENSE](./LICENSE). Third-party dependencies keep their own
(permissive) licenses; the build generates a `THIRD-PARTY-NOTICES` file — see
[THIRD-PARTY-NOTICES](./THIRD-PARTY-NOTICES).

## Legal & privacy

- [LICENSE](./LICENSE) — MIT
- [PRIVACY.md](./PRIVACY.md) — privacy policy (local-first, no telemetry)
- [SECURITY.md](./SECURITY.md) — vulnerability-disclosure process
- [CONTRIBUTING.md](./CONTRIBUTING.md) — contributor guide
