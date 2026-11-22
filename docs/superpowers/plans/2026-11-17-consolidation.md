# Consolidation to 1.0 — Coordinator Plan

> **Historical record** of the 1.0 consolidation (November 2026), closed on
> 2026-11-19. It was written in the project's previous repository, now kept as a
> private archive: commit hashes, PR numbers, branch names, paths and scripts
> cited here refer to that tree and may no longer exist. The results are in
> [`docs/consolidation/`](../../consolidation/result.md); the current state is in
> [`docs/ROADMAP.md`](../../ROADMAP.md).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thin out and simplify the app and close 1.0 — solid, simple, fast — through owner-approved waves of specialist agents.

**Architecture:** One coordinator session runs five sequential waves (0–4). In each wave read-only auditors write findings, the coordinator condenses them into a decisions file and asks the owner one question at a time, executors implement only approved items (one item = one small commit series), and an independent verifier checks the wave before its PR is merged.

**Tech Stack:** Tauri 2, React 19, TypeScript strict, Vite, Milkdown/Crepe, CodeMirror 6, Zustand, Tailwind 4, i18next, Vitest, Playwright, bun, cargo.

**Spec:** `docs/superpowers/specs/2026-11-17-consolidation-design.md` — read it before anything else; this plan argues from it.

## How to launch

Start the coordinator session on this repository with:

> Sei il coordinatore del consolidamento. Leggi `CLAUDE.md`, la spec
> `docs/superpowers/specs/2026-11-17-consolidation-design.md` e questo piano
> `docs/superpowers/plans/2026-11-17-consolidation.md`, poi esegui il piano
> un'ondata alla volta con subagenti. Non modificare codice di prodotto tu stesso.
> Fammi una domanda alla volta, in italiano. Se esiste `docs/consolidation/`,
> riprendi dallo stato registrato nei file decisions.

## Global Constraints

- The coordinator never edits product code itself: it dispatches, condenses, asks, records.

- Guiding rule: *keep it simple, less is more* — in the product and in the process. When two options are equal, pick the one with less code, fewer deps, fewer surfaces.
- Target: **1.0**. Every remaining `[V1]` item in `docs/ROADMAP.md` for a kept feature is required, not optional.
- **No user-visible feature is removed without the owner's explicit approval** recorded in a decisions file.
- No new features. Additions only to make a kept feature correct; anything else goes to the decisions file under "later".
- Out of scope: the product name, the platform release smoke test, changing the stack.
- Performance: cold start and idle RAM are **not measured**; unmeasured targets are removed from all copy. Only static numbers are measured.
- Everything in `CLAUDE.md` binds every agent: bun; fs only via Rust commands; design tokens only; i18n it+en, no hardcoded strings; WCAG 2.2 AA; MIT-compatible deps; Conventional Commits, one logical change per commit; read current official docs before using an API; ask the owner before a major dependency or architecture change.
- Owner communication in **Italian**, **one question at a time**; near-identical items may share one question. Code, commits, docs, PRs in English.
- Any "best practice" claim names its source (URL + date read); otherwise it is labeled "opinion".
- Gates are relative to the Wave 0 snapshot: nothing that passed may start failing.

## Review Focus

1. **Existing user settings after a cut** — a persisted setting/keybinding/recent entry referring to a removed feature must not break startup or the settings panel. Owned by Task 3 (migration test per cut).
2. **i18n orphans and gaps** — removing a feature must remove its `it` and `en` keys together; no key used in code may be missing in either locale. Owned by Task 3 and the verifier (Task 10).
3. **Dangling entry points** — a removed feature still reachable from menu, command palette, keymap, context menu, drop handler or capability. Owned by Task 3 (grep checklist) and Task 10.
4. **Files on disk stay untouched** — no cut or refactor changes how an existing `.md` is read or written (byte-for-byte round trip of unedited files). Owned by Task 1 (e2e round-trip test).
5. **Docs overclaim** — copy describing a removed feature or an unmeasured number survives in `README.md`, `PRODUCT.md`, the welcome document or UI strings. Owned by Task 9.

---

## Shared definitions

**Decisions file format** — `docs/consolidation/<wave>-decisions.md`, one entry per item:

