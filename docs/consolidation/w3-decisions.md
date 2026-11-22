# Wave 3 — decisions

> **Historical record** of the 1.0 consolidation (November 2026), closed on
> 2026-11-19. It was written in the project's previous repository, now kept as a
> private archive: commit hashes, PR numbers, branch names, `file:line`
> references and scripts cited here refer to that tree and may no longer exist.
> The current state is in [`docs/ROADMAP.md`](../ROADMAP.md) and
> [`CHANGELOG.md`](../../CHANGELOG.md).

Sources: `w3-<area>-findings.md` for editor, shell, features, rust, security, build, tests (evidence, file:line and sources are there; IDs below refer to them).
Order: required items first (decided as "how" only), then owner decisions.

## Required (fix)

### V1-09 — File/app accelerators off macOS and `reserved-combos` (CODE-SHELL-02, ROADMAP [V1])
- What: Ctrl+N, Ctrl+O, Open Folder, Save As, Close Tab, Quit do nothing on Windows/Linux; one window-level handler dispatches every `MENU_MODEL` accelerator through the keymap; menubar hints restored; `reserved-combos` correct per platform.
- Decision: approved (required)

### V1-10 — Settings persistence race (CODE-SHELL-01)
- What: save only after load, only changed values, debounced via the store plugin; a sidebar drag no longer rewrites settings.json per frame; startup can't overwrite the saved sidebar width/outline state.
- Decision: approved (required)

### V1-11 — Wrong palette shortcut hint (CODE-SHELL-04, part)
- What: Export HTML shows `mod+shift+e` (the focus-file-tree key). Removed even if the registry merge (CODE-01 below) is not approved.
- Decision: approved (required)

### V1-12 — Saving a symlinked document replaces the link (CODE-RUST-02 = CODE-SECURITY-04)
- What: `CLAUDE.md -> AGENTS.md` becomes a copy on save. Resolve the real path before the atomic write; test.
- Decision: approved (required)

### V1-13 — Rust file commands run on the main thread (CODE-RUST-03)
- What: search, tree listing, quick-open and save can freeze the window; make them async commands.
- Decision: approved (required)

### V1-14 — Search aborts on the first unreadable folder (CODE-RUST-04); `create_file` can truncate a file created meanwhile (CODE-RUST-06, `create_new`)
- Decision: approved (required)

### V1-15 — Updater on Windows closes the app without the unsaved-changes prompt (CODE-SECURITY-03)
- What: call the existing unsaved-changes check before install.
- Decision: approved (required)

### V1-16 — Docs overclaim on file access and permissions (CODE-SECURITY-06)
- What: ARCHITECTURE.md / SECURITY.md say file commands only work on dialog-picked paths and that 4 permissions are granted (19 are). Correct the docs; restricting paths goes to Later.
- Decision: approved (required)

### V1-17 — Editor rewrites unedited content (CODE-EDITOR-01, CODE-EDITOR-02) and stale selection count (CODE-EDITOR-03)
- What: lines holding only `<br>` are deleted on save; every `-` bullet becomes `*` (also setext → ATX, `1)` → `1.`); status-bar selection count lags one step. Fix serializer options and plugin order; round-trip e2e fixtures for each.
- Decision: approved (required)

### V1-18 — Third-party notices (CODE-BUILD-01, CODE-BUILD-02)
- What: release builds silently skip notices generation (cargo-about 0.9 flags, `|| true` hides it); Rust license texts are HTML-escaped. Fix the template/config and stop hiding failures.
- Decision: approved (required)

## Owner decisions

### CODE-01 — Links in Reading view (CODE-SECURITY-01, -02) — required, "how" only
- What: clicking a link navigates the app window (web link loads the remote site inside the app; relative link reloads the app) — unsaved edits lost, and a network request the privacy promise excludes. "Open themes folder" and Ctrl-click on links never work (opener permissions have no scope).
- Options: **A (rec.)** block navigation of the app window (Rust guard + click handler); a click on a web link opens it in the system browser (an explicit user action, so local-first holds); relative `.md` links open the file in a new tab if it exists · B block navigation; links do nothing (copy link only) · C block navigation; web links open in the browser only with Ctrl/Cmd-click.
- Also: scope the folder opener to the themes folder.
- Decision: approved (A) — owner 2026-11-18

### CODE-02 — Byte-exact save for CRLF, BOM, missing final newline (CODE-TESTS-01) — required, "how" only
- What: an unedited save turns CRLF into LF, adds a final newline, drops a BOM — a whole-file git diff on Windows repos.
- Options: **A+B (rec.)** skip the write when the document is not dirty, and on load remember EOL style/BOM/final newline and re-apply them on save · A only skip the write when clean (an edited CRLF file still becomes LF) · C document as a known limit.
- Decision: approved (A+B) — owner 2026-11-18

