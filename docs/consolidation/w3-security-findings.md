# Wave 3 — security findings

> **Historical record** of the 1.0 consolidation (November 2026), closed on
> 2026-11-19. It was written in the project's previous repository, now kept as a
> private archive: commit hashes, PR numbers, branch names, `file:line`
> references and scripts cited here refer to that tree and may no longer exist.
> The current state is in [`docs/ROADMAP.md`](../ROADMAP.md) and
> [`CHANGELOG.md`](../../CHANGELOG.md).

Auditor: application security (OWASP, Tauri 2 security guide). Tree: `consolidation/wave-3` (= origin/main after Waves 0–2), read 2026-11-18.
Scope: `src-tauri/capabilities`, `tauri.conf.json` (CSP, asset scope, updater), HTML sanitization (export, Mermaid, KaTeX), opener, file-path handling, custom CSS themes, drag-and-drop, local-first, CI token permissions (`origin/consolidation/ci-review`).

Sources read 2026-11-18: Tauri security overview <https://v2.tauri.app/security/>, capabilities <https://v2.tauri.app/security/capabilities/>, permissions, command scopes, CSP <https://v2.tauri.app/security/csp/>, opener plugin <https://v2.tauri.app/plugin/opener/>, updater plugin <https://v2.tauri.app/plugin/updater/>, Mermaid directives <https://mermaid.js.org/config/directives.html>, GitHub Actions secure use <https://docs.github.com/en/actions/reference/security/secure-use>. Plugin behaviour checked against the crate sources actually locked (`tauri` 2.12.6, `tauri-plugin-opener` 2.7.3, `tauri-utils` 2.10.3).

Probes (scratch, outside the repo): production bundle built to the scratchpad, served with `vite preview`, driven by the repo's own e2e fixtures (`e2e/support/fixtures.ts`, Tauri IPC mocked).

---

### CODE-SECURITY-01 — A link click in Reading view navigates the app window away (remote page, or app reload) — **required**
- What / Where: Reading view is Crepe with `setReadonly(true)` (`src/editor/CrepeEditor.tsx:300,358`); links are plain `<a href>` and nothing intercepts the click. Probe: in Reading view, clicking `[remote](https://example.org/x)` left the window on `https://example.org/x` showing the remote page; clicking `[rel](./notes.md)` navigated to `/notes.md` (app reboot). No `on_navigation` guard exists (`src-tauri/src/lib.rs`), and the opener plugin's injected script only catches `target=_blank` or Ctrl/Shift-click (`tauri-plugin-opener-2.7.3/src/init-iife.js`). Dropping a dragged URL outside the editor is the same path (only file drags are handled, `src/app/use-file-drop.ts:16`).
- Why: unsaved edits are lost with no prompt (CLAUDE.md "always prompt on unsaved changes"; the close guard lives in the page being replaced). A remote page renders inside the app's own chrome-less window (phishing surface), and a network request happens that PRIVACY.md:45 says never happens. Tauri's capability system is meant to "minimize impact of frontend compromise" (capabilities page); a navigation guard is the matching control for the webview itself (`tauri::plugin::Builder::on_navigation`, documented in `tauri-2.12.6/src/plugin.rs:440-459`).
- Cost/benefit: ~10 LOC Rust (a tiny inline plugin whose `on_navigation` allows only the app origin — `tauri://localhost`, `http(s)://tauri.localhost`, devUrl in dev) + ~15 LOC TS (capture-phase click handler on the document panel that `preventDefault`s every anchor click) + one e2e case (click a link in Reading view, URL unchanged).
- Risk: the guard must let the print window load `index.html?print=1`; footnote `#fn-…` anchors must keep scrolling (same-document fragment, allow or handle in the click handler).
- Options: **A (rec.)** block in-app navigation; on an explicit click, open `http/https/mailto` in the system browser via the opener (needs the scoped permission, see 02) and ignore relative links (opening them as tabs is a feature → Later) · B block only, links do nothing on click.
- Recommendation: fix