```markdown
### <ID> — <short title>
- What: <one line>
- Why: <principle from PRODUCT.md/DESIGN.md, or source URL>
- Cost/benefit: <LOC, deps, bytes, user impact>
- Risk: <what could break>
- Options: <only if real alternatives; mark the recommended one>
- Recommendation: keep | cut | simplify | fix
- Decision: pending | approved (<option>) | rejected | later
```

IDs: `UX-01…`, `UI-01…`, `CODE-<area>-01…`, `V1-01…` (required items).

**Auditor brief template** (fill `<…>`; every auditor is read-only):

```
You are a <ROLE>, expert in <FIELD>, applying current best practice (2026).
Project: read CLAUDE.md, PRODUCT.md, DESIGN.md, docs/ROADMAP.md, ARCHITECTURE.md,
and the spec docs/superpowers/specs/2026-11-17-consolidation-design.md.
Guiding rule: keep it simple, less is more. Target: 1.0.
Scope: <PATHS / SURFACES>. Focus: <FOCUS>.
Do NOT edit any file except your findings file docs/consolidation/<FILE>.
For each finding: what, where (file:line), why (cite PRODUCT/DESIGN principle or an
authoritative source with URL), cost/benefit, risk, recommendation
(keep/cut/simplify/fix). Prefer removing over adding. Max 25 findings, ranked by
impact; merge trivial ones. Read current official docs where you judge an API use.
```

**Executor brief template**:

```
Implement exactly decision <ID> from docs/consolidation/<wave>-decisions.md
(approved option: <OPTION>). Read CLAUDE.md and the spec first.
Smallest diff that does it; no unrelated refactors. Conventional Commits.
Before finishing run: bun run typecheck && bun run lint && bun run test &&
bun run test:e2e, plus the Rust command in CLAUDE.md if src-tauri changed.
Report: commits, files touched, gate results (paste the summary lines).
```

**Verifier brief** (Task 10, reused at the end of every wave).

**Wave procedure** (every wave): branch `consolidation/wave-<n>` from the up-to-date default branch → auditors (parallel) → coordinator writes decisions file → owner Q&A one at a time, recording each answer immediately → executors per approved item (parallel only when their files don't overlap) → verifier → push, open PR, ask the owner to merge → next wave starts from the merged default branch.

---

## Wave 0 — Safety net and baseline

### Task 1: Gate snapshot and minimal e2e

**Files:**
- Create: `docs/consolidation/gate-snapshot.md`
- Create: `e2e/` (specs), `playwright.config.ts`, an `invoke` mock module under `e2e/support/`
- Modify: `package.json` (`test:e2e` script), `.github/workflows/ci.yml` (run e2e on Linux)

**Interfaces:**
- Produces: `bun run test:e2e` runs real Playwright specs; `docs/consolidation/gate-snapshot.md` listing each gate as pass/fail with the failing items.

- [ ] **Step 1: Snapshot gates** — run typecheck, lint, test, the Rust command, and an it/en key-parity check; check `bun tauri dev` console if a display is available, else note "not checked". Write `gate-snapshot.md`. Each pre-existing failure becomes a `V1-xx` or `UX-xx` candidate for Wave 1.
- [ ] **Step 2: Propose the harness to the owner** — after reading current Playwright and Tauri 2 testing docs, propose: Playwright driving the Vite frontend with `window.__TAURI_INTERNALS__`/`invoke` mocked in-memory (recommended), vs `tauri-driver` WebDriver. Include license check of any new dev dependency. Wait for approval.
- [ ] **Step 3: Write the failing specs** — `e2e/core.spec.ts` with:
  - `open edit save` — open a fixture `.md`, type a line, save; mock fs receives the new content.
  - `unedited round trip` — open `fixtures/roundtrip.md` (front matter, table, code block, math, mermaid, definition list), save without edits; written bytes equal input.
  - `view switch` — edit → reading → source → edit keeps content.
  - `workspace search` — query returns the fixture hit.
  - `command palette` — opens with keyboard, runs "toggle reading view".
  - `export html` — produces sanitized HTML with `<html lang>` matching locale.
- [ ] **Step 4: Run, see failures, implement mocks/config until green.** Run: `bun run test:e2e` — Expected: 6 passed.
- [ ] **Step 5: Wire CI** — e2e job on `ubuntu-latest` in `ci.yml`.
- [ ] **Step 6: Commit** — `test(e2e): add Playwright core-flow suite` (and `ci:` commit separately).

### Task 1b: Patch and minor dependency updates

Runs after Task 1 (needs the e2e net), before Task 2's baseline (so the baseline
reflects current versions).

