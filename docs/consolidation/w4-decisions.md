# Wave 4 — decisions

> **Historical record** of the 1.0 consolidation (November 2026), closed on
> 2026-11-19. It was written in the project's previous repository, now kept as a
> private archive: commit hashes, PR numbers, branch names, `file:line`
> references and scripts cited here refer to that tree and may no longer exist.
> The current state is in [`docs/ROADMAP.md`](../ROADMAP.md) and
> [`CHANGELOG.md`](../../CHANGELOG.md).

Close of the 1.0 consolidation (plan Tasks 8, 9, 10). Branch `consolidation/wave-4` from `682b38b`.
No auditors this wave: the items are required by the spec (Wave 4 — Close) and executed as "how" only.

## Required

### V1-19 — Drop unmeasured performance claims from copy (plan Task 8)
- What: remove `< 1s`, `150 MB`, `200 ms`, "instant(ly)" and numeric "fast" claims from `PRODUCT.md`, `docs/ROADMAP.md`, `README.md`, the welcome document, `src/i18n/locales/*` (it + en) and the bundle description in `src-tauri/tauri.conf.json`; keep honest non-numeric voice. Roadmap performance gate closed "by removing the claims (owner decision 2026-11-17)".
- Why: spec Goals (cold start and idle RAM not measured — owner 2026-11-17); PRODUCT "never overclaim".
- Decision: approved (required) — owner 2026-11-17
- Done: 0403b2c. Welcome document and locales had no claims. Coordinator ruling 2026-11-19: PRODUCT.md "opens fast enough that reading a file here is cheaper than in the IDE" kept (non-numeric rationale; plan keeps honest non-numeric voice).

### V1-20 — Result and 1.0 preparation (plan Task 9)
- What: `docs/consolidation/result.md` (before/after metrics, decisions per wave, Later list); docs matched to the shipped app (`PRODUCT.md`, `docs/ROADMAP.md` — Phase 2 done except name and platform smoke test —, `ARCHITECTURE.md`, `README.md`); `CHANGELOG.md` 1.0 entry (Removed / Changed / Fixed); notices regenerated; version bump prepared per `docs/RELEASING.md`. No tag, no publish.
- Decision: approved (required) — spec, owner 2026-11-17
- Coordinator ruling 2026-11-19 (owner may correct): manifests stay at 0.5.1; the 1.0.0 entry is drafted under `## [Unreleased]` so the release is one command (`bun run version:set 1.0.0 <date>`), run at release time with the product-name decision as `docs/RELEASING.md` says.

### V1-21 — Independent verifier, PR, owner merge (plan Task 10)
- Decision: approved (required)
- Done: verifier clean after one fix wave (6e1e8c1, 3784caf); owner smoke test with `bun tauri dev` passed — owner 2026-11-19; CI green (`frontend`, `e2e`, `rust`, `bundle`); PR #13 merged into `main` as e017b0e — 2026-11-19.

## Owner decisions

### W4-01 — Approve the user-facing strings marked "da approvare"
- What: Wave 3 table in `w3-decisions.md` (19 keys) plus any string changed by V1-19 (listed below).
- Decision: approved (all 20) — owner 2026-11-19

### W4-02 — Bundle description claims "no network" (verifier finding 6)
- What: `src-tauri/tauri.conf.json` longDescription ends "no network", but the app has a user-triggered update check; README already says "no network except the update check you trigger".
- Decision: approved (align with README) — owner 2026-11-19

## Verifier fix wave (coordinator, no owner question)
CHANGELOG wording (mono reading font is global; image save rule applies to every image; search skip still reported as "stopped at its limit"; regex-engine tooltip removal listed); ROADMAP "PDF export" → print (UX-10).

## New user-facing strings

| location | en | it | item | status |
|---|---|---|---|---|
| `src-tauri/tauri.conf.json` `bundle.longDescription` | [the working name] opens a Markdown file and shows it as it will be read… (only "instantly" removed) | n/a (no it version) | V1-19 (0403b2c) | approved — owner 2026-11-19 |
| `src-tauri/tauri.conf.json` `bundle.longDescription` | …no account, no telemetry, no network except the update check you trigger. | n/a (no it version) | W4-02 | approved — owner 2026-11-19 |