### CODE-03 — `mod+1…6` does two things at once (CODE-SHELL-03) — required, "how" only
- What: off macOS one press in the editor sets a heading AND switches tab; on macOS tab-by-position works only for 7–9.
- Options: **A (rec.)** keep Heading 1–6, drop "select tab by position" (tabs still: Ctrl+Tab MRU, Ctrl+PageUp/Down, palette) · B keep tab-by-position on `mod+1…9`, move headings to `mod+alt+1…6` · C keep tab-by-position only for 7–9.
- Decision: approved (A) — owner 2026-11-18

### CODE-04 — Milkdown list caret bug W2-KL-1 (CODE-EDITOR-04)
- What: typing right after creating a list item can send the caret to the start ("Beta" → "etaB"). Owner declined patching Milkdown; an app-side guard (~35 LOC, no dependency change) fixed it in a prototype.
- Options: **A (rec.)** app-side guard + e2e · B disable Crepe's ListItem feature (plain lists, faster) · C keep the documented limitation.
- Decision: approved (B: disable Crepe ListItem feature) — owner 2026-11-18

### CODE-05 — One command registry (CODE-FEATURES-03, CODE-SHELL-04/05)
- What: the palette keeps its own ~40 commands beside the menu `COMMANDS`; rebindable shortcuts re-implement command bodies (already diverged: Search toggles from keys, only opens from menu). Build palette and keymap from one registry; saved shortcut ids unchanged.
- Cost/benefit: ~−200 LOC, one name and one behaviour per command. Risk: medium (touches every command entry point; e2e covers palette).
- Decision: approved — owner 2026-11-18

### CODE-06 — Cleanup cuts (no user-visible change)
- What: unused deps `codemirror` meta-package, `@radix-ui/react-slot`, `@tauri-apps/plugin-fs`, `@tauri-apps/plugin-window-state`, `tauri_plugin_fs` registration, `opener:allow-open-url` if CODE-01 doesn't need it; ~10 dead i18n keys; `src/editor/repro.test.ts`; unused exports and small duplications (EDITOR-10/11, FEATURES-02/06/07, SHELL-07/08/11/14, RUST-05/15, TESTS-09); declare `katex` explicitly.
- Decision: approved — owner 2026-11-18
- Not done (coordinator ruling 2026-11-18): SHELL-14 usePlatformChrome constant and event-names merge — finding labelled opinion/no risk; skipped as churn.

### CODE-07 — Small simplifications and fixes
- What: Mermaid preview flicker on every keystroke (EDITOR-05); Source→edit switch adds an undo step and moves the caret (EDITOR-06); label observer scans the whole editor per mutation (EDITOR-07); Italian users see English for a moment at launch (SHELL-09); palette "Open documents" in creation order (SHELL-10); print window gets all main-window permissions (SECURITY-05); CI workflows without read-only token permissions (SECURITY-08); image asset save non-atomic, unbounded (RUST-07/12); typecheck skips e2e/node tsconfigs (BUILD-10); stale `rust-version` (BUILD-09); unused CSP `connect-src asset:` (SECURITY-09).
- Decision: approved — owner 2026-11-18
- Image asset save (RUST-07/12) writes to a new unique name (no overwrite, size-bounded, errors shown) but is not strictly atomic: a crash mid-write can leave a truncated new file; the subject of commit d5a5794 overstates this.
- SECURITY-08 touches `.github/workflows/`: owner explicitly authorised the workflow edit (read-only token permissions only) in chat — owner 2026-11-18

### CODE-08 — Bundle and build size
- What: Oxc minifier instead of deprecated esbuild minify (−69 KB gz, −1 dev dep, BUILD-05); one KaTeX copy via `overrides`, gated by a mermaid-math e2e (−77 KB gz lazy, BUILD-06); lazy-load the export path (BUILD-07); Rust `[profile.release]` size settings, measured first (RUST-10).
- Decision: approved — owner 2026-11-18

### CODE-09 — Major upgrades
- What: upgrade now (green suite required): motion 12 → 14 (no public API breaks per changelog, BUILD-14), eslint-config-prettier 10, eslint-plugin-react-refresh 0.5, globals 17 (BUILD-16). Later: i18next 27, eslint 10 + react-hooks 7, jsdom 31, jest-axe 11 / jest-dom 7, TypeScript 7, vitest 5. Never for 1.0: mermaid 12 (needs Safari 17.4, changes diagram layout), @types/node beyond 22.
- Decision: approved — owner 2026-11-18