**Files:** `package.json`, `bun.lock`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, code only where a changelog requires it.

- [ ] **Step 1: Inventory** — list every npm and cargo dependency with installed vs latest stable (`bun outdated`, `cargo update --dry-run` / crates.io). Classify patch / minor / major. Stay on the installed major for everything; Tauri stays on 2.x (3.x is alpha). Write the table to `docs/consolidation/deps.md`; majors are listed there as Wave 3 candidates, not touched now.
- [ ] **Step 2: Read the changelogs** of every minor bump for the libraries `CLAUDE.md` flags as fast-moving (Milkdown/Crepe, Tauri 2 + plugins, Tailwind 4, Vite) before bumping. Keep Tauri JS packages and Rust crates on matching minors.
- [ ] **Step 3: Update in small groups** (Tauri JS+Rust; editor: Milkdown/CodeMirror; build: Vite/Tailwind/ESLint plugins; the rest), running all gates after each group. One commit per group: `build(deps): update <group> to latest minor`.
- [ ] **Step 4: Regenerate notices** (`bun run notices`) and confirm no new license is copyleft.

### Task 2: Doc reconciliation and baseline numbers

**Files:**
- Modify: `PRODUCT.md`, `docs/ROADMAP.md` (contradictions only)
- Create: `docs/consolidation/baseline.md`, `scripts/consolidation-metrics.mjs`

**Interfaces:**
- Produces: `bun scripts/consolidation-metrics.mjs` prints a markdown table — JS/CSS bundle bytes (raw + gzip) from `vite build`, npm direct/total deps, cargo direct/total deps, LOC per `src/*` and `src/features/*` and `src-tauri/src` (tests excluded), test count; installer size if a Linux bundle was built. Reused in Task 9.

- [ ] **Step 1: Reconcile docs** — fix contradictions between `PRODUCT.md`, `docs/ROADMAP.md` and the code (e.g. atomic writes pending vs landed; version 0.5.0 vs 0.5.1). Facts only, no new claims. Commit `docs: reconcile product brief with roadmap`.
- [ ] **Step 2: Write the metrics script** (Node, no new deps), run it, save output into `baseline.md` with date and commit SHA. Commit `chore(consolidation): record baseline metrics`.
- [ ] **Step 3: Verifier (Task 10), PR, owner merge.**

---

## Wave 1 — UX audit and cuts

### Task 3: UX audit → decisions → cuts

**Files:**
- Create: `docs/consolidation/w1-ux-findings.md`, `docs/consolidation/w1-cost-findings.md`, `docs/consolidation/w1-decisions.md`
- Modify: whatever each approved cut touches

**Interfaces:**
- Consumes: `gate-snapshot.md`, `baseline.md`, metrics script.
- Produces: approved cuts merged; `w1-decisions.md` complete.

- [ ] **Step 1: Dispatch two auditors in parallel.**
  - *Product/UX auditor* — role "senior product designer for desktop developer tools and document editors". Scope: every `src/features/*`, editor modes, settings surface, menus, palette entries, welcome, flows (open, save, workspace, tabs, split, import, export, themes/custom CSS, updater). Focus: what to cut or simplify against `PRODUCT.md` (principles, anti-references, "beside the IDE", "one column, never two"); interaction friction; desktop conventions (cite Apple HIG / Fluent / GNOME HIG). Must examine: importers (`mammoth`, `pdfjs-dist`, `turndown`), DOCX export (`markdown-docx`, `fflate`), `src/features/split`, `motion`, `dnd-kit`, settings size. Output `w1-ux-findings.md`.
  - *Cost auditor* — role "frontend performance and dependency engineer". For each feature: LOC, deps it alone pulls, bundle bytes attributable (via `vite build` + rollup visualizer output or manual chunk analysis, no committed new deps). Output `w1-cost-findings.md`.
