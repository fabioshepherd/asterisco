# Consolidation — design

> **Historical record** of the 1.0 consolidation (November 2026), closed on
> 2026-11-19. It was written in the project's previous repository, now kept as a
> private archive: commit hashes, PR numbers, branch names, paths and scripts
> cited here refer to that tree and may no longer exist. The results are in
> [`docs/consolidation/`](../../consolidation/result.md); the current state is in
> [`docs/ROADMAP.md`](../../ROADMAP.md).

Date: 2026-11-17 · Status: approved by the owner, executed and closed (2026-11-19) · Target: 1.0

## Intent

Thin out and simplify the app to close **1.0**: a version that is **solid, simple and
fast**. Guiding rule: *keep it simple, less is more* — in the product and in the
process. The work is run by one **coordinator session** that dispatches
specialist agents, each an expert in its field, following current best practice
and checking authoritative sources (official docs, WCAG, platform HIGs, OWASP,
Tauri security guide) when memory may be stale.

## Goals

- Fewer features, fewer dependencies, fewer lines — every survivor earns its
  place against `PRODUCT.md`'s principles.
- A measured "lighter": static numbers before and after (bundle, installer,
  dependencies, LOC). Cold start and idle RAM are **not measured** (owner's
  decision); instead the unmeasured performance targets are removed from all
  user-facing copy and docs, which closes the roadmap's performance gate the
  "stop implying them" way.
- A safety net (minimal e2e) so cuts and refactors don't silently break the core
  flows.
- Documentation (`PRODUCT.md`, `docs/ROADMAP.md`, `ARCHITECTURE.md`,
  `README.md`, `CHANGELOG.md`) that matches the code at the end.

## Non-goals

- New features. Anything an agent wants to *add* goes to a "later" list, except
  what is needed to make a kept feature correct (e.g. the Windows/Linux File
  accelerators in `docs/ROADMAP.md`).
- Choosing the product name; the platform release smoke test. Both stay open in
  the roadmap as release gates outside this work.
- Changing the stack (Tauri 2, React 19, Milkdown/Crepe, CodeMirror 6, Zustand,
  Tailwind 4).

## Anti-goals (a failure even if it "works")

- A feature removed without the owner's explicit approval.
- A rewrite disguised as a cleanup; diffs that mix unrelated changes.
- A regression in a core flow (open → edit → save, reading view, search,
  export to HTML/PDF), in accessibility, in it/en parity, or in local-first
  guarantees.
- Reports so long the owner cannot decide from them.

## Constraints

Everything in `CLAUDE.md` holds for every agent: bun; typecheck + lint + tests
green after each series of changes; Rust check command; Conventional Commits,
one logical change per commit; i18n it/en; design tokens only; fs only via Rust
commands; MIT-compatible dependencies; ask before major dependency or
architecture changes; read current official docs before using an API.

## Approaches considered

- **A. Sequential waves, each closed by owner approval — chosen.** Nothing is
  reviewed that will later be cut; each wave works on less code than the last;
  the owner stays in control.
- B. Audit everything in parallel, approve once — faster, but much of the code
  review would target features later cut, and the single report would be huge.
- C. One vertical slice per feature (UX+UI+code together) — easy to coordinate,
  but loses cross-cutting coherence (design system, stores, shared deps).

## How it runs

### Roles

- **Coordinator** (the session the owner launches): dispatches agents, merges
  their reports into short decision files, asks the owner **one question at a
  time**, never edits product code itself.
- **Auditors**: read-only. Produce a findings file; propose, never change.
- **Executors**: one per approved item. Small diff, own commits, gates green.
- **Verifier**: after each wave, an independent agent checks the wave's diff
  against its approved list and the gates (not anchored on the executors'
  summaries).

### Decision flow

1. Auditors write `docs/consolidation/<wave>-findings.md`.
2. Coordinator condenses into `docs/consolidation/<wave>-decisions.md`: one
   entry per item — what, why (principle cited), cost/benefit, risk, the
   auditor's recommendation. Where there are real alternatives, 2–3 options with
   a recommended one.
3. Coordinator asks the owner item by item (one question at a time) and records
   *approved / rejected / later* in the file.
4. Only approved items are executed.

*Coordinator's calls (owner may correct):* the decisions files are the state —
the run is resumable across days and sessions. Near-identical items may be
decided in one question (e.g. "cut all three importers"). Executors may start on
approved items while other questions in the same wave are still open.

### Git

One branch per wave off the default branch, one PR per wave; merging the PR is
the wave's gate. Each item is its own commit (or small series). Next wave starts
from the merged result.

### Research rule

When an agent cites "best practice" it names the source (URL + date read).
Prefer: official library docs for the installed version, W3C/WCAG 2.2, Apple
HIG / Microsoft Fluent / GNOME HIG for desktop conventions, Tauri 2 security
docs, OWASP. No source → it's an opinion and is labeled as one.

## Waves

### Wave 0 — Safety net and baseline

- **Doc reconciliation (small):** fix contradictions between `PRODUCT.md`,
  `docs/ROADMAP.md` and the code (e.g. atomic writes listed as pending in
  `PRODUCT.md` but landed per the roadmap; version 0.5.0 vs 0.5.1), so later
  agents reason from one truth.
