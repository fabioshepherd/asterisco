# Wave 1 — UX findings (product/UX auditor)

> **Historical record** of the 1.0 consolidation (November 2026), closed on
> 2026-11-19. It was written in the project's previous repository, now kept as a
> private archive: commit hashes, PR numbers, branch names, `file:line`
> references and scripts cited here refer to that tree and may no longer exist.
> The current state is in [`docs/ROADMAP.md`](../ROADMAP.md) and
> [`CHANGELOG.md`](../../CHANGELOG.md).

- Date: 2026-11-17 · Tree: `consolidation/wave-0` (no product code differs from `5a5ebb8`) · Read-only audit.
- Lens: `PRODUCT.md` (principles, anti-references, "beside the IDE", "one column, never two"), `DESIGN.md`, desktop HIGs. Guiding rule: less is more.
- LOC are non-blank, tests excluded, from `baseline.md` unless marked "(wc)" (raw `wc -l`, tests excluded). Bundle bytes are raw chunk sizes in the current `dist/` (lazy chunks, but shipped in every installer).
- Sources read 2026-11-17: Apple HIG *Settings* and *The menu bar* (developer.apple.com, via the HIG JSON); GNOME HIG *Keyboard reference* (developer.gnome.org/hig/reference/keyboard.html); Microsoft Win32 *Menus* guidelines (learn.microsoft.com/en-us/windows/win32/uxguide/cmd-menus); WCAG 2.2 *Understanding 1.1.1* (w3.org); Tauri 2 *Updater* (v2.tauri.app/plugin/updater/).
- Ranked by user impact. "Rec." marks the recommended option.

---

**UX-01 — Saving rewrites every standalone image's alt text to a number** · *fix*
- What: Crepe's ImageBlock turns any paragraph holding one image into an image block and stores its resize ratio in `alt`; on serialize `![Architecture](a.png)` becomes `![1.00](a.png)`. The app's align override keeps this and appends `left/right`.
- Where: `src/editor/image-align/schema-override.ts:61-84`, `alt-codec.ts:18-23`; upstream `node_modules/@milkdown/components/lib/image-block/index.js:52-70,132-157`. Found by reading code; not yet pinned by e2e (the round-trip spec has no image).
- Why: PRODUCT "The file is the product… no hidden state" and "anything the app writes to a file must survive a `git diff`"; WCAG 2.2 SC 1.1.1 "All non-text content… has a text alternative" (https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html, read 2026-11-17) — the README's alt text is destroyed for GitHub readers.
- Options: **A (rec.)** cut image resize/align (`src/editor/image-align`, ~430 LOC wc) and override `toMarkdown`/`parseMarkdown` so `alt` and `title` round-trip verbatim · B keep resize, persist it outside `alt` (e.g. `<img width>`) — more code, HTML in `.md` · C keep and document the loss.
- Risk: files already saved hold `0.50 left`-style alts; they will now show as literal alt text (original alt is unrecoverable). Add an e2e round-trip case with an image.

**UX-02 — Save right after typing writes stale content (W0-KD-1)** · *fix*
- What: the store only learns edits via Milkdown's ~200 ms debounced listener; Save/Save As write `doc.markdown` without flushing the editor.
- Where: `src/features/file-ops/file-ops.ts:124-148`; `src/editor/CrepeEditor.tsx:232-237`; pinned by `e2e/core.spec.ts` (`test.fail`).
- Why: PRODUCT core flow "open → edit → save"; spec anti-goal "a regression in a core flow". Same gap affects export and copy (they read `doc.markdown` too, `export-ops.ts`).
- Rec.: one "flush active editor" call (Crepe `getMarkdown()` / CodeMirror doc) before save, save-as, export, copy and auto-save; remove the `test.fail`. Small diff.
- Risk: flushing re-triggers dirty/baseline logic — keep `markSaved` snapshot semantics (`document.ts`).