- [ ] **Step 2: Coordinator writes `w1-decisions.md`** — merge both files plus gate-snapshot failures; add `V1-xx` entries for required roadmap items concerning kept features (decided as "how", not keep/cut). Order by impact.
- [ ] **Step 3: Owner Q&A** — one question at a time, in Italian, each with recommendation; record each answer before the next question.
- [ ] **Step 4: One executor per approved cut.** Executor brief plus this checklist per cut:
  - remove code, tests, fixtures, i18n keys in **both** `it` and `en`;
  - remove menu model nodes, palette commands, keymap defaults, context-menu items, drop handlers;
  - remove Rust commands, capability entries and Rust deps used only by it;
  - remove the npm dep (`bun remove`) and regenerate notices (`bun run notices`) if available;
  - add a settings migration + test: a persisted store containing the removed setting/keybinding loads without error and drops it (test name `migrates away <feature> settings`);
  - grep for the feature's name/keys across `src`, `src-tauri`, docs — zero hits except CHANGELOG;
  - update `README.md`/`PRODUCT.md` capability lists.
- [ ] **Step 5: Re-run metrics script**, append "after Wave 1" to `baseline.md`.
- [ ] **Step 6: Verifier (Task 10), PR, owner merge.**

---

## Wave 2 — UI review

### Task 4: UI and accessibility review → decisions → fixes

**Files:**
- Create: `docs/consolidation/w2-ui-findings.md`, `docs/consolidation/w2-a11y-findings.md`, `docs/consolidation/w2-decisions.md`
- Create: `e2e/a11y.spec.ts`
- Modify: per approved item

- [ ] **Step 1: Dispatch two auditors in parallel.**
  - *Design-system reviewer* — role "senior UI designer, design systems on Radix Colors". Scope: `src/components`, `src/app/chrome`, every feature UI, `src/styles`. Focus: conformance to `DESIGN.md` and `docs/THEMING.md`; token misuse; chrome that hasn't earned its pixels; inconsistent primitives (two of the same thing); motion on the typing path; light/dark and every accent/neutral. Run the app UI via Vite + Playwright screenshots (deviceScaleFactor 1) for evidence.
  - *Accessibility reviewer* — role "accessibility specialist, WCAG 2.2 AA, WAI-ARIA APG". Focus: keyboard walkthrough of a real session, focus visibility, ARIA on custom widgets vs APG patterns, contrast (respect `src/styles/contrast.test.ts` rules), reduced motion, text scaling. Write `e2e/a11y.spec.ts` running axe (`@axe-core/playwright`, MPL-2.0 — owner approval needed as dev dep) over: welcome, editor (edit/reading/source), file tree, search, palette, settings, each dialog.
- [ ] **Step 2: Coordinator writes `w2-decisions.md`, owner Q&A one at a time.** a11y defects in kept surfaces are `V1-xx` (required); only *how* is asked.
- [ ] **Step 3: Executors per approved item; `e2e/a11y.spec.ts` expected: 0 serious/critical violations.**
- [ ] **Step 4: Verifier (Task 10), PR, owner merge.**

---

## Wave 3 — Code review

### Task 5: Area audits (parallel, read-only)

**Files:**
- Create: `docs/consolidation/w3-<area>-findings.md` for each area below; `docs/consolidation/w3-decisions.md`

- [ ] **Step 1: Dispatch seven auditors in parallel** with the auditor template:

| Area | Role | Scope | Focus |
|---|---|---|---|
| `editor` | Milkdown/ProseMirror & CodeMirror 6 expert | `src/editor` | API use vs current docs for installed versions, plugin count, typing-path cost, lazy loading of KaTeX/Mermaid |
| `shell` | React 19 + Zustand architect | `src/app`, `src/stores`, `src/lib` | store shape, duplicated state, effects that should be events/derived, startup path |
| `features` | senior React engineer | `src/features`, `src/components` | dead code, duplicated primitives, oversized components (settings, file-tree, tabs) |
| `rust` | Rust + Tauri 2 engineer | `src-tauri` | command surface vs what frontend still uses, error handling, fs_policy, idioms |
| `security` | application security engineer (OWASP, Tauri 2 security guide) | capabilities, CSP, sanitization, updater, open_with | least privilege, unused permissions, sanitize paths |
| `build` | build & dependency engineer | `package.json`, `Cargo.toml`, `vite.config.ts`, CI | unused/duplicate deps (e.g. `marked` vs remark stack), chunking, CI time, notices generation; **major upgrades** from `docs/consolidation/deps.md` for surviving deps, one decision each with migration cost and source (release notes) — first `@tanstack/highlight` 0.0.9 → stable 1.x if it survives |
| `tests` | test engineer | all tests, e2e | coverage of core logic, brittle/duplicate tests, gaps in Review Focus items |