- **Minimal e2e:** wire Playwright for the core flows only — open → edit →
  save, reading/source/edit switch, workspace search, command palette, HTML
  export. The executor picks the harness after reading current Tauri 2 testing
  docs (WebDriver vs driving the Vite frontend with mocked `invoke`), and
  proposes it to the owner before building (it is a dependency/architecture
  call). *Coordinator's call:* default to Playwright driving the Vite frontend
  with mocked `invoke`, run in CI on Linux (simple, fast); the Rust side is
  covered by `cargo test` on the commands themselves.
- **Gate snapshot:** record which gates already fail before any change (lint,
  clippy, console errors, it/en parity — e.g. the Crepe slash menu and link
  tooltip are not localized). *Coordinator's call:* gates mean "no new
  regressions"; each pre-existing failure becomes a Wave 1 decision item
  (fix, or cut the surface that causes it).
- **Dependency refresh (patch/minor only):** after the e2e net and before
  the baseline, bring every dependency to the latest patch/minor of its
  installed major; Tauri stays on 2.x. Majors are inventoried in
  `docs/consolidation/deps.md` and decided in Wave 3, after the cuts, so
  nothing is upgraded only to be removed.
- **Baseline:** `docs/consolidation/baseline.md` with measured numbers and how
  they were measured: production JS/CSS bundle size, installer size (Linux
  build reachable in CI/container), npm and cargo dependency counts, LOC per
  area, test count and runtime. No cold start / RAM measurement.

### Wave 1 — UX audit and cuts

- **Agents:** a product/UX auditor (desktop document editors, developer
  tooling); a dependency-weight auditor supporting it with the cost of each
  feature (LOC, deps, bundle bytes).
- **Scope:** every feature in `src/features`, editor modes, settings surface,
  menus, command palette entries, onboarding/welcome, flows (open, save,
  workspace, tabs, split, import, export, themes/custom CSS, updater).
- **Output:** a cut list judged against `PRODUCT.md` (principles, anti-references,
  "beside the IDE") and the guiding rule. Each candidate: keep / cut / simplify,
  with evidence. Known candidates to examine (not conclusions): import (DOCX via
  `mammoth`, PDF via `pdfjs-dist`, HTML via `turndown`), DOCX export
  (`markdown-docx`, `fflate`), split editor vs "one column, never two",
  `motion`, `dnd-kit`, the size of settings (~2.4k LOC).
- **Execution:** one executor per approved cut: remove code, tests, i18n keys,
  menu/palette/keymap entries, capabilities and Rust commands that only served
  it, the dependency, and doc mentions. Settings migration so a removed setting
  in an existing user store does not break startup.

### Wave 2 — UI review

- **Agents:** a visual/design-system reviewer (against `DESIGN.md`,
  `docs/THEMING.md`); an accessibility reviewer (WCAG 2.2 AA, keyboard
  walkthrough, axe over assembled views via the Wave 0 harness).
- **Output:** inconsistencies, chrome that hasn't earned its pixels, token
  misuse, contrast/focus/ARIA defects, motion on the typing path. Simplify-first
  proposals; same decision flow.

### Wave 3 — Code review

Parallel auditors, one per area, on the post-cut tree:

| Area | Focus |
|---|---|
| Editor (`src/editor`) | Milkdown/Crepe and CodeMirror usage vs current docs, plugin count, typing-path cost |
| Shell and state (`src/app`, `src/stores`, `src/lib`) | store shape, duplication, effects, startup path |
| Features (`src/features`, `src/components`) | dead code, duplicated primitives, component size |
| Rust (`src-tauri`) | command surface, error handling, fs policy, clippy-clean idioms |
| Security | capabilities/ACL minimality, CSP, HTML sanitization, updater |
| Build and deps | unused/duplicate deps, bundle splitting, lazy loading of heavy deps (mermaid, KaTeX), CI; major upgrades of surviving deps (one decision each) |
| Tests | coverage of core logic, brittle/duplicate tests, e2e gaps |

**Required (target is 1.0):** every remaining `[V1]` item in `docs/ROADMAP.md`
that concerns a kept feature — File accelerators off macOS, `reserved-combos`,
the e2e suite, the accessibility audit, and closing the performance gate by
removing the unmeasured targets from copy (`PRODUCT.md`, `docs/ROADMAP.md`,
`README.md`, any UI string). These are not
put to the owner as keep/cut; only *how* is. Same decision flow for the rest;
executors one per approved item.

### Wave 4 — Close

Re-measure the baseline into `docs/consolidation/result.md` (before/after
table); update `PRODUCT.md`, `docs/ROADMAP.md`, `ARCHITECTURE.md`, `README.md`,
`CHANGELOG.md` (written as the 1.0 entry); regenerate third-party notices;
prepare the 1.0 version bump per `docs/RELEASING.md`. Tagging and publishing
wait on the remaining release gates (name, platform smoke test).

## Gates (every wave)

Relative to the Wave 0 gate snapshot: nothing that passed may start failing.

`bun run typecheck`, `bun run lint`, `bun run test`, the e2e suite (from Wave 0
on), the Rust command from `CLAUDE.md`, no new console errors, it/en parity,
and a verifier pass.

## Left to the builder

The exact agent prompts, how many auditors per wave within the "keep it small"
rule, the e2e harness choice (proposed to the owner), and the format details of
findings/decisions files.
