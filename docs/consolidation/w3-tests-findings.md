# Wave 3 findings: tests

> **Historical record** of the 1.0 consolidation (November 2026), closed on
> 2026-11-19. It was written in the project's previous repository, now kept as a
> private archive: commit hashes, PR numbers, branch names, `file:line`
> references and scripts cited here refer to that tree and may no longer exist.
> The current state is in [`docs/ROADMAP.md`](../ROADMAP.md) and
> [`CHANGELOG.md`](../../CHANGELOG.md).

Auditor: test engineer. Scope: vitest (120 files), `e2e/`, cargo tests. Read-only; scratch work in the scratchpad (`w3-tests/`).

## Measurements (2026-11-18, this sandbox, branch consolidation/wave-3)

| Suite | Result | Time |
| --- | --- | --- |
| vitest | 120 files, 1063 tests, 0 failed | 52 s wall (tests 26 s; import 35 s and environment 61 s are summed across workers). Slowest files 1.0-2.4 s each (WorkspaceSearch, SettingsPanel, footnotes, AppMenubar), nothing dominant |
| e2e (Playwright 1.63, headless shell) | 41 passed, 0 flaked, 0 retries | 52 s including `bun run build` (specs run ~1-2.5 s each) |
| cargo test | 43 `#[test]` in the lib target, all pass; 0 in the other targets | 14 s (warm) |

Notes: gate-snapshot recorded 135 files / 1118 tests (Wave 0); 120 / 1063 after the cuts, consistent. `it.skip`, `.only`, `test.fail`, `it.todo`: none left. No test file lacks assertions (every file has at least as many expect-like lines as tests).

## Findings

### CODE-TESTS-01 — Unedited save is not byte-exact for CRLF, BOM or a missing final newline, and no test says so
- What: I opened three files through the e2e mock and pressed Ctrl+S without editing: `# T\r\n\r\nline one\r\n...` was written back as LF; `...no trailing newline` gained a `\n`; a leading U+FEFF BOM was dropped. Scratch spec: `scratchpad/w3-tests/e2e/crlf.spec.ts`. All five e2e fixtures are LF-only (`grep -c $'\r'` = 0), so "unedited round trip" (core.spec.ts:37) cannot see this. No source code or test mentions CRLF/BOM for documents.
- Why: the product edits repo files; a CRLF file on Windows re-saved as LF is a whole-file git diff. Opinion, but it is the exact failure the Review Focus ("unedited-file byte round trip") asks about. Whether Ctrl+S on a clean doc should write at all is a separate product question.
- Cost/benefit: a decision first (preserve line endings on save / skip the write when not dirty / document the limit in README), then ~15 LOC of e2e using `launch({ files })`, which already exists. Risk reduced: silent whole-file rewrites.
- Risk: none for the test; any fix touches the save path (file-ops.ts), so keep it minimal.
- Options: A (recommended) skip the write when the document is not dirty, plus a spec that pins it; B detect the original EOL on load and re-apply it on save; C document as a known limit and pin the current behaviour with a spec.
- Recommendation: fix (A or C). **required** to decide before 1.0; the test is cheap either way.

### CODE-TESTS-02 — i18n: key parity is tested, orphans and dynamic keys are not; ~10 dead keys exist
- What: `src/i18n/resources.test.ts` is an automated it/en parity test over the 3 namespaces (good, and it matches the 15/435/65 gate numbers). Nothing checks that keys are used. A grep of `src` (non-test) finds keys with no reference: `common.json` app.tagline, theme.* (5), language.label, phase.* (about 9 of 15 keys in the file), `menu.json` app.about, editor `document.unsaved` (needs a second look, it may share a name with live keys). Many other grep "misses" are false positives from dynamic `t(\`modes.${v}\`)` / `tabs.rename.${problem}` / accents / errors / palette groups, which is why a naive test is not enough. Also, `i18next.d.ts` types static keys at compile time but template-literal keys escape tsc. Script: `scratchpad/w3-tests/orphans.mjs`.
- Why: leftovers from the cuts (theme toggle, phase status, language switcher) bloat both locales and mislead translators.
- Cost/benefit: delete the dead keys (about 15 JSON lines x 2 locales). An orphan test (about 25 LOC) would need a small allowlist of dynamic prefixes; I judge that churn not worth it for 1.0.
- Risk: removing a key used dynamically; check with `rg` on the prefix before each deletion.
- Recommendation: fix (delete confirmed orphans once, no new test). Not required.