### CODE-SECURITY-02 — Opener permissions have no scope: "Open themes folder" is broken, `open-url` is dead — **required**
- What / Where: `src-tauri/capabilities/default.json:25-26` grants `opener:allow-open-path` and `opener:allow-open-url` with no `allow` entries. In opener 2.7.3 an empty scope denies everything (`scope.rs:117-139`: `allowed.iter().any(..)` over an empty list → `ForbiddenPath`/`ForbiddenUrl`). So Settings ▸ "Open themes folder" (`SettingsPanel.tsx:707` → `lib/tauri/themes.ts:31`) rejects in every Tauri build, and the rejection is swallowed by `void …then(openThemesDir)`. The opener's Ctrl-click link handler is likewise always refused. e2e cannot see it (IPC is mocked).
- Why: the opener docs: "Enables the open_path command without any pre-configured scope" and show the scope as `allow: [{ path: … }]`; the default set uses `allow-default-urls` for URLs (opener page, read 2026-11-18). Least privilege says scope to exactly what is used.
- Cost/benefit: JSON only. `{"identifier":"opener:allow-open-path","allow":[{"path":"$APPCONFIG/themes"}]}`; for URLs either `opener:allow-default-urls` (if 01-A) or remove `opener:allow-open-url` and set `tauri_plugin_opener::Builder::new().open_js_links_on_click(false)` (if 01-B).
- Risk: none beyond the button starting to work; check on Linux, where `$APPCONFIG` sits under `~/.config` (literal dot in the pattern is fine).
- Options: **A (rec.)** scope the two permissions as above · B move "open themes folder" into a Rust command (`app.opener().open_path(dir)`, no frontend path, no capability) and drop `opener:allow-open-path`.
- Recommendation: fix

### CODE-SECURITY-03 — On Windows the updater quits the app without the unsaved-changes prompt — **required**
- What / Where: `src/features/updates/check-updates.ts:29-37` asks "install?" then calls `update.downloadAndInstall()`; `tauri.conf.json` sets `installMode: "passive"`. Nothing resolves dirty documents first.
- Why: updater docs: "On Windows the application is automatically exited when the install step is executed due to a limitation of Windows installers" (v2.tauri.app/plugin/updater, read 2026-11-18). CLAUDE.md: never lose user work, always prompt on unsaved changes.
- Cost/benefit: ~2 LOC: `if (!(await confirmCloseAllDirty())) return;` (`src/features/file-ops/close-window.ts:22`) before `downloadAndInstall()`; one unit test.
- Risk: none; on macOS/Linux it only adds the same prompt the user gets on quit.
- Recommendation: fix

### CODE-SECURITY-04 — Saving a symlinked file replaces the link with a regular file (`CLAUDE.md → AGENTS.md`) — **required**
- What / Where: `write_atomic` (`src-tauri/src/commands/fs.rs:83-114`) renames a sibling temp file onto `path`. `rename(2)` replaces the directory entry, so when `path` is a symlink the link itself is replaced; the target keeps the old text. Reproduced with the same rename sequence in the scratchpad: after the save `CLAUDE.md` is a regular file and `AGENTS.md` still holds `old`. No test covers a symlinked document.
- Why: `CLAUDE.md`/`AGENTS.md` symlinked to each other is a common convention among exactly the files PRODUCT.md puts in scope; the edit silently forks the two files ("the file is the product", fs.rs:68).
- Cost/benefit: ~3 LOC: resolve `path` with `std::fs::canonicalize` (falling back to `path` when it does not exist yet) before `write_atomic`, so the temp file and rename land beside the real target; one Rust test (unix-only, like the existing symlink test at fs.rs:514).
- Risk: watcher re-arm and self-write record should keep using the path the frontend knows (unchanged); a dangling symlink falls back to today's behaviour.
- Recommendation: fix

### CODE-SECURITY-05 — The print window holds every permission of the main window
- What / Where: `default.json:5` `"windows": ["main", "print-*"]`. A print window renders document-derived HTML (`PrintView.tsx:54`) yet can call the updater (download/install), read the clipboard, create webview windows, write the store, etc. It needs only events (`core:default`), `core:webview:allow-print` (macOS `window.print` shim, `tauri-2.12.6/src/webview/scripts/print.js`) and `log:default` (global error handler).
- Why: capabilities page: security boundaries are per window label, and capabilities exist to "minimize impact of frontend compromise" (v2.tauri.app/security/capabilities, read 2026-11-18). The HTML is DOMPurify-sanitized, so this is defense in depth.
- Cost/benefit: one extra capability file (~12 lines); `default` lists `main` only and drops `core:webview:allow-print`.
- Risk: a missing permission in the print window shows up as a stuck "Preparing print" toast (10 s timeout already handles it); check print once in `bun tauri dev`.
- Recommendation: simplify