### CODE-10 — Mermaid diagrams (owner question)
- What: owner asked whether diagrams are worth ~960 KB gz / 108 packages (lazy-loaded).
- Decision: keep (stay on mermaid 11) — owner 2026-11-18

## Kept / Later (no question)
Keep `motion` (CSS can't replace height/width and exit animations on Ubuntu 22.04's WebKitGTK, FEATURES-01); SettingsPanel split and settings key table (FEATURES-05, SHELL-06/12/13) go to Later; `fs_policy`, watcher, sanitization, CSP, updater setup verified sound (RUST-13, SECURITY-10/11/12); `CrepeBuilder` (−12.9 KB gz), KaTeX fonts, path-restricted file commands, per-document image scope → Later.

## New user-facing strings — da approvare

All added in Wave 3 (diff of `src/i18n/locales` since 1979b98); removed keys are not listed. All rows approved by the owner on 2026-11-19 (W4-01).

| key | en | it | item | status |
|---|---|---|---|---|
| `editor:codeBlock.previewLoading` | Rendering diagram… | Generazione del diagramma… | CODE-07 (EDITOR-05) | approved — owner 2026-11-19 |
| `editor:errors.imageTooLarge` | it is larger than 25 MB | supera i 25 MB | CODE-07 (RUST-07/12) | approved — owner 2026-11-19 |
| `editor:notify.imageSaveFailed` | Couldn’t add the image: {{error}} | Impossibile aggiungere l’immagine: {{error}} | CODE-07 (RUST-07/12) | approved — owner 2026-11-19 |
| `editor:shortcuts.actions.closeTab` | Close tab | Chiudi scheda | V1-11 / CODE-03 / CODE-05 (e9c2244) | approved — owner 2026-11-19 |
| `editor:shortcuts.actions.newFile` | New file | Nuovo file | V1-11 / CODE-03 / CODE-05 (e9c2244) | approved — owner 2026-11-19 |
| `editor:shortcuts.actions.openFile` | Open file | Apri file | V1-11 / CODE-03 / CODE-05 (e9c2244) | approved — owner 2026-11-19 |
| `editor:shortcuts.actions.openFolder` | Open folder | Apri cartella | V1-11 / CODE-03 / CODE-05 (e9c2244) | approved — owner 2026-11-19 |
| `editor:shortcuts.actions.print` | Print | Stampa | V1-11 / CODE-03 / CODE-05 (e9c2244) | approved — owner 2026-11-19 |
| `editor:shortcuts.actions.quit` | Quit | Esci | V1-11 / CODE-03 / CODE-05 (e9c2244) | approved — owner 2026-11-19 |
| `editor:shortcuts.actions.save` | Save | Salva | V1-11 / CODE-03 / CODE-05 (e9c2244) | approved — owner 2026-11-19 |
| `editor:shortcuts.actions.saveAs` | Save as | Salva con nome | V1-11 / CODE-03 / CODE-05 (e9c2244) | approved — owner 2026-11-19 |
| `editor:shortcuts.groups.file` | File | File | V1-11 / CODE-03 / CODE-05 (e9c2244) | approved — owner 2026-11-19 |
| `menu:app.toggleAutoSave` | Toggle Auto-Save | Attiva/disattiva salvataggio automatico | V1-09 (e10d00d), CODE-05 (e9c2244) | approved — owner 2026-11-19 |
| `menu:file.renameFolder` | Rename Folder | Rinomina cartella | V1-09 (e10d00d), CODE-05 (e9c2244) | approved — owner 2026-11-19 |
| `menu:view.focusFileTree` | Focus File Tree | Vai all'albero dei file | V1-09 (e10d00d), CODE-05 (e9c2244) | approved — owner 2026-11-19 |
| `menu:view.focusNotifications` | Focus Notifications | Vai alle notifiche | V1-09 (e10d00d), CODE-05 (e9c2244) | approved — owner 2026-11-19 |
| `menu:view.moveTabLeft` | Move Tab Left | Sposta scheda a sinistra | V1-09 (e10d00d), CODE-05 (e9c2244) | approved — owner 2026-11-19 |
| `menu:view.moveTabRight` | Move Tab Right | Sposta scheda a destra | V1-09 (e10d00d), CODE-05 (e9c2244) | approved — owner 2026-11-19 |
| `menu:view.revealInFileTree` | Reveal in File Tree | Mostra nell'albero dei file | V1-09 (e10d00d), CODE-05 (e9c2244) | approved — owner 2026-11-19 |
