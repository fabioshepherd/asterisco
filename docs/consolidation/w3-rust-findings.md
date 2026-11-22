# Wave 3 — Rust / Tauri findings (`src-tauri`)

> **Historical record** of the 1.0 consolidation (November 2026), closed on
> 2026-11-19. It was written in the project's previous repository, now kept as a
> private archive: commit hashes, PR numbers, branch names, `file:line`
> references and scripts cited here refer to that tree and may no longer exist.
> The current state is in [`docs/ROADMAP.md`](../ROADMAP.md) and
> [`CHANGELOG.md`](../../CHANGELOG.md).

Auditor: rust. Read-only pass on `consolidation/wave-3`. Baseline: `cargo clippy -- -D warnings` clean, `cargo test` 49/49 green, 509 unique crates in the normal dep tree. All 19 registered commands are still invoked from `src` (grep of `invoke("…")`); **no unused command**. Cited docs read 2026-11-18.

### CODE-RUST-01 — "Open themes folder" is probably denied in the shipped app (opener scope empty)
- Where: `src-tauri/capabilities/default.json` (`opener:allow-open-path`, no scope); caller `src/lib/tauri/themes.ts:31` (`openPath(dir)`).
- Why: `tauri-plugin-opener` 2.7.3 `scope.rs:139` allows a path only if some allow-entry matches (`allowed.iter().any(..)`); with no entries it returns `ForbiddenPath`. Verified from the crate source, not run in a packaged build.
- Cost/benefit: ~4 LOC. Fixes a Settings button (themes are a headline feature).
- Risk: scope too wide would let the webview open arbitrary paths. Scope to `$APPCONFIG/themes` (+ `/**`). Confirm in `bun tauri dev` first; if it works, the scope is coming from elsewhere and this is void.
- Options: (a) permission with `allow: [{ path: "$APPCONFIG/themes/**" }]` (recommended); (b) add a Rust command that opens the managed dir (no JS scope needed).
- Recommendation: fix. **required** (if reproduced).

### CODE-RUST-02 — Atomic save replaces a symlink with a regular file
- Where: `commands/fs.rs` `write_atomic` (rename of the sibling temp over `path`).
- Why: `rename(2)` replaces the link itself. This product's users symlink `CLAUDE.md -> AGENTS.md` (PRODUCT.md scope); one save silently turns the link into a copy and the two agent briefs diverge. Also loses hard-links and ownership/xattrs (opinion: acceptable; mention only).
- Cost/benefit: ~6 LOC: if `symlink_metadata(path)` is a symlink, `canonicalize` first and write to the target. Prevents silent data-model damage.
- Risk: low; add one unix test (symlink survives, target updated). Watcher `rearm` should use the resolved path too.
- Recommendation: fix. **required** (correctness of "the file is the product").