### CODE-TESTS-03 — Debug leftover: `src/editor/repro.test.ts`
- What: 43 lines named "repro: trailing paragraph dropped in WYSIWYG", with `console.log` dumps and a user-typed sample ("asdsdAsdfa"). It mounts a real Crepe (slow import) to check that `getMarkdown` keeps a trailing paragraph. The scenario is covered by the e2e round trips and flush-editor tests.
- Why: a bug-hunt artefact, noisy output in every `bun run test`.
- Cost/benefit: -43 LOC, less log noise. Alternative: keep one assertion as a real regression test, drop the logs and rename.
- Risk: loses the only jsdom-level Crepe mount test (it is the only unit test that exercises Crepe itself, which is arguably useful as an upgrade canary for Milkdown).
- Recommendation: simplify (rename to what it guards, drop `console.log`), or cut. Not required.

### CODE-TESTS-04 — e2e timing: the parked "flake" is mostly resolved; two waits remain
- What: (a) "open edit save" (core.spec.ts:17-35) waits on the unsaved tab label before saving. That is an auto-retrying `expect`, so it is not a time guess; but since V1-01 flushes the editor on save, this wait is redundant and the sibling spec "save right after typing" (core.spec.ts:201) is the real contract. Keep the label wait or not, it cannot flake on slow CI more than any `expect` (5 s default). (b) "view switch" (core.spec.ts:54) types then clicks Reading at once; this relies on the same flush-on-view-switch path, then asserts `panel.getByText(TYPED)` with auto-retry. It is a correct test of the flush, not a flake source, as long as the 5 s default holds. (c) `page.waitForTimeout(500)` at core.spec.ts:280 is a negative wait ("document is still clean after the 200 ms debounce"); it is the only fixed sleep in e2e. (d) The double `requestAnimationFrame` at core.spec.ts:294 and a11y.spec.ts:455 is a deliberate sync with a known upstream bug (W2-KL-1), commented.
- Why: 41/41 green with 0 retries in this run. CI sets `retries: 1` (playwright.config.ts:12), which would hide a flake rather than expose it (opinion).
- Cost/benefit: replace (c) by polling `mock().writes`/tab label over a fixed 600 ms window, or just accept it (adds 0.5 s). Low value.
- Recommendation: keep. Optionally drop the redundant label wait in "open edit save" only if wanting one less moving part. Not required.

### CODE-TESTS-05 — `CHROMIUM_HEADLESS_SHELL=playwright` has no effect; nothing needs encoding
- What: `grep` over `node_modules/playwright-core/lib` finds no reader of `CHROMIUM_HEADLESS_SHELL`. It is not in CI, CONTRIBUTING.md, docs or scripts either. Playwright's default headless mode already launches the `chromium_headless_shell` build, which is what CI's `bunx playwright install --with-deps chromium` (ci.yml:25) installs and what this sandbox has at `/opt/pw-browsers/chromium_headless_shell-1243`. My e2e run passed in 52 s, and the same specs ran against the same binary.
- Why: the instruction in the brief is a sandbox convention (PLAYWRIGHT_BROWSERS_PATH is real, the other is not). Encoding it would add noise to a config that already matches CI.
- Cost/benefit: 0 LOC. If a developer wants to rule out drift, pin nothing; `playwright.config.ts` stays as is.
- Recommendation: keep (do not encode). One-line note in CONTRIBUTING is optional. Not required.

### CODE-TESTS-06 — e2e leaves the cut features unguarded only by absence; no "dangling entry point" test
- What: the Review Focus lists settings migration, parity, dangling entry points. Unit coverage is good: `settings-store.test.ts` covers lineWidth 90->66, mono->serif, docx, smart punctuation, imagePathMode/autoSave*, junk keys; `keybindings.test.ts:92` drops a persisted `splitEditor`; `menu-model.test.ts:13` and `commands.test.ts` check every menu node maps to a registered command. Not covered: palette commands to handlers (the palette builds from the same registry, so likely safe) and a persisted stale `shortcuts` id for the other cut actions (focus/typewriter modes). The per-key "migrates away X" tests are redundant with the generic "drops unrecognized keys" whitelist test (settings-store.test.ts:52); `pickKnownSettings` is a whitelist, so removed keys drop by construction.
- Why: less is more; seven near-identical migration tests assert the same whitelist.
- Cost/benefit: could fold the three "migrates away" tests into one table-driven test (about -30 LOC). Only the two value migrations (lineWidth, mono) are real logic.
- Recommendation: simplify (optional). Not required.

