# Roadmap

What is built, what is next, and what was deliberately left out. This file
replaces `REQUISITI_EDITOR_MARKDOWN.md` (the original PRD), retired on
2026-08-17: the PRD was written for the previous positioning — "recreate and
surpass Typora" for long-form writers — and kept restating a vision that
`PRODUCT.md` now owns.

**Where things live now:**

| Question | Document |
|---|---|
| Who it is for, what it claims, what it refuses to become | `PRODUCT.md` |
| How it looks and why | `DESIGN.md`, `docs/THEMING.md` |
| How it is put together | `ARCHITECTURE.md` |
| Stack, conventions, rules of work | `CONTRIBUTING.md`, `CLAUDE.md` |
| How a release is cut | `docs/RELEASING.md` |
| What ships next | this file |

Priorities: **[Core]** shipped in the MVP · **[V1]** required for 1.0 ·
**[Plus]** differentiation after 1.0 · **[Future]** optional, later.

---

## Phase status

| Phase | Scope | State |
|---|---|---|
| 0 — Scaffold | Tauri 2 + React + TS + Vite, design tokens and theming, base Rust fs commands, persisted window state, native menus, i18n | **done** |
| 1 — MVP | Seamless WYSIWYG, full GFM, code blocks, tables, open/save, auto-save, file watcher, command palette, find & replace, word count, HTML export and print, file tree, tabs | **done** |
| 2 — V1.0 | Everything below under "Remaining for 1.0" | **done**; the last release gate, the device smoke test of `app-v1.0.0-rc.1`, runs before the `app-v1.0.0` tag |
| 3 — Plus | Slash commands, snippets, multi-cursor, sessions and pins, advanced statistics, visual theme editor, Pandoc, image assistant, light Git integration, Vim mode | not started |
| 4 — Future | Opt-in AI assistant, real-time collaboration (Yjs), wiki-links and backlinks, plugin system, mobile builds | not started |

Phase 4 items are **not shipped and must never be described as present**.

---

## Remaining for 1.0

Verified against the tree on 2026-08-17; atomic saves landed the same day.
Re-checked on 2026-11-19 at the close of the 1.0 consolidation
(`docs/consolidation/result.md`); updated on 2026-11-20: only the release
gates below remain open.
Everything not listed here that the PRD marked [V1] is implemented — including
theme-selectable export and footnote rendering in HTML export
and print, both of which older copy still lists as pending.

### Release gates

These block a public release. They were tracked in two audit files that were
removed from the published tree with the rest of the process material; the items
themselves were never closed, so they are restated here and live here now.

- **[V1] The product name — closed 2026-11-20.** The owner chose **Asterisco**
  (`docs/naming.md`). Applied: bundle name, window title, About label,
  welcome document, binary `asterisco`, identifier `it.fabiopastore.asterisco`,
  internal storage keys, the updater endpoint on `fabioshepherd/asterisco`, the
  logo, the app icons and the About dialog.
- **[V1] Publish from a public repository — closed 2026-11-22.** Release downloads and the updater
  need a public repository. Decided 2026-11-20: the cleaned tree becomes the
  first commit of a new public `fabioshepherd/asterisco`, with `main` protected
  by a ruleset (pull requests only, required checks `frontend`, `e2e`, `rust`,
  `bundle`). See `docs/release-1.0.md` and
  `docs/superpowers/specs/2026-11-20-public-repo-design.md`.
- **[V1] Smoke-test a real release on each platform.** Decided 2026-08-17:
  macOS ships unsigned, so the matrix now builds all five declared bundle
  targets across four jobs and nothing in `tauri.conf.json` goes unbuilt. What
  is untested is the output. `app-v1.0.0-rc.1` was cut on 2026-11-22 for this:
  run the device checklist in `docs/release-1.0.md` on its bundles before
  tagging `app-v1.0.0`.

### Quality gates

- **[V1] End-to-end test suite.** Landed: `bun run test:e2e` runs the Playwright
  suite in `e2e/` — open → edit → save, round trip, view switch, workspace
  search, command palette and HTML export — plus regression tests for the save
  race and the image-alt and definition-list round trips. No test is marked as
  an expected failure (`test.fail`); the defects they pinned were fixed in the
  consolidation's Wave 1.
- **[V1] Audit accessibility end to end, not surface by surface.** The three
  surfaces `PRODUCT.md` listed as deferred were checked on 2026-08-17: the file
  tree is a `role="tree"` with roving tabindex and arrow-key navigation, the
  context menu roves and now closes on Tab, and workspace search is a
  combobox/listbox. The keyboard walkthrough of a real session shipped as
  `e2e/a11y.spec.ts` (dependency-free, role- and computed-style-based). An
  automated axe pass was rejected by the owner (2026-11-18). The audit findings
  were fixed in Wave 2.
- ~~**[V1] Measure the performance targets, or stop implying them.**~~ Closed
  by removing the claims (owner decision 2026-11-17): cold start, idle RAM and
  large-file open times were never measured, so the targets were dropped from
  all user-facing copy and docs instead of being measured for 1.0.

