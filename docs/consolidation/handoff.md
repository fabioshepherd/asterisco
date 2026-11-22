# Coordinator handoff — 2026-11-20

> **Historical record**, updated for publication on 2026-11-20. It was written in
> the project's previous repository, now kept as a private archive: commit
> hashes, PR numbers and branch names below refer to that repository. The
> current plan is [`docs/release-1.0.md`](../release-1.0.md); the public-repository
> design is [`docs/superpowers/specs/2026-11-20-public-repo-design.md`](../superpowers/specs/2026-11-20-public-repo-design.md).

## Release 1.0 — state on 2026-11-20 (read this first)

The consolidation is closed (below). Since then, with the owner:

| PR | What | State |
|---|---|---|
| #14 | release prep: `docs/release-1.0.md`, updater preflight fix | merged |
| #15 | product name: **Asterisco** (final 2026-11-20; `docs/naming.md`) | merged |
| #16 | logo + motion plan (`docs/brand/logo-e-animazioni.md`) | merged (`e8603f9`) |
| #17 | name applied; identifier `it.fabiopastore.asterisco`; repository renamed to `fabioshepherd/asterisco` | merged (`9662e63`) |
| #18 | app icons + favicon (asterisk on black tile, thin inner border `#484848`) | merged (`9b9c6c1`) |
| #19 | in-app About + `AppMark` (static), menu entry on all 3 platforms | merged (`b4a62ed`); owner device check ok |
| #20 | logo plan slice 3: fluid spring animations A1–A4, DESIGN.md exceptions E1–E4 | merged (`c6189d8`) |
| #21 | the owner's own updater key (id `7E06AE5B898C6E12`) and the 2026-11-20 decisions | merged (`d1553bb`) |

**Then (2026-11-20): a public repository.** The old repository was private, so
release downloads and the updater would have failed. The owner approved a plan
([design](../superpowers/specs/2026-11-20-public-repo-design.md)): clean the tree in
three slices (code, documents, open-source setup), then copy it as a single commit
into a new public `fabioshepherd/asterisco`; the old repository is kept, private, as
an archive.

**Remaining for 1.0, in order** (details in `docs/release-1.0.md`):
1. publish the cleaned tree as the new public repository and configure it
   (ruleset on `main`, secrets, private vulnerability reporting);
2. on the day of the tag: `bun run version:set 1.0.0 <date>` + `src-tauri/Cargo.lock`
   through a PR, dropping the "pre-1.0" line in `CHANGELOG.md`;
3. platform device checks (two-column list in `docs/release-1.0.md`), on a real build;
4. owner pushes `app-v1.0.0`, verifies the draft release, publishes.

**Practical notes for a coordinator:**
- Owner pattern: smoke test → "unisci" → coordinator marks the PR ready (so `bundle` runs), waits for green, merges with a merge commit. A docs-only PR may merge with `rust`/`bundle` skipped by rule.
- The `rust` job sometimes times out on the Ubuntu apt mirror ("Install Linux dependencies" > 10 min): infrastructure, one re-run.
- Owner decisions of 2026-11-20 are recorded in `docs/release-1.0.md` and `docs/brand/logo-e-animazioni.md`.

## Consolidation (closed 2026-11-19)

State of the 1.0 consolidation for a fresh coordinator session. The decisions files are the source of truth; this page is the map.

### Where we are