### CODE-RUST-03 — Sync commands run on the main thread: tree/search/quick-open/save can freeze the window
- Where: every non-`async` command: `read_dir`, `list_markdown_files`, `search_workspace` (walks up to 5000 files, reads up to 2 MB each), `write_text_file` (fsync x2), `move_to_trash`, `read_text_file`.
- Why: Tauri docs: "Commands without the async keyword are executed on the main thread unless defined with `#[tauri::command(async)]`" (https://v2.tauri.app/develop/calling-rust/, read 2026-11-18). Workspace search on a big repo or a slow/network volume blocks the whole UI, including the title bar.
- Cost/benefit: one-token change per command (`#[tauri::command(async)]`), no signature change; runs on the async runtime thread pool. Biggest perf win per LOC in the crate.
- Risk: very low; `State<'_, …>` args are fine for `(async)` sync fns (no `.await`, so no borrow restriction). Commands that take `AppHandle`/`State` keep working.
- Recommendation: fix (at least `search_workspace`, `list_markdown_files`, `read_dir`, `write_text_file`, `move_to_trash`). **required** for a responsive 1.0 on large workspaces; otherwise high-value.

### CODE-RUST-04 — `search_workspace` aborts the whole search on the first unreadable folder; `list_markdown_files` does not
- Where: `commands/search.rs` `walk_entries` (`read_dir(dir)?`, `entry?`) vs `workspace.rs::walk` (counts `skipped`, continues).
- Why: the two walkers share the policy but disagree on errors; the index comment itself says one EACCES "used to abort the index for the entire workspace". Search still has that bug: one locked subfolder = whole search returns an error to the UI. `skipped` is also not reported by search.
- Cost/benefit: ~8 LOC (mirror the `let Ok(..) else { skipped += 1; continue }` shape, set `truncated`).
- Risk: low. Add a unix test with a 0o000 dir (skip if root).
- Options: fold both walkers into one `fs_policy::walk(visit)` (-80 LOC, removes duplicated `MAX_FILES`, symlink-cycle, gitignore push/pop logic) — recommended later, not for 1.0 freeze (touches tested code).
- Recommendation: fix (the small version). **required** (parity bug).

### CODE-RUST-05 — `.lock().unwrap()` in command paths (5 sites) under `panic = abort` risk
- Where: `commands/watcher.rs` (start_watch x2, stop_watch), `commands/themes.rs` (start x2, stop). Elsewhere the crate already uses `if let Ok(guard)` (SelfWriteState, WatcherState::rearm, PendingFiles).
- Why: a poisoned mutex turns into a panic in a command thread. Inconsistent with the rest of the file. Today poisoning can only follow another panic, so real risk is low (opinion).
- Cost/benefit: ~10 LOC via `lock().unwrap_or_else(PoisonError::into_inner)` or a tiny `fn take(&self)` helper on both state types (also removes the duplicated "drop previous outside lock" block, 3 copies).
- Risk: none.
- Recommendation: simplify.

### CODE-RUST-06 — `create_file` / `rename_path` check-then-act race and can clobber a file
- Where: `commands/fs.rs` `create_file` (`exists()` then `fs::write`, which truncates), `rename_path` (`exists()` then `fs::rename`, which overwrites on unix and Windows MoveFileEx replace).
- Why: the stated contract is "never overwrite"; the window is tiny but the fix is cheaper than the explanation. Data-loss class for a local-first editor.
- Cost/benefit: `OpenOptions::new().write(true).create_new(true)` maps `AlreadyExists` straight to `AppError::AlreadyExists`: net LOC ~0. For rename there is no std atomic no-replace; keep the pre-check (documented best effort) or use `renameat2(RENAME_NOREPLACE)` only if you want it perfect (not for 1.0).
- Recommendation: fix `create_file` (3 LOC); keep `rename_path` as-is with a comment. **required** only for `create_file`.

### CODE-RUST-07 — `save_image_asset`: non-atomic write, errors without path, no size cap
- Where: `commands/assets.rs`.
- Why: uses `?` on bare `io::Error` (`AppError::Io`, no path; the UI cannot say what failed, unlike every other command), plain `fs::write`, `unique_path` is check-then-write (two pastes in one frame can collide), and `bytes: Vec<u8>` crosses IPC with no limit.
- Cost/benefit: ~10 LOC: `.map_err(|e| AppError::at(&assets, e))`, `create_new(true)` loop in `unique_path`, reject > N MB (e.g. 25) with `Resource`.
- Risk: low.
- Recommendation: fix (path + create_new); size cap is opinion.

### CODE-RUST-08 — `tauri-plugin-fs` registered but never usable; two unused npm packages
- Where: `lib.rs` `.plugin(tauri_plugin_fs::init())`, `Cargo.toml` `tauri-plugin-fs`, `package.json` `@tauri-apps/plugin-fs`; also `@tauri-apps/plugin-window-state` (npm).
- Why: no `fs:*` permission is granted (by design, ARCHITECTURE.md) and no `src` file imports `@tauri-apps/plugin-fs` or `plugin-window-state` (grep: zero hits). The Rust window-state plugin IS used (it restores size from Rust); only its JS binding is dead. `tauri-plugin-dialog` 2.8.4 only calls `try_fs_scope()` (optional), so dropping the registration is safe; the crate stays in the tree transitively through dialog, so no build-time win.
- Cost/benefit: removes 1 plugin init, 1 direct Rust dep line, 2 JS deps (smaller attack surface: the plugin's commands exist in the IPC even if denied). Fewer lines in THIRD-PARTY-NOTICES npm.
- Risk: low; run the dialog Open/Save flows after. Frontend package removal is in scope of the deps auditor.
- Recommendation: cut.

### CODE-RUST-09 — Dead/unscoped capabilities
- Where: `capabilities/default.json`.
- `opener:allow-open-url` : no `openUrl` call in `src` (grep). Cut. (`opener:default` is not used either.)
- `core:window:allow-destroy`, `allow-set-fullscreen`, `allow-print` etc. look used (WindowControls, use-window-fullscreen, export-ops); I did not verify each — the a11y/ui auditors own the UI side. `windows: ["main","print-*"]` matches export-ops' print window.
- `assetProtocol.scope: ["$HOME/**"]` (tauri.conf.json) lets the webview read any file under HOME through `asset:` (including `~/.ssh`). CSP `script-src 'self'` and sanitized markdown make exploitation unlikely; Tauri's own guidance is to scope the asset protocol as narrowly as possible (https://v2.tauri.app/concept/security/, "Asset protocol scope", read 2026-11-18). Opinion: for a local-first Markdown editor, images next to docs outside HOME (other drives, `/mnt`, `D:\`) also break, so the scope is simultaneously too wide and too narrow. The real fix is a runtime `asset_protocol_scope().allow_directory(workspace)` when a workspace/doc opens (~10 LOC Rust + a command) — a feature-sized change, so label **Later**.
- Recommendation: cut `allow-open-url` now; asset scope: keep for 1.0, add to the Later list.

### CODE-RUST-10 — No `[profile.release]`: binary and build are larger than Tauri's recommendation
- Where: `Cargo.toml` (no profile section).
- Why: Tauri's size guide recommends `codegen-units = 1`, `lto = true`, `opt-level = "s"`, `panic = "abort"`, `strip = true` (https://v2.tauri.app/concept/size/, read 2026-11-18). Typical effect: noticeably smaller installer/updater payload (updater downloads the whole bundle), at the cost of slower release builds (CI matrix, 3 OS). Note `panic = "abort"` makes the five `unwrap()`s in 05 process-fatal; it also changes `catch_unwind` assumptions (none in the crate).
- Cost/benefit: 6 LOC; I did not measure the delta (a release build of the full tree was out of scope for a shared box). Measure once in CI before adopting.
- Risk: longer release CI; `lto` + 1 codegen unit roughly doubles link time (opinion/typical).
- Options: skip `panic = "abort"`, keep the rest (recommended if wary).
- Recommendation: simplify (add the profile). Not required.

### CODE-RUST-11 — `read_text_file` has no size ceiling
- Where: `commands/fs.rs::read_text_file` (`read_to_string`, then JSON over IPC).
- Why: opening a multi-hundred-MB `.txt`/log (`txt` is in `MARKDOWN_EXTENSIONS`) freezes the main thread (see 03) and the editor. Search already refuses > 2 MB; opening has no equivalent guard. Opinion on the number.
- Cost/benefit: ~6 LOC (`metadata().len() > N` → `Resource`/new `tooLarge` kind + one i18n string, it/en).
- Risk: needs a UI string (CLAUDE.md i18n rule) and a product decision on N.
- Recommendation: simplify/fix at the discretion of the owner; not required.

### CODE-RUST-12 — Error surface: path-less `Io` still reachable; `Trash`/`Watch`/`Resource` collapse to one UI kind each
- Where: `error.rs` `AppError::Io(#[from])`; used bare in `assets.rs`, `themes.rs::ensure_themes_dir_at` (`create_dir_all`, `fs::write`).
- Why: the module doc says every user-nameable failure should carry its path; `#[from]` makes `?` the easy wrong path. Removing `#[from]` forces `.map_err(AppError::at)` and would have caught 07 at compile time.
- Cost/benefit: ~12 LOC across 3 files; stronger invariant than a comment.
- Risk: low; wire shape unchanged (`io_kind` still maps errno).
- Recommendation: simplify (do together with 07). Not required.

### CODE-RUST-13 — fs_policy, watcher: reviewed, no defects
- `fs_policy.rs`: single policy, tests pin TS/Rust extension lists; `ignore_stack` rebuild per expansion is measured (0.7 ms) and documented — keep. Walkers follow symlinks with canonical `seen` set — keep.
- Watcher: self-write guard is a single `(path, instant)` slot with a 500 ms window; a second save to a different path inside 500 ms would drop the first record, but only one file is watched at a time, so this cannot misfire. `rearm` after atomic save is correct for inotify. Debounce 300 ms OK. Recommendation: keep.

### CODE-RUST-14 — Idioms (opinion; `cargo clippy -W clippy::pedantic` = 38 warnings, none affect correctness)
- 26x `needless_pass_by_value` (commands take `String`/`State` by value — required by the `#[tauri::command]` macro in practice; ignore), 3x `unnecessary_wraps` (`path_exists`, `stop_watch`, `stop_themes_watch` return `AppResult` that cannot fail; changing them changes the `invoke` rejection contract, ignore), `Option<Option<PathBuf>>` in `fs.rs::loops_back` (could be a small `OnceCell`; cosmetic), `similar_names` x2.
- Cosmetic leftovers: `lib.rs` has `let _ = app;` + `Ok(())` and a `let _ = (app, event)` needed only on non-mac; `is_removal` wraps a single `matches!`. `rust-version = "1.77.2"` is stale vs deps that need newer (cargo resolves with 1.97; MSRV is not tested in CI): either drop the field or test it (opinion).
- Recommendation: keep clippy at `-D warnings` default only; do not adopt pedantic.

### CODE-RUST-15 — Duplicated debouncer plumbing in `themes.rs` and `watcher.rs`
- Where: `ThemesDebouncer` vs `AppDebouncer` aliases (comment: "kept separate by design"), two start/stop pairs with identical "take previous, stop_nonblocking" blocks.
- Why: opinion: a generic `Slot<Debouncer>` with `replace/clear` removes ~25 LOC and the three unwraps in 05; the independence the comment wants is kept by having two managed instances.
- Cost/benefit: -25 LOC, low risk, tests exist only for `is_removal`; behavior not covered by tests (needs manual check of external-edit reload and theme hot-reload).
- Recommendation: simplify, only together with 05 and only if time allows. Not required.

## Later (no 1.0 work)
- Merge `workspace::walk` and `search::walk` into one `fs_policy` walker.
- Per-workspace `asset_protocol_scope` instead of `$HOME/**`.
- `renameat2`/`RENAME_NOREPLACE` for `rename_path`.
- Cancel/streaming for workspace search (currently runs to completion; caps bound it).

## Index
Count: 15 findings.