### CODE-SECURITY-06 — Security docs overclaim the fs boundary; Rust fs commands take any path — **required (docs)**
- What / Where: `read_text_file`, `write_text_file`, `create_file`, `rename_path`, `move_to_trash`, `read_dir`, `save_image_asset` accept any absolute path (`src-tauri/src/commands/fs.rs:51-285`, `assets.rs:53`). ARCHITECTURE.md:158-166 says every operation runs "on a path the user chose via a native dialog" and ARCHITECTURE.md:144-146 says the capability grants only four permissions (it grants 19). SECURITY.md:40-42 repeats the "not granted direct filesystem access" framing. The capability description still says "Phase 0 minimal capabilities".
- Why: the real boundary is "no script runs in the webview" (CSP `script-src 'self'` + DOMPurify, see 10); a webview compromise is equivalent to user-level fs read/write. Tauri: "The scope validation implementation should be audited to ensure correctness" (command scopes page, read 2026-11-18). Public security docs must state the real model.
- Cost/benefit: docs only (~15 lines across ARCHITECTURE.md, SECURITY.md, the capability `description`). Enforcing a path allowlist (user-granted roots, persisted across restarts) is real work and a new dependency (persisted scope) → Later.
- Risk: none.
- Recommendation: fix (docs); keep the command model for 1.0

### CODE-SECURITY-07 — Unused plugin surface: `tauri-plugin-fs` registration and two unused npm packages
- What / Where: `lib.rs:31` registers `tauri_plugin_fs::init()` with no `fs:*` permission and no frontend caller; `package.json:44` `@tauri-apps/plugin-fs` and `:50` `@tauri-apps/plugin-window-state` are imported nowhere in `src/` (the window-state *Rust* plugin needs no JS). `core:window:allow-is-fullscreen` duplicates `core:window:default`.
- Why: least privilege / guiding rule; registered-but-denied commands are still IPC surface to reason about (opinion).
- Cost/benefit: −2 npm deps, −1 Cargo line, −1 registration, −1 capability line. The `tauri-plugin-fs` crate stays in the tree as a dependency of `tauri-plugin-dialog`, so no binary saving.
- Risk: low; if the Later path-allowlist from 06 is ever built on the dialog-populated fs scope, re-add the registration then.
- Recommendation: cut

### CODE-SECURITY-08 — CI workflows run with the repository-default `GITHUB_TOKEN` permissions
- What / Where: `ci.yml`, `build-check.yml` and `manual-suite.yml` on `origin/consolidation/ci-review` (and `ci.yml`/`build-check.yml` on main) have no `permissions:` block; only `release.yml` scopes its job (`contents: write`). Actions are SHA-pinned on ci-review (good).
- Why: GitHub: "It's good security practice to set the default permission for the GITHUB_TOKEN to read access only for repository contents. The permissions can then be increased, as required" (docs.github.com/en/actions/reference/security/secure-use, read 2026-11-18).
- Cost/benefit: 2 lines per workflow (`permissions: { contents: read }` at top level). `build-check.yml` passes `GITHUB_TOKEN` to tauri-action without publishing, so read is enough.
- Risk: none expected; a job that needs more fails loudly and gets a job-level grant.
- Recommendation: fix (on the ci-review branch)

### CODE-SECURITY-09 — Asset scope `$HOME/**`: images under dot-folders never render on macOS/Linux; `connect-src asset:` is unused
- What / Where: `tauri.conf.json` `assetProtocol.scope: ["$HOME/**"]`. Tauri's scope defaults `require_literal_leading_dot` to true on Unix (`tauri-2.12.6/src/scope/fs.rs:215-224`), so `**` does not match `.github/…`, `.claude/…` or a repo under `~/.local`. Images outside `$HOME` (second drive, `/Volumes`, `D:\`) are also refused. CSP `connect-src` lists `asset:`/`http://asset.localhost`, but nothing `fetch`es asset URLs (images use `img-src`; `embed-fonts.ts:88` fetches bundled `'self'` URLs).
- Why: PRODUCT.md puts agent files in dot-folders in scope; ARCHITECTURE.md:150-166 already names a dynamic per-document scope as the future direction.
- Cost/benefit: removing `asset:` + `http://asset.localhost` from `connect-src` is 2 tokens. A dynamic scope (`app.asset_protocol_scope().allow_directory(parent, true)` when a document opens, scope then empty in config) is ~10 LOC and both narrows and fixes the gap.
- Risk: the `connect-src` cut needs one check in `bun tauri dev` (image block, Mermaid, export) for an asset `fetch` this audit did not find.
- Options: **A (rec.)** for 1.0 cut the `connect-src` asset sources and document the dot-folder limit; dynamic scope → Later · B do the dynamic scope now.
- Recommendation: simplify