### CODE-TESTS-07 — e2e coverage of locale and sanitization is thin but sufficient
- What: only one e2e uses Italian (export html, core.spec.ts:181); the UI-string rule is protected by unit parity plus the gate's hardcoded-string grep (gate-snapshot item 1 and 2: Crepe image-block labels and the find-utils fallback, resolved in W1 per w1-decisions). No automated hardcoded-string test exists; the gate was a manual best-effort grep. Export sanitization is well covered at unit level (`render-rich.test.ts` script/onerror/footnote/mermaid-label cases; e2e export asserts no `<script`, `onerror`, `javascript:` in the file written). `DOMPurify` is used in `mermaid.ts` and `render-rich.ts`; I saw no test of the mermaid.ts path in isolation (it is exercised by the Mermaid a11y e2e).
- Why: a real regression risk is a new English literal; a lint rule (`react/jsx-no-literals`) would be a dependency/config change, not a test.
- Recommendation: keep. Mention under "Later": a JSX-literal lint rule.

### CODE-TESTS-08 — Rust: core fs commands are well tested; gaps are small
- What: `fs.rs` has 12 tests (atomic write, failed write keeps original, permissions kept, unwritable folder, symlink loop, folder cap, rename/create refuse overwrite, not-found). `fs_policy.rs` 7, `search.rs` 7, `workspace.rs` 6. Not tested: `move_to_trash` (OS-dependent, acceptable), `read_text_file` on non-UTF8 or a binary file (the error path the user sees on opening an arbitrary file), `write_text_file` on a path whose parent is a symlink. I did not run a non-UTF8 read to confirm which error is returned.
- Why: CLAUDE.md says all fs I/O goes through Rust and never delete user files. The trash path rests on the `trash` crate.
- Cost/benefit: one test for `read_text_file` on invalid UTF-8 is about 12 LOC.
- Recommendation: keep; add the non-UTF8 read test only if a quick probe shows the message is unhelpful. Not required.

### CODE-TESTS-09 — Stale names and comments in e2e
- What: `core.spec.ts:253` "unedited round trip keeps definition lists" and its comment cite W0-KD-2 and "definition-list syntax kept as plain paragraph text"; after the cut, the spec now guards "text that looks like a definition list survives untouched". `e2e/support/fixtures.ts` hard-codes the fixture list (line 55) in `launch`; adding a fixture needs two edits. `editorLabel()` (core.spec.ts:8) reads locale JSON from disk, fine but one more helper.
- Why: names should describe the current contract (docs overclaim risk: ROADMAP says "No test is marked as expected-failure", which is true now, grep confirms zero `test.fail`).
- Cost/benefit: rename only, 2 lines.
- Recommendation: simplify. Not required.

## Index

9 findings.

| ID | Title | Recommendation | Required |
| --- | --- | --- | --- |
| CODE-TESTS-01 | Unedited save not byte-exact for CRLF/BOM/no final newline, untested | fix (decide A/C) | **required** (decision) |
| CODE-TESTS-02 | i18n orphan keys (parity is tested, orphans are not) | fix (delete dead keys) | no |
| CODE-TESTS-03 | `repro.test.ts` debug leftover with console.log | simplify or cut | no |
| CODE-TESTS-04 | e2e timing: parked flake judged non-flaky; one fixed sleep left | keep | no |
| CODE-TESTS-05 | `CHROMIUM_HEADLESS_SHELL` is a no-op, nothing to encode | keep | no |
| CODE-TESTS-06 | Migration tests redundant with whitelist; no real gaps | simplify (optional) | no |
| CODE-TESTS-07 | Locale/sanitization e2e thin but sufficient; no hardcoded-string test | keep | no |
| CODE-TESTS-08 | Rust fs tests solid; non-UTF8 read untested | keep | no |
| CODE-TESTS-09 | Stale spec names/comments after cuts | simplify | no |

## Later
- JSX-literal lint rule to catch hardcoded UI strings (config, not a test).
- `retries: 1` in CI hides flakes; consider `retries: 0` plus a nightly repeat run (opinion).
