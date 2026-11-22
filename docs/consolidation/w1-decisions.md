# Wave 1 — decisions

> **Historical record** of the 1.0 consolidation (November 2026), closed on
> 2026-11-19. It was written in the project's previous repository, now kept as a
> private archive: commit hashes, PR numbers, branch names, `file:line`
> references and scripts cited here refer to that tree and may no longer exist.
> The current state is in [`docs/ROADMAP.md`](../ROADMAP.md) and
> [`CHANGELOG.md`](../../CHANGELOG.md).

Sources: `w1-ux-findings.md` (product/UX auditor), `w1-cost-findings.md` (cost auditor), `gate-snapshot.md`.
Bundle figures are gzip, sourcemap-attributed (±5%). LOC are non-blank, tests excluded.
Order: required fixes first (decided as "how", not keep/cut), then owner decisions by impact.

## Required (fix; no keep/cut question)

### V1-01 — Flush the editor before save, save-as, export, copy, auto-save (W0-KD-1, UX-02)
- What: one "flush active editor" step before every read of `doc.markdown` for output; remove the `test.fail` on the save-race spec.
- Why: core flow open → edit → save (spec anti-goal: core-flow regression); today Ctrl+S within ~200 ms of typing writes stale text.
- Cost/benefit: small diff in `file-ops.ts`, `export-ops.ts`, `CrepeEditor.tsx`/`SourceEditor`; fixes silent data loss.
- Risk: flushing must not break dirty/baseline semantics (`markSaved` in `document.ts`).
- Recommendation: fix
- Decision: approved (required)

### V1-02 — Localize the remaining hardcoded strings (gate snapshot, UX-17)
- What: Crepe image-block labels (`CrepeEditor.tsx:180-186`) that survive UX-01, and the regex error in `find-utils.ts:45`, via i18n it + en.
- Why: CLAUDE.md "UI strings only via i18n"; PRODUCT "Bilingual by commitment".
- Cost/benefit: a few keys per locale.
- Risk: none beyond parity tests.
- Recommendation: fix
- Decision: approved (required); outcome: regex-engine detail tooltip removed instead of localized — owner approved 2026-11-18

### V1-03 — Smart punctuation must not fire inside inline code (UX-03, part 1)
- What: pass `inCodeMark: false` to the input rules so `` `--force` `` stays `--force`.
- Why: PRODUCT "anything the app writes to a file must survive a `git diff`"; the audience types CLI flags in `CLAUDE.md`/README.
- Cost/benefit: one option + one test.
- Risk: none.
- Recommendation: fix
- Decision: superseded by UX-03 B (feature removed)

### V1-04 — Metrics script counts `.mjs` assets (tooling)
- What: `scripts/consolidation-metrics.mjs` misses `pdf.worker.min.mjs` (379 KB gz); count `.mjs` and re-record the baseline row as "baseline (corrected)".
- Why: the before/after table must be honest.
- Cost/benefit: a one-line glob change.
- Risk: none (not product code).
- Recommendation: fix
- Decision: approved (coordinator, tooling)

## Owner decisions

### UX-01 — Saving rewrites a standalone image's alt text to a number
- What: Crepe's image block stores the resize ratio in `alt`: `![Architecture](a.png)` is saved as `![1.00](a.png)`; the app's align override keeps this.
- Why: PRODUCT "The file is the product… no hidden state"; WCAG 2.2 SC 1.1.1 (alt text destroyed for GitHub readers).
- Cost/benefit: A removes `src/editor/image-align` (~430 LOC) and fixes the data loss.
- Risk: files already saved keep alts like `0.50 left` (the original alt is unrecoverable); add an e2e round-trip case with an image.
- Options: **A (rec.)** cut image resize/align, alt and title round-trip verbatim · B keep resize, store it as `<img width>` HTML (more code, HTML in `.md`) · C keep, document the loss.
- Recommendation: fix (A)
- Decision: approved (A) — owner 2026-11-17

### UX-03 — Smart punctuation default (part 2)
- What: `--`→`–`, `...`→`…`, curly quotes, on by default.
- Why: a long-form-writer feature (same retarget that removed focus/typewriter modes); the audience writes code-adjacent text.
- Options: **A (rec.)** default off; users who turned it on explicitly keep it (no migration of a persisted value) · B cut the feature · C keep on.
- Risk: A changes the default only for new installs/users who never touched it.
- Recommendation: simplify (A)
- Decision: approved (B: cut the feature) — owner 2026-11-17

### UX-04 — Importers (DOCX, PDF, CSV/TSV, XLSX)
- What: File ▸ Import… and drag-drop conversion. (There is no HTML importer; `turndown` serves DOCX only.)
- Why: PRODUCT "Files in scope: .md, .markdown, .mdx, .txt"; principle 3 "Beside the IDE"; Word/PDF conversion is Pandoc's job.
- Cost/benefit: −526 LOC TS, −~310 LOC Rust, −4 npm deps, −3 crates (`csv`, `calamine`, `base64` if unused elsewhere), −5 Rust commands; ~620 KB gz of lazy JS (PDF lib + worker, mammoth).
- Risk: dragging a `.md` must keep opening; remove menu/palette entries, capabilities, fixtures, i18n.
- Options: **A (rec.)** cut all · B keep CSV/TSV → table only · C keep all.
- Recommendation: cut (A)
- Decision: approved (A: cut all importers) — owner 2026-11-17