- [ ] **Step 2: Coordinator writes `w3-decisions.md`.** Add required `V1-xx`: File/app accelerators off macOS wired through the keymap and hints restored via `DISPATCHED_ACCELERATORS` in `AppMenubar`; `reserved-combos` correct per platform (see `docs/ROADMAP.md` "Menu gaps"). Cross-area duplicates merged; conflicts between auditors presented as options.
- [ ] **Step 3: Owner Q&A one at a time.**

### Task 6: Execute required V1 menu items

**Files:** `src/app/menu/*`, keymap defaults, `use-global-shortcuts`, `AppMenubar`, reserved-combos module and their tests.

- [ ] **Step 1: Failing tests** — `dispatches mod+n/mod+o/... on windows and linux` (each `MENU_MODEL` accelerator for New, Open, Open Folder, Save As, Close, Quit resolves to its command off macOS); `reserved combos match platform owners`.
- [ ] **Step 2: Implement via the keymap** so they are remappable; restore menubar hints.
- [ ] **Step 3: Gates green; commit** `fix(menu): dispatch File accelerators on Windows and Linux`.

### Task 7: Execute approved code items

- [ ] **Step 1: One executor per approved item**, parallel only across non-overlapping files; serial within `src/stores` and `src/editor`.
- [ ] **Step 2: Verifier (Task 10), PR, owner merge.**

---

## Wave 4 — Close

### Task 8: Remove unmeasured performance claims

**Files:** `PRODUCT.md`, `docs/ROADMAP.md`, `README.md`, welcome document, `src/i18n/locales/*`

- [ ] **Step 1:** grep for `< 1s`, `150 MB`, `200 ms`, "instant", "instantly", "fast" claims with numbers, in it and en. Remove numeric performance claims; keep non-numeric voice where honest. Mark the roadmap performance gate closed "by removing the claims (owner decision 2026-11-17)".
- [ ] **Step 2: Commit** `docs: drop unmeasured performance targets from copy`.

### Task 9: Result and 1.0 preparation

**Files:** `docs/consolidation/result.md`, `PRODUCT.md`, `docs/ROADMAP.md`, `ARCHITECTURE.md`, `README.md`, `CHANGELOG.md`, `THIRD-PARTY-NOTICES`

- [ ] **Step 1:** run metrics script; write `result.md` before/after table (baseline vs now) plus list of decisions taken per wave.
- [ ] **Step 2:** update docs to the shipped app; `CHANGELOG.md` gets the 1.0 entry (Removed / Changed / Fixed). Roadmap: Phase 2 done except name and platform smoke test.
- [ ] **Step 3:** regenerate notices; prepare the version bump per `docs/RELEASING.md` on the branch — **do not tag or publish**.
- [ ] **Step 4: Verifier (Task 10), PR, owner merge.**

---

### Task 10: Verifier (reused at the end of every wave)

Dispatch a fresh agent, not told the executors' conclusions:

```
You are an independent reviewer. Read CLAUDE.md, the spec, and
docs/consolidation/<wave>-decisions.md. Review the diff of branch
consolidation/wave-<n> against the default branch.
Check: (1) every approved item is done and nothing unapproved is in the diff;
(2) no user-visible feature removed without an approved entry;
(3) gates vs docs/consolidation/gate-snapshot.md — run typecheck, lint, test,
test:e2e, the Rust command; nothing that passed now fails;
(4) Review Focus of the plan: settings migration, it/en key parity and orphans,
dangling entry points (menu, palette, keymap, context menu, capabilities),
unedited-file round trip, docs overclaim.
Report only real problems with file:line and the evidence.
```

- [ ] **Step 1:** dispatch; fix reported problems via executors; re-run until clean.