| Wave | State |
|---|---|
| 0 — safety net, baseline | merged (PR #8) |
| 1 — UX cuts | merged (PR #9) |
| 2 — UI + accessibility | merged (PR #10) |
| CI review | merged (PR #11) |
| 3 — code review | merged (PR #12 → `682b38b`); all items in `w3-decisions.md` executed, reviewed, verified |
| 4 — close | Tasks 8–10 done on `consolidation/wave-4` (see `w4-decisions.md`, `result.md`); verifier clean after one fix wave; owner smoke test passed; merged (PR #13 → `e017b0e`) |

### Release gates left after the consolidation

Product name (done 2026-11-20), the platform release smoke test in `docs/RELEASING.md` (repeat the platform checks from PR #12), then `bun run version:set 1.0.0 <date>` + `src-tauri/Cargo.lock`, and the `app-v1.0.0` tag. The up-to-date list is in `docs/release-1.0.md`.

### Wave 4 steps (done)

1. **Task 8** — remove unmeasured performance claims (`< 1s`, `150 MB`, `200 ms`, "instant", numeric "fast") from `PRODUCT.md`, `docs/ROADMAP.md`, `README.md`, the welcome document and `src/i18n/locales/*` (it + en). Mark the roadmap performance gate closed "by removing the claims (owner decision 2026-11-17)". Commit `docs: drop unmeasured performance targets from copy`.
2. **Task 9** — `docs/consolidation/result.md` (before/after table: Baseline vs After Wave 3 in `baseline.md`, re-run `bun scripts/consolidation-metrics.mjs` on the final tree, plus decisions taken per wave); update `PRODUCT.md`, `docs/ROADMAP.md` (Phase 2 done except name and platform smoke test), `ARCHITECTURE.md`, `README.md`; `CHANGELOG.md` 1.0 entry (Removed / Changed / Fixed, from w1/w2/w3 decisions); regenerate notices; prepare the version bump per `docs/RELEASING.md` — **no tag, no publish**.
3. **Task 10** — independent verifier on the wave diff, one fix wave, PR (draft → ready), owner smoke + merge.

### Owner items carried into the Wave 4 PR (closed)

- **Strings "da approvare"**: Wave 3 table at the end of `w3-decisions.md` (19 keys); earlier waves' strings in their decisions files. Approved by the owner on 2026-11-19 (W4-01 in `result.md`).
- **Manual device checks** listed in PR #12 (Ctrl+N/O/W/Q on Windows/Linux, Reading-view links, Open themes folder, Print, updater, list markers, Mermaid loading text, macOS symlink watcher, Windows trash) — owner smoke-tested Wave 3 before merge; repeat the platform ones at the release smoke test.
- **Later (not 1.0)** — list them in `result.md`/ROADMAP:
  - restrict custom Rust commands per window (app ACL manifest) and restrict file-command paths;
  - math inside Mermaid labels (needs a sanitizer decision);
  - setext headings and `1)` lists preserved on edited save (serializer limit);
  - files with mixed line endings are normalised on edited save (known limit in `gate-snapshot.md`);
  - search reports a skipped unreadable folder as "stopped at its limit" (needs a `skipped` field);
  - CODE-09 "later" upgrades (i18next 27, eslint 10 + react-hooks 7, jsdom 31, jest-axe 11 / jest-dom 7, TypeScript 7, vitest 5); never for 1.0: mermaid 12, @types/node > 22.

### Coordinator rulings in Wave 3 (owner may correct)

- No Ctrl+PageUp/Down tab switching added: CODE-03's premise said it existed; it does not (tabs: Ctrl+Tab MRU, palette, strip).
- All Format keys reserved: stored custom bindings on them drop at load (they double-fired off macOS).
- Palette uses menu labels and lists Quit/Close Tab/Help (one registry, CODE-05).
- SHELL-14 half (platform-chrome constant, event-names merge) skipped as churn.
- Cancel after the update download is silent (user chose cancel; a message would be new UI).
- KaTeX `overrides` kept: measured −76 KB gz (mermaid.core resolves bare `katex`).
- `rust-version` 1.91 (dependency tree needs it), `opt-level = "s"` release profile (measured).

### Owner preferences learned in this run

- Italian, one question at a time; near-identical items may be grouped.
- No patches to dependencies (`bun patch`); no axe-core; no new dependencies without asking.
- The owner smoke-tests each wave with `bun tauri dev`, then asks the coordinator to merge once CI is green (mark the draft PR ready first so `bundle` runs).
- Editing CI workflows or CLAUDE.md requires the owner's explicit words in chat, scoped to the change.
- "Decisions are already recorded: execute without re-asking" — ask only for what is genuinely new (authorisations, new strings).

### Practical notes for agents

- Local e2e must match CI's browser: free port 4173, remove `dist/`, then `bun run test:e2e` with the Playwright browser CI uses.
- Notices need cargo-about 0.9.3 with the CLI feature: `cargo install --locked --features cli cargo-about@0.9.3 --root <a folder outside the repo>`, then put its `bin` first on PATH and run `bun run notices`.
- Installer size: `bun tauri build --bundles deb` (several minutes; run in background).
- Scratch scripts go outside the repo (eslint scans the tree).
- Coordinator never edits product code; executors commit with Conventional Commits and the session trailers; reviewers get the diff as a file; one executor at a time on the shared working tree.