### UX-05 — DOCX export
- What: Export Word… plus a reference-template restyler with its own setting and file picker.
- Why: principle 3; HTML and print/PDF already cover sharing; Apple HIG keeps Export short.
- Cost/benefit: A: −~440 LOC, −2 npm deps (+20 transitive), −226 KB gz lazy, −4 KB initial (`fflate`), −1 setting.
- Risk: persisted `docxReferenceTemplatePath` must be dropped on load.
- Options: **A (rec.)** cut DOCX export · B keep plain DOCX, cut the template restyle · C keep.
- Recommendation: cut (A)
- Decision: approved (A: cut DOCX export) — owner 2026-11-17

### UX-06/07 — Split editor and drag-and-drop
- What: two side-by-side panes, edge drop zone, "Open to side", `mod+\`; `dnd-kit` serves split, tree→editor drag and tab reorder.
- Why: design principle 2 "One column, never two"; principle 5 "Chrome earns its pixels".
- Cost/benefit: −569 LOC split + ~196 pane-model + pane logic in `document.ts`; the two-pane state model goes away. B also drops `dnd-kit` (−16 KB gz initial).
- Risk: a stored `splitEditor` keybinding must be dropped on load.
- Options: **A (rec.)** cut split and tree→editor drag; keep drag to reorder tabs (dnd-kit stays, smaller) · B cut split and all drag-and-drop (tabs reorder by keyboard/context menu) · C keep.
- Recommendation: cut (A)
- Decision: approved (A: cut split + tree→editor drag; keep tab drag-reorder) — owner 2026-11-17

### UX-08 — Definition lists (W0-KD-2)
- What: non-GFM `Term` / `: Def` syntax; an unedited save rewrites it.
- Why: PRODUCT "survive a `git diff`"; target syntax is GFM.
- Cost/benefit: A: −344 LOC, −2 npm deps; the text round-trips as a plain paragraph.
- Risk: MkDocs `def_list` users lose in-editor rendering only; files stay byte-exact.
- Options: **A (rec.)** cut · B keep and fix the serializer.
- Recommendation: cut (A)
- Decision: approved (A: cut definition lists) — owner 2026-11-17

### UX-09 — Settings that should not exist
- What: (a) "inline base64" image mode; (b) auto-save mode + interval → one on/off switch (save 1 s after typing stops + on blur); (c) settings import/export; (d) the default `mod+shift+a` that toggles auto-save (status bar and palette keep it).
- Why: Apple HIG Settings "Minimize the number of settings you offer"; base64 bloats the `.md`.
- Cost/benefit: −4 settings rows, −~150 LOC.
- Risk: persisted values ignored on load; interval-mode users change cadence.
- Recommendation: cut (a)–(d)
- Decision: approved (cut a–d) — owner 2026-11-17

### UX-10 — "Export PDF…" becomes File ▸ Print… (Mod+P)
- What: same code path (it already opens the OS print dialog); rename, move out of Export, add `CmdOrCtrl+P`.
- Why: GNOME HIG and Apple HIG: Print / Ctrl+P, "save as a PDF" from the print dialog.
- Risk: `mod+p` must not clash with a custom binding.
- Recommendation: simplify
- Decision: approved — owner 2026-11-17

### UX-11 — Menu duplicates and labels
- What: remove Close from the Window menu and Toggle Theme from the app menu; label File ▸ Close as "Close Tab".
- Why: Apple HIG menu bar ("Close Tab replaces Close"); Microsoft: no same-name items in multiple menus.
- Risk: menu snapshot tests change.
- Recommendation: simplify
- Decision: approved — owner 2026-11-17

### UX-12 — Status bar readouts
- What: keep view mode, path, saved state, auto-save toggle, words (selection-aware); cut characters (doc and selection) and reading time; caret line:col only in source mode.
- Why: principle 5 "Chrome earns its pixels".
- Recommendation: simplify
- Decision: approved — owner 2026-11-17

### UX-13 — Motion
- What: keep the `motion` library for state feedback; cut the decorative theme crossfade and the "saved" settle animation. Replacing `motion` with CSS is a Wave 3 question.
- Why: DESIGN §Motion "Motion conveys state and feedback only".
- Recommendation: simplify
- Decision: approved — owner 2026-11-17

### UX-14 — Command palette accent subpage
- What: drop the accent picker inside the palette (it duplicates Settings). Deriving palette commands from the menu registry goes to Wave 3.
- Why: principle 5; one command, one place (opinion).
- Recommendation: simplify
- Decision: approved — owner 2026-11-17

### UX-15 — Settings panel scroll-spy
- What: keep search and section links; cut the scroll-spy that syncs the section rail while scrolling.
- Why: after the cuts ~15 preference rows remain (Apple HIG Settings).
- Risk: Help ▸ Keyboard Shortcuts must still land on Shortcuts.
- Recommendation: simplify (opinion)
- Decision: approved — owner 2026-11-17

### UX-16 — Updater
- What: manual check only; the silent-check branch is dead code; the feed points at a private repo, so checks fail today; a `.deb` install cannot self-update.
- Why: principle 4 holds (no call without user action).
- Options: **A (rec.)** keep, remove the dead branch; the feed is a release-gate matter · B remove the updater until a public feed exists.
- Recommendation: keep, simplify (A)
- Decision: approved (A: keep, remove dead branch) — owner 2026-11-17

## Kept without a question
Edit/reading/source views, distraction-free, welcome, outline, find & replace, workspace search, file tree, tabs, custom keybindings, appearance and custom CSS, copy as HTML/Markdown (UX-18); Mermaid (959 KB gz but lazy, zero first-paint cost; diagrams render on GitHub). Wave 2 hand-off: default line width 90ch vs DESIGN 66ch. Wave 3 hand-offs: palette derived from `COMMANDS`, `motion` vs CSS, KaTeX shipped twice, settings file split.

## Later
Open Recent submenu; disabled menu states; relaunch after update; reveal in Finder/Explorer.