### Menu gaps

Every item in the application menu was walked on 2026-08-18 — each command in
`src/app/menu/commands.ts` traced to a real implementation, each predefined role
to the surface that carries it. All of them act. What follows is what the walk
found missing around them.

- **File and app accelerators on Windows/Linux — done** (2026-11-18). New,
  Open, Open Folder, Save, Save As, Print, Close Tab and Quit are keymap
  bindings now: remappable in Settings, dispatched by the one window handler in
  `use-global-shortcuts` off macOS, registered as native key-equivalents on
  macOS (`keyEquivalent` in the menu model), and printed in the Windows/Linux
  menubar. `reserved-combos` is per platform: Ctrl+M and Ctrl+H are reserved
  only on macOS, where the OS menu owns them.
- **About surface on every platform — done** (2026-11-20). An in-app About
  dialog with the app mark, version, license line, the update check and the
  third-party notices, reachable from the menu on macOS, Windows and Linux.
- **[Plus] Menu items are never disabled.** The menu has no enabled state at
  all: Save with nothing dirty, Export with no document, Close Folder with no
  workspace and the Format items in reading or source mode all stay live and
  silently do nothing when chosen. Each guards itself correctly, so nothing
  breaks — but on a desktop menu, greyed-out *is* the answer to "can I do this
  now?", and every one of these items answers it by staying black and shrugging.
  Needs an `enabled` predicate per node in the model, honored by both the DOM
  menubar and the native spec.

### Later (not 1.0)

Recorded during the 1.0 consolidation (`docs/consolidation/`) and deliberately
left for after the release:

- Restrict the custom Rust commands per window (an app ACL manifest) and
  restrict the file commands to user-granted folders.
- A per-document (per-workspace) image scope instead of `$HOME/**`.
- Math inside Mermaid labels (needs a sanitizer decision).
- Keep setext headings and `1)` lists as written when an edited file is saved
  (serializer limit; an unedited file is never rewritten).
- A file with mixed line endings is normalised to its majority ending when it is
  edited and saved (known limit).
- Workspace search reports a skipped unreadable folder as "stopped at its
  limit" (needs a `skipped` field).
- Split the settings panel and its settings key table.
- `CrepeBuilder` instead of `Crepe` (about 12.9 KB gzip less) and trimming the
  bundled KaTeX fonts.
- Major upgrades: i18next 27, eslint 10 with react-hooks 7, jsdom 31,
  jest-axe 11 / jest-dom 7, TypeScript 7, vitest 5. Not for 1.0 at all:
  mermaid 12, `@types/node` beyond 22.
- From the Wave 1 review: an Open Recent submenu, disabled menu states (see
  the menu gaps above), relaunch after an update, reveal in Finder/Explorer.

---

## Retarget review

Closed on 2026-08-17. Every requirement inherited from the previous positioning
has now had its product call, so nothing here is pending — the section stays as
the record of what was decided and why, so the same questions are not reopened
by accident.

- **Focus mode and typewriter mode — removed** (2026-08-08). Long-form writing
  aids; the typewriter also moved the page on the typing path. Do not
  reintroduce them without revisiting the positioning.
- **"Zen mode" with long-reading typography and adjustable measure — dropped.**
  Never built. Reading view and distraction-free already cover legibility; a
  third variant would have overlapped both without serving someone who opens a
  README, fixes a line and closes.
- **Writing goals / word-goal progress — dropped.** Never built. A daily word
  target serves someone writing a book, not someone correcting an ADR.
- **Preset themes — removed** (2026-11-18). Each preset only seeded the
  neutral, accent and font controls shown right below it; one card carried the
  placeholder name and another the warm-paper look DESIGN rejects. The three
  controls stay.
- **Welcome document — already retargeted** (`4bc7cdc`). It opens on the
  Markdown a codebase is made of, carries a shortcut table, a TypeScript block
  and a diagram, and deliberately leaves out display math.

---

## Non-functional requirements

These carry over unchanged; they are commitments, not roadmap items.

- **Performance** — no UI-thread blocking during I/O or export. No speed or
  memory figures are claimed: the unmeasured targets were dropped by owner
  decision (2026-11-17, see the quality gate above).
- **Accessibility** — WCAG 2.2 AA: full keyboard navigation, always-visible
  focus, correct ARIA on custom UI, conforming contrast in every theme,
  `prefers-reduced-motion` and `prefers-color-scheme` honored, text scalable
  without breaking layout.
- **Security and privacy** — local-first, all I/O through declared Rust commands (Tauri capabilities gate plugin and core permissions only),
  restrictive CSP, sanitized HTML rendering, no telemetry.
- **Cross-platform** — macOS (Apple Silicon + Intel), Windows 10/11, Linux
  (AppImage + .deb). Platform-specific behaviour stays encapsulated. Mobile is
  Phase 4.
- **Internationalization** — Italian and English at parity, structure ready for
  more.
- **Code quality** — TypeScript strict, ESLint + Prettier, clippy + rustfmt,
  feature-based architecture, Conventional Commits.