**UX-03 — Smart punctuation is on by default and fires inside inline code** · *fix + simplify*
- What: `--`→`–`, `...`→`…`, straight→curly quotes, default `true`. Rules skip code *blocks* only; ProseMirror input rules default `inCodeMark: true`, so typing `` `--force` `` in inline code becomes `–force`.
- Where: `src/stores/settings.ts:233`; `src/editor/smart-punctuation.ts:43-52`; `node_modules/prosemirror-inputrules/dist/index.js:37` (upstream's own dash/ellipsis rules pass `inCodeMark: false`, lines 161-165).
- Why: PRODUCT users write `CLAUDE.md`/README with CLI flags and commands; "anything the app writes… must survive a `git diff` and a generator's parser". A typographer is a long-form-writer feature (the same retarget that removed focus/typewriter modes, ROADMAP "Retarget review").
- Options: **A (rec.)** default off + pass `inCodeMark: false` · B cut the feature (setting, 2 tests, i18n) · C keep on, fix code marks only.
- Risk: users with a persisted `true` keep it unless a one-time migration flips it; decide explicitly.

**UX-04 — Importers (DOCX, PDF, CSV/TSV, XLSX)** · *cut*
- What: File ▸ Import… and drag-drop convert DOCX (`mammoth` → HTML → `turndown` + GFM plugin), PDF (`pdfjs-dist` + heuristics), CSV/TSV/XLSX (Rust `csv`, `calamine`). Note: there is no HTML importer — `turndown` only serves the DOCX path (`converters/docx.ts:20-23`).
- Why: PRODUCT Operating Context "Files in scope: `.md`, `.markdown`, `.mdx`, `.txt`"; principle 3 "Beside the IDE… loses the moment it starts growing". Converting Word/PDF is a Pandoc job (ROADMAP Phase 3 lists Pandoc).
- Cost/benefit: −526 LOC (`src/features/import`) − ~556 lines Rust (`src-tauri/src/import` 364 + `commands/import.rs` 192, wc incl. tests); −4 npm deps (`mammoth`, `turndown`, `@joplin/turndown-plugin-gfm`, `pdfjs-dist`, `@types/turndown` dev) and 2 crates (`csv`, `calamine`, a Wave-3 major). Bundle: pdf chunk 451 KB + `pdf.worker` 1.27 MB + mammoth chunk ~420 KB.
- Options: **A (rec.)** cut all · B keep CSV/TSV → table only (tiny, Rust `csv`) · C keep all, and fix: an imported doc opens *clean* (`document.ts:147-156`), so closing it discards the conversion without the unsaved prompt.
- Risk: drag-drop of `.md` must keep opening (`drop.ts` route "open" is shared); remove menu/palette entries, Rust commands, capabilities, fixtures, i18n. No persisted settings.

**UX-05 — DOCX export (`markdown-docx`, `fflate`, reference template)** · *cut*
- What: Export Word… plus a "reference template" restyler that unzips/rezips the DOCX to copy styles, with its own settings row and file picker.
- Why: principle 3 (Word fidelity is Pandoc's domain, Phase 3); HTML and PDF already cover sharing; Apple HIG *The menu bar*: "Reserve the Export As item for when you need to let people export content in a format your app doesn't typically handle" — keep that list short.
- Cost/benefit: `restyle-docx.ts` 243 + `reference-template.ts` 40 + DOCX part of `export-ops.ts` ~60 + `DocxTemplateField.tsx` 97 (wc); −2 deps; `markdown-docx` chunk ~765 KB.
- Options: **A (rec.)** cut DOCX export entirely · B keep plain DOCX export, cut the template restyle (drops `fflate`, ~380 LOC, one setting) · C keep.
- Risk: persisted `docxReferenceTemplatePath` must be ignored on hydrate and dropped from `settings-io.ts`; PRODUCT/README capability lists change.

**UX-06 — Split editor** · *cut*
- What: two side-by-side panes (each with its own tab strip), right-edge drop zone, divider, "Open to side", "Move tab to other pane", `mod+\`.
- Where: `src/features/split` (569 LOC), `src/stores/pane-model.ts` (196 wc), ~59 pane references in `src/stores/document.ts`; entries in `CommandPalette.tsx:300-332`, `keybindings.ts:127-131`, tab and tree context menus, `file-ops.ts:120`.
- Why: Design principle 2 "One column, never two"; principle 5 "Chrome earns its pixels"; Operating Context "a second window beside the IDE" — the window is already the narrow half of the screen. (It shows two files, not a preview, so it is not the anti-reference literally; the cost is chrome and a two-pane state model under every tab action.)
- Options: **A (rec.)** cut split and tree→editor drag; keep tab drag-reorder (see UX-07) · B cut split and all drag-and-drop · C keep.
- Risk: layout is not persisted (no store migration). A stored `splitEditor` binding lingers in the keybindings store (`hydrate` merges unknown ids, `keybindings.ts` `hydrate`) — filter unknown ids on hydrate.

**UX-07 — `dnd-kit`** · *simplify (follows UX-06)*
- What: `@dnd-kit/core`, `sortable`, `utilities` drive tab reorder, cross-pane moves, edge-split and tree-file drags through `WorkspaceDndProvider` (186 wc).
- Why: tab drag-reorder is a universal desktop convention (opinion); everything else exists for split.
- Options: **A (rec.)** keep `core`+`sortable`+`utilities` for in-strip tab reorder only; delete `WorkspaceDndProvider`, `EdgeDropZone`, pane droppables, tree `useDraggable` (`FileTree.tsx:86`) · B drop dnd-kit entirely (reorder via existing `mod+shift+PageUp/PageDown` and context menu; ~29 KB gz of ESM).
- Risk: keyboard reorder already exists, so B loses only mouse drag.

**UX-08 — Definition lists (W0-KD-2)** · *cut*
- What: non-GFM `Term\n: Def` syntax; an unedited save rewrites it (`:   Def`, extra trailing blank line).
- Where: `src/editor/definition-lists.ts` (378 wc); deps `mdast-util-definition-list`, `micromark-extension-definition-list`; pinned by `e2e` `test.fail`.
- Why: PRODUCT "anything the app writes to a file must survive a `git diff`"; the target syntax is GFM ("full GFM"); GitHub does not render definition lists (opinion: verify), so for most of this audience the syntax is foreign.
- Options: **A (rec.)** cut the extension; the text then round-trips as a plain paragraph (verify with the existing spec) · B keep and fix the serializer (marker spacing, `spread`).
- Risk: MkDocs `def_list` users lose in-editor rendering only; their files stay byte-exact.

**UX-09 — Settings rows that should not exist** · *cut*
- What and where (`src/stores/settings.ts`, `SettingsPanel.tsx`): (a) image path mode "inline base64" (`image-upload.ts:54`) — embeds megabytes of base64 in the `.md`; (b) auto-save mode + interval (`use-auto-save.ts`, `on-change-auto-save.ts`) — keep one on/off switch with the on-change debounce (1 s) + blur flush; (c) settings import/export (`settings-io.ts`, 88 wc) for ~20 preferences; (d) the default `mod+shift+a` that silently toggles auto-save from anywhere (`keybindings.ts:143`) — keep the status-bar toggle and palette entry.
- Why: Apple HIG *Settings*: "Minimize the number of settings you offer… too many settings can make the experience feel less approachable"; PRODUCT principle 1 and "survive a `git diff`" (base64).
- Rec.: cut (a)–(d); (e) optional: drop `revealActiveFile` (always follow; palette "Reveal in file tree" stays).
- Risk: persisted `imagePathMode`, `autoSaveMode`, `autoSaveInterval` must be ignored on hydrate; users on interval mode change cadence. Untitled docs keep their base64 fallback (`image-upload.ts:15`).

**UX-10 — "Export PDF…" is printing; call it Print… (Mod+P)** · *simplify*
- What: PDF export opens a print window and the OS print dialog; the user picks "Save as PDF" there.
- Where: `src/features/export/export-ops.ts` (`exportActiveDocumentPdf`), `menu-model.ts:85`, `en/menu.json` `file.export.pdf`.
- Why: GNOME HIG keyboard reference: "Print — Ctrl+P — Prints the current content item, and opens the print dialog"; Apple HIG *The menu bar*: Print "lets people print… or save as a PDF". `mod+p` is unbound today.
- Rec.: rename to Print…, move out of Export to File, add `CmdOrCtrl+P`. Same code path; i18n it/en.
- Risk: `mod+p` must not clash with a user's custom binding (`reserved-combos` derives from the menu model).

**UX-11 — Menu duplicates and labels** · *simplify*
- What: Close appears in File and Window with the same accelerator (`menu-model.ts:96,170`); Toggle Theme is in the app menu and View (`:53,148`); File ▸ Close closes a tab.
- Why: Apple HIG *The menu bar*: "The Window menu doesn't help people customize the appearance of windows or close them… to close a window, people choose Close in the File menu"; "For a tab-based window, Close Tab replaces Close". Microsoft menus: "Don't put different menu items that use the same name in multiple categories".
- Rec.: remove Close from Window and Toggle Theme from the app menu; label File ▸ Close as "Close Tab". Labels "Toggle …" vs HIG show/hide wording: leave to Wave 2.
- Risk: menu-model tests and the native menu spec snapshot change; `reserved-combos` derivation unchanged.

**UX-12 — Status bar carries nine readouts** · *simplify*
- What: view mode, path, saved state, auto-save toggle, caret line:col, selection words, selection characters, words, characters, reading time (`StatusBar.tsx:116-158`).
- Why: PRODUCT design principle 5 "Chrome earns its pixels"; DESIGN "The tool disappears into the task".
- Rec.: keep view mode, path, saved state, auto-save toggle, words (selection-aware); cut characters (doc + selection) and reading time; caret only in source mode (opinion).
- Risk: `word-count.ts` stats and their tests shrink; i18n keys removed at parity.

**UX-13 — `motion`** · *simplify*
- What: `motion/react` in 13 files (dialogs, toasts, sidebar, tabs, status bar, theme crossfade), in the main chunk via `LazyMotion`.
- Why: DESIGN §Motion "Motion conveys state and feedback only"; `ThemeCrossfade.tsx` is a decorative wash ("Signature moment #3"), the status-bar saved "settle" is decoration on the save path.
- Options: **A (rec.)** keep `motion`, cut `ThemeCrossfade` and the status-bar settle · B replace `motion` with CSS transitions and drop the dependency — decide in Wave 3 with the pending 12→14 major (risk: exit animations need `@starting-style`/`allow-discrete` in WebKitGTK) · C keep all.
- Risk: A is low; reduced-motion paths already exist.

**UX-14 — Command palette duplicates the command registry** · *simplify*
- What: the palette declares its own ~45 entries beside `COMMANDS` (`src/app/menu/commands.ts`); groups and logic drift (Toggle Theme is "app" in the palette, View in the menu, and its logic is re-implemented at `CommandPalette.tsx:387-395`). It also has an accent-picker subpage (`:167`) duplicating Settings.
- Why: PRODUCT design principle 5 (restrained personalization, chrome earns its pixels); one command, one name, everywhere (opinion).
- Rec.: drop the accent subpage; derive palette commands from `COMMANDS` (the code change belongs to Wave 3 — flag it there). 917 LOC area.
- Risk: palette "recent commands" ids (`recent-commands.ts`) must map to the new ids.

**UX-15 — Settings panel mechanics** · *simplify (after UX-04/05/09)*
- What: a 1,430-line sheet with search, a scroll-spy section rail (`SettingsPanel.tsx:67-73,575-592,1370`), and search-flattened rendering.
- Why: Apple HIG *Settings*: "Minimize the number of settings you offer"; after the cuts ~15 preference rows + 14 shortcuts remain.
- Rec.: keep search (it serves the shortcut list) and plain section jump links; cut scroll-spy sync (opinion). Splitting the file is Wave 3.
- Risk: Help ▸ Keyboard Shortcuts deep link (`initialSection`) must still land on Shortcuts.

**UX-16 — Updater** · *keep, simplify*
- What: manual check only (good for principle 4). `manual=false` silent branch is dead — every caller passes `true` (`commands.ts:117`, `CommandPalette.tsx:379`). After install it says "ready" with no relaunch.
- Why: PRODUCT principle 4 "No call leaves the device without an explicit user action" (holds). PRODUCT "Nothing is public": the endpoint (`tauri.conf.json:44-47`) points at a private repo, so every check fails today. Tauri 2 Updater docs list AppImage/`.app.tar.gz`/MSI-NSIS updater artifacts — a `.deb` install cannot self-update (https://v2.tauri.app/plugin/updater/, read 2026-11-17).
- Options: **A (rec.)** keep; remove the dead branch; release gate owns the feed · B remove the updater until a public feed and name exist (−1 plugin, −1 network path), re-add at release.
- Risk: B touches capabilities and `tauri.conf.json` signing config.

**UX-17 — Unlocalized strings (gate snapshot)** · *fix*
- What: Crepe image-block labels left at English defaults (`CrepeEditor.tsx:180-186`); `"Invalid regular expression"` literal and raw engine messages (`find-utils.ts:45`).
- Why: CLAUDE.md "UI strings only via i18n (`it` + `en`)"; PRODUCT "Bilingual by commitment".
- Rec.: localize the image-block texts that survive UX-01; map regex errors to one localized message.
- Risk: none beyond i18n parity tests.

**UX-18 — Examined and kept as is**
- Edit / reading / source views and distraction-free (reading is principle 2; each is cheap); welcome doc + empty state (skips when launched from a file — principle "Open and see"); outline; find & replace; workspace search; file tree (filter, trash-only delete); tabs (MRU `Ctrl+Tab`, inline rename); custom keybindings (ROADMAP `[V1]` fixes for `reserved-combos`/File accelerators are Wave 3 required work); appearance axes, presets and custom CSS (PRODUCT principle 5 "deep but restrained"; presets kept by owner 2026-08-17); copy as HTML/Markdown.
- Hand-off to Wave 2: `LINE_WIDTH` default is 90ch (`settings.ts`) while DESIGN §Components says "centred to a `66ch` measure".

---

## Later (ideas, not proposals for this wave)
- Open Recent submenu in File (Apple HIG lists it as standard).
- Disabled menu states (Apple HIG "disable the action instead of hiding it"; Microsoft "Disable menu items that don't apply") — already ROADMAP `[Plus]`.
- Relaunch button after an update installs (needs `plugin-process`).
- Reveal in Finder/Explorer from the tree context menu.