### CODE-SECURITY-10 — Markdown→HTML pipeline is sound; two small simplifications
- What / Where: export/clipboard: `marked` → DOMPurify (`render-rich.ts:284-287`, dompurify 3.4.18 = latest). Mermaid: `securityLevel: "strict"`, `htmlLabels: false`, SVG re-sanitized (`src/editor/mermaid.ts:56,77-86`); `securityLevel` is in Mermaid's `secure` list, so `%%{init}%%` cannot lower it (verified in `mermaid/dist`, matches mermaid.js.org/config/directives). KaTeX (Crepe and export) runs with default `trust: false` (`CrepeEditor.tsx:151`; Crepe `feature/latex`). Export tokens pass `isSafeTokenValue` (`theme-snapshot.ts:48`), which blocks a custom-theme value carrying `</style><script>` (probe showed such a value survives `getPropertyValue`, so the guard matters). e2e `unsafe.md` covers script / onerror / `javascript:` on export.
- Why: OWASP XSS prevention (sanitize untrusted HTML with a maintained library), plus CSP as the second layer (11).
- Cost/benefit: (a) `ADD_ATTR: ["id","href","aria-label"]` is a no-op (all three are DOMPurify defaults), −1 line; (b) `sanitizeThemeCss` (`apply-theme.ts:19`) is a regex the CSP already makes redundant (and it misses `url(//host)` / CSS escapes); keep it, but its comment and `EXAMPLE_CSS` should say the CSP is the guarantee.
- Risk: none.
- Recommendation: keep (simplify a, b)

### CODE-SECURITY-11 — CSP and local-first hold; nothing tests the production CSP
- What / Where: production CSP: `script-src 'self'` (no `unsafe-inline`/`unsafe-eval`), no remote origin in any directive; `unsafe-eval` only in `devCsp`. `index.html` has no inline `<style>`, so Tauri adds no style nonce and `style-src 'unsafe-inline'` keeps working for CodeMirror/React (`tauri-2.12.6/src/manager/mod.rs:96-151`). Grep of `src/` and the built bundle: the only `fetch` is bundled fonts; no XHR/WebSocket/beacon. The CSP is what stops remote images (README badges) from loading when a file opens — consistent with PRODUCT principle 4.
- Why: Tauri CSP page: "You should make it as restricted as possible" (read 2026-11-18). e2e runs on `vite preview`, which serves no CSP, so a regression in `tauri.conf.json` would pass CI.
- Cost/benefit: one Vitest (~15 LOC) reading `tauri.conf.json`: no `http(s):` source outside `localhost` forms, no `'unsafe-eval'`/`'unsafe-inline'` in `script-src`, `img-src` without `https:`.
- Risk: none.
- Recommendation: keep; add the config test (optional)

### CODE-SECURITY-12 — Updater configuration is sound (feed is a release-gate matter)
- What / Where: HTTPS endpoint on GitHub Releases; `pubkey` decodes to a real minisign key (id `3BFCC0D31BCE36A0`, not the placeholder the release preflight rejects); update only on explicit user action, with a confirm before download (`check-updates.ts`); no private key in the repo (`git ls-files` grep); signing keys only from secrets in `release.yml`.
- Why: updater docs (signature verification is mandatory, read 2026-11-18).
- Cost/benefit: nothing to change. The feed pointing at a private repo stays the W1 UX-16 release-gate item.
- Risk: none.
- Recommendation: keep

---

## Later
- Path allowlist for the Rust fs commands (user-granted roots, persisted), replacing "webview has user-level fs" (06).
- Per-document dynamic asset scope (09).
- Relative `.md` links in Reading view open as a tab (01).
- `core:default` → explicit sets (drops unused `core:menu:*`, `core:tray:*` from the webview); low value, opinion.
