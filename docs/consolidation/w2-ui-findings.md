# Wave 2 — UI findings (visual / design system)

> **Historical record** of the 1.0 consolidation (November 2026), closed on
> 2026-11-19. It was written in the project's previous repository, now kept as a
> private archive: commit hashes, PR numbers, branch names, `file:line`
> references and scripts cited here refer to that tree and may no longer exist.
> The current state is in [`docs/ROADMAP.md`](../ROADMAP.md) and
> [`CHANGELOG.md`](../../CHANGELOG.md).

Auditor: visual / design-system reviewer · Read 2026-11-18 · Tree: branch HEAD `521296d` (Wave 1 landed).
Authority: `DESIGN.md` (normative for visuals), `docs/THEMING.md`, `PRODUCT.md`. No external source was needed;
items without a DESIGN/THEMING/PRODUCT quote are labelled "opinion".
Evidence: production bundle (`bun run build && bun run preview`) driven by Playwright with the e2e IPC mock
(`e2e/support/`), 1280×800 @1x, light + dark, plus four accent × neutral combinations. Screenshots and the
helper specs are in `.superpowers/sdd/2026-11-17-consolidation/w2-shots/` (gitignored): `welcome-*`, `edit-*`,
`reading-*`, `source-*`, `find-*`, `search-*`, `palette-*`, `settings{,2,3,4}-*`, `dialog-*`, `contextmenu-*`,
`menu-*`, `slash-light`, `combo-*`.

Ranked by impact. 20 findings.

---

### UI-01 — Switching to source mode crashes the editor pane with two documents open
- What: open two files, click the first tab, pick Source → ErrorBoundary "Something went wrong"; page error `MilkdownError: Context "editorView" not found` from `getMarkdown` (`source-dark.png` of the first run; repro `w2-shots/crash.shots.ts`). One document alone does not crash.
- Where: `src/editor/SourceEditor.tsx:69-72` (seeds from `getEditorsForDoc(id)[0]?.getMarkdown()`), likely a destroyed Crepe instance still registered after the V1-01 flush work (`src/editor/flush-editor.ts`, `active-editor.ts`).
- Why: spec anti-goal "a regression in a core flow (… reading/source/edit switch)"; the e2e "view switch" spec only opens one file.
- Cost/benefit: small guard + an e2e case with two tabs; restores a core flow.
- Risk: none beyond the fix itself. Not a visual item — passed on because it blocks this wave's views.
- Recommendation: **fix** (Wave 3 editor area, or now as a required item).

### UI-02 — Every code block is rendered twice, in two syntax palettes
- What: a fenced `ts` block shows the CodeMirror editor (Crepe's default `oneDark` theme — dark line-number chip even in light mode) **and** a "Preview" panel of the same code highlighted again by `@tanstack/highlight` with `code-theme.css`. In reading view both stay (blocks mounted in edit mode keep `previewOnlyMode=false`).
- Where: `src/editor/CrepeEditor.tsx:105-111` (no `theme`, `renderPreview` for every language), `src/editor/code-block-preview.ts:16-25`, `src/editor/highlight.ts`; shots `edit-*`, `reading-*`.
- Why: PRODUCT anti-reference "two columns showing the same thing twice"; DESIGN §5 Reading Surface "Code blocks … rendered with real care"; DESIGN §2 "Every colour pair measured" (oneDark is not).
- Cost/benefit: return `null` from `renderPreview` for non-Mermaid/LaTeX languages (Crepe then hides the panel) and pass a token theme to `Crepe.Feature.CodeMirror.theme` mapped to the `--th-*` variables. Drops `@tanstack/highlight` (0.0.9, only used here) and `highlight.ts` (79 LOC); one palette for code everywhere.
- Risk: the CodeMirror highlight style must cover the languages the preview did; check the code-theme contrast test still applies.
- Recommendation: **simplify**.

### UI-03 — `cn()` silently strips `text-data`, so shortcuts and paths render in sans
- What: tailwind-merge does not know the custom `text-data` utility and treats it as a colour, so a later `text-muted-fg`/`text-fg` removes it: `cn("text-data text-muted-fg")` → `"text-muted-fg"` (verified with bun). Menubar accelerators, the settings shortcut recorder and the filtered-files folder path are in Source Sans at 14px (`menu-light.png`, `settings3-dark.png`).
- Where: `src/lib/utils.ts:5-7`; call sites `src/components/ui/menubar.tsx:123`, `src/features/settings/SettingsPanel.tsx:432`, `src/features/file-tree/FilteredFiles.tsx:85`.
- Why: DESIGN §3 Machine-Data Rule "paths, counts, sizes, timestamps, shortcuts … set in mono at label size. A word count in sans is a bug".
- Cost/benefit: one `extendTailwindMerge` entry putting `text-data` in the font-size group (no new dependency); fixes every current and future call site.
- Risk: none; add a unit test for `cn("text-data text-fg")`.
- Recommendation: **fix**.

### UI-04 — The line-width setting does not reach reading view, and its hint says the opposite
- What: Settings "Line width (ch)" (default 90, `src/stores/settings.ts:43`) only drives edit mode; reading view hardcodes `--editor-measure: 66ch`, +1px font size, `h1 2.1em` and animates the switch; source mode hardcodes `50rem` and `line-height 1.7`. The hint reads "Caps the reading column width. Editing mode stays a little wider." and presets label `lineWidth` "Reading measure".
- Where: `src/styles/editor-theme.css:277-289`, `src/editor/SourceEditor.tsx:33-35`, `src/i18n/locales/*/editor.json` (`hints.lineWidth`), `src/features/themes/themes.ts:16`.
- Why: DESIGN §3 66ch Rule "capped at ~66ch (user-tunable 50–90ch)" — the user cannot tune it; PRODUCT Positioning "editing surface and rendered page are literally the same thing" — today the column reflows on every mode switch. DESIGN Display is `2em`, not 2.1em.
- Options: **A (rec.)** one measure for all three views, default 66ch, setting drives it; delete the reading overrides (66ch, +1px, 2.1em, transition) and source's 50rem/1.7; DESIGN §3 drops the "drafting is wider" sentence (owner edit). · B keep two measures: the setting drives reading (default 66), edit = setting + 24ch, source follows edit; fix the hint. · C keep, only correct the hint and preset comment.
- Risk: A changes edit width for existing users who never touched the setting (90 → 66); wide blocks already break out.
- Recommendation: **simplify (A)**.

### UI-05 — The active file row is a solid accent bar, the loudest thing on screen
- What: the file the user is reading gets `bg-primary text-primary-fg` across the full sidebar width — in dark mode a bright `orange-11` band (`edit-dark.png`). Outline marks its current row with `bg-muted`, tabs with a 2px accent underline.
- Where: `src/features/file-tree/FileTree.tsx:333`, `src/features/file-tree/FilteredFiles.tsx:70-71`.
- Why: DESIGN §2 Signal Rule "Never decoration, never a fill behind neutral content … If a screen reads as 'orange', the signal has leaked"; DESIGN §5 Menus "Selected/hover row uses muted surface; the active item may carry the signal".
- Cost/benefit: two class strings → `bg-muted text-fg font-medium` (the outline's treatment); one "current" look across tree, outline and filtered list.
- Risk: none (contrast improves); `aria-current` already carries the state.
- Recommendation: **fix**.

### UI-06 — Crepe's floating chrome is off-system (serif, ALL CAPS, unlocalized)
- What: the slash menu, selection toolbar and code-block tools inherit `--crepe-font-default` (the reading serif): bold serif menu items, an ALL-CAPS "TEXT" group heading, serif "Copy"/"Hide" buttons and "LaTeX" language chip; the preview toggle reads "Hide"/"Edit" in English in both locales; radius ~16px and no hairline.
- Where: `src/styles/editor-theme.css:15-45` (only `--crepe-font-*` mapped), `src/editor/CrepeEditor.tsx:105-111` (no `previewToggleText`); shots `slash-light.png`, `find-light.png`.
- Why: DESIGN §3 One-Voice "never let the reading serif leak into a UI label or a button"; DESIGN §3 Label "never ALL CAPS"; CLAUDE.md "UI strings only via i18n"; DESIGN §5 floating surfaces "hairline border, rounded-md/lg".
- Cost/benefit: one CSS block (`font-family: var(--font-sans)`, `text-transform: none`, `--radius-lg`, `border`) on Crepe's floating classes + two i18n keys.
- Risk: Crepe class names are internal — pin by a visual check after Milkdown upgrades.
- Recommendation: **fix**.

### UI-07 — Source mode uses CodeMirror's light-only highlight colours in dark mode
- What: `defaultHighlightStyle` paints markup in `#219`, `#708`, `#404740` regardless of theme: 1.4:1, 1.9:1 and 2.0:1 on the dark page (`source-dark.png`: fences, `---`, `ts` near-invisible).
- Where: `src/editor/SourceEditor.tsx:3,85`.
- Why: DESIGN §2 "Every colour pair measured, not inherited"; PRODUCT Accessibility "sufficient contrast in every theme/accent/neutral combination".
- Cost/benefit: replace with a small `HighlightStyle` bound to tokens (markup → `--muted-fg`, heading bold, emphasis italic, link `--primary`), shared with UI-02's code-block theme.
- Risk: none.
- Recommendation: **fix**.

### UI-08 — Two segmented-control styles; settings shows four solid accent fills at once
- What: the status-bar view switch marks the current segment with a muted chip; Settings' Theme, Neutral base, Language and the accent list use `variant="default"` (solid `--primary`) for the selected option, so a resting settings panel shows 3–4 solid signal fills plus switches.
- Where: `src/features/settings/SettingsPanel.tsx:216-233`, `src/features/settings/AccentPicker.tsx:149`, `src/features/status-bar/ViewModeControl.tsx:74-80`; shots `settings-*`, `combo-*`.
- Why: DESIGN §5 Components "one solid signal fill on the single primary action"; DESIGN §2 Signal Rule.
- Cost/benefit: one selected style (muted chip + `text-fg`, as `ViewModeControl`) via one small shared radio-group; settings goes grey at rest.
- Risk: the selected state must stay distinguishable without colour (chip + `aria-checked`, already present).
- Recommendation: **simplify**.

### UI-09 — Four hand-rolled modal shells with drifting details
- What: `NameDialog`, `UnsavedPromptDialog`, `NoticesDialog` each re-build overlay + centred panel + motion; the overlay is `bg-black/40` (×3) and `rgb(0 0 0 / 0.4)` in the palette although `--scrim` exists "so every overlay shares one knob"; only `NameDialog` has the hairline border (palette, unsaved and notices have none, so in dark mode the panel edge is the shadow alone); `NameDialog` uses a raw `<input>` with its own focus style instead of `Input`.
- Where: `src/features/file-tree/NameDialog.tsx:47-80`, `src/features/file-ops/UnsavedPromptDialog.tsx:28-35`, `src/features/settings/NoticesDialog.tsx:53-62`, `src/features/command-palette/command-palette.css:31,51`, `src/styles/global.css:79`.
- Why: DESIGN §5 Menus & Floating Surfaces "Surface background, hairline border, rounded-md/lg, and the single floating shadow"; CLAUDE.md "never hand-author hex/oklch".
- Cost/benefit: one `components/ui/dialog.tsx` (overlay = `bg-scrim`, panel = border + `shadow-card`), three call sites shrink; net fewer lines.
- Risk: keep Radix focus-trap/Escape semantics identical; dialog e2e covers unsaved prompt.
- Recommendation: **simplify**.

### UI-10 — Icon buttons re-implemented 32 times, with four press scales
- What: 32 raw `<button>`s (vs 24 `<Button>`) re-type the ghost icon-button class string; `active:scale` is 0.9, 0.95 (×8), 0.97 (×8) and 0.98 (Button). Focus treatment also varies (outline vs ring, inset vs offset).
- Where: e.g. `src/features/file-tree/Sidebar.tsx:74,99,113,128,189`, `src/features/tabs/TabBar.tsx:186`, `src/features/settings/NoticesDialog.tsx:72`, `src/features/status-bar/*`.
- Why: DESIGN §5 Buttons "Active: scale(0.98) — the quiet press"; "Ghost: transparent; hover fills to muted surface".
- Cost/benefit: use `<Button variant="ghost" size="icon-sm">`; one press, one focus ring, less markup.
- Risk: tab close button keeps its hover-reveal opacity class.
- Recommendation: **simplify**.

### UI-11 — Preset themes contradict the design brief they sit under
- What: five preset cards in a 2-column grid; one is named after the **provisional product name** (undecided at the time, user-visible), "Editorial" is described "Warm book-like serif for long reads" (Sand + Bronze), two presets switch the reading body to sans. Each preset only seeds settings the panel already exposes right below it.
- Where: `src/features/settings/ThemePresetPicker.tsx` (137 LOC), `src/features/themes/themes.ts` (119 LOC), `presetThemes.*` i18n; shot `settings-light.png`.
- Why: PRODUCT "Do not invent [a name], and do not treat the placeholder as settled"; DESIGN §6 "Don't reach for the warm-paper editorial costume"; "Don't build … identical card grids"; One-Voice "Source Serif 4 owns the reading surface"; PRODUCT principle 5 "personalization … stays deep but restrained".
- Options: **A (rec.)** cut presets (−256 LOC + tests + i18n; neutral/accent/font controls stay) · B keep, rename that one → "Default", drop "Editorial", list as rows not cards.
- Risk: A removes a Wave 1 "kept" surface — owner call; no persisted value (active preset is derived).
- Recommendation: **cut (A)**.

### UI-12 — "Show ignored folders" has two controls
- What: an eye/eye-off icon button in the sidebar header and a switch in Settings ▸ Workspace toggle the same persisted preference.
- Where: `src/features/file-tree/Sidebar.tsx:105-116`, `src/features/settings/SettingsPanel.tsx:907-912`.
- Why: PRODUCT design principle 5 "Chrome earns its pixels"; DESIGN §5 Status Line logic "commands with a home elsewhere do not also earn a permanent button".
- Cost/benefit: drop the header button (−1 of 4 header icons); the setting stays, with its explanatory hint.
- Risk: users who toggle it often lose one click — palette entry can cover it if wanted.
- Recommendation: **cut** the header button.

### UI-13 — Document chrome shown with no document open
- What: on the welcome screen the status bar still shows the source/edit/reading switch, the auto-save toggle and "0 words"; the sidebar outline shows "No headings yet. Add a # heading…".
- Where: `src/features/status-bar/StatusBar.tsx:69-143`, `src/features/file-tree/Sidebar.tsx:209-245`; shot `welcome-light.png`.
- Why: DESIGN §5 Status Line "reports state that has to be seen" — there is no document state; PRODUCT design principle 5.
- Cost/benefit: render the view switch, words and outline section only when `hasDocument`; first frame is calmer.
- Risk: none.
- Recommendation: **simplify**.

### UI-14 — Token misuse sweep (small, mechanical)
- What: `.mermaid-error` uses `--danger` (red-9) as text, 3.4:1 on `--muted`; `.fn-popover` hand-authors `box-shadow: 0 8px 24px rgb(0 0 0 / 12%)` and `z-index: 50` instead of `--shadow-card`/`--z-modal`; `.cmdk-footer kbd` at 0.6875rem (off the 12px label/data size); export `FALLBACK_LIGHT` is an indigo/blue palette (`#3b5bdb`) that is not the Gray/Orange default.
- Where: `src/styles/editor-theme.css:256,421`, `src/features/command-palette/command-palette.css:163`, `src/features/export/theme-snapshot.ts:21-34`.
- Why: THEMING token map "`--danger` … (non-text)", "`--danger-text` … error copy"; DESIGN §4 "the *only* shadow"; DESIGN §3 Data "0.75rem".
- Cost/benefit: ~6 one-line edits.
- Risk: none.
- Recommendation: **fix**.

### UI-15 — The reading/edit switch animates the whole document
- What: switching to reading view transitions `padding-inline` and `font-size` of the ProseMirror root for 160ms with plain `ease` — every line reflows through intermediate widths.
- Where: `src/styles/editor-theme.css:281-283`.
- Why: DESIGN §5 Reading Surface "This surface is sacred: chrome, motion and accent colour stay off it"; DESIGN §5 Motion "`ease-snappy`".
- Cost/benefit: delete the `transition` (moot if UI-04 A lands).
- Risk: none.
- Recommendation: **cut**.

### UI-16 — Workspace name shown twice in the sidebar
- What: the header shows the folder name ("work") and the tree's first row is the same folder ("work"), expanded.
- Where: `src/features/file-tree/Sidebar.tsx:81-90`, `src/features/file-tree/FileTree.tsx` (root row); shot `edit-light.png`.
- Why: opinion, backed by PRODUCT design principle 5 "Chrome earns its pixels".
- Cost/benefit: list the root's children directly (or drop the header label); one less row and indent level.
- Risk: the root row may host the root context menu (New file at root) — keep that action reachable from the header "New file" button, which already exists.
- Recommendation: **simplify**.

### UI-17 — "Reading font" offers mono for prose
- What: the editor body font setting offers serif / sans / **mono**.
- Where: `src/features/settings/SettingsPanel.tsx:789-806`, `EditorFontFamily` in `src/stores/settings.ts`.
- Why: DESIGN §6 "no mono outside code and machine data"; PRODUCT anti-reference "Terminal aesthetic as costume — … mono everywhere".
- Cost/benefit: drop the mono option (migrate a stored `mono` to `serif`); one fewer choice.
- Risk: a user who chose mono loses it; small.
- Recommendation: **cut** the mono option (opinion on severity).

### UI-18 — Mermaid light theme is lavender, off-palette
- What: light mode uses Mermaid's `default` theme (`#ECECFF` fills, purple strokes); dark uses `dark`, which is neutral grey (`settings-light.png` vs `search-dark.png`).
- Where: `src/editor/mermaid.ts:31-33`.
- Why: DESIGN §2 Chroma-Zero / Signal Rule — "At rest the app is grey, ink, and the colours of *your content*"; a diagram's colours are the renderer's, not the author's (opinion on the reading).
- Cost/benefit: `"neutral"` instead of `"default"` — one word; light and dark match.
- Risk: none.
- Recommendation: **simplify**.

### UI-19 — First keystroke shifts the tab strip
- What: the unsaved dot is added next to the name, widening the tab by ~12px and pushing every following tab and the `+` button right on the first edit; the close button reserves its slot even while invisible.
- Where: `src/features/tabs/TabBar.tsx:172-189`.
- Why: DESIGN §1 / PRODUCT anti-reference "nothing comes between keystroke and character" (layout shift on the typing path; opinion on severity).
- Cost/benefit: show the dot in the close button's slot (dot at rest, × on hover/focus) — no width change, one element fewer.
- Risk: the close button must stay reachable by keyboard focus (it already reveals on `focus-visible`).
- Recommendation: **simplify**.

### UI-20 — Success toasts are tinted with the accent
- What: success toasts get `border-accent/40 bg-accent/10` (error: `danger/40`, `danger/10`).
- Where: `src/features/notifications/Toaster.tsx:63-65`.
- Why: DESIGN §2 Signal Rule "never a fill behind neutral content"; DESIGN §4 floating surfaces are "Surface background, hairline border".
- Cost/benefit: plain surface + border for both kinds; the icon (already accent / danger-text) carries the state.
- Risk: none (state is also in the icon and the live-region text).
- Recommendation: **simplify**.

---

## Checked and fine
Light/dark and all four sampled accent × neutral combinations resolve through the tokens; focus ring is step 11
everywhere it is drawn; no step-9 fill under text found (window close hover is red-9 under an icon, as THEMING
documents); no `uppercase`/tracking in our own chrome; no hardcoded `font-family` outside `fonts.css` and the export
template; status line follows DESIGN §5 (mono data, rules not boxes); Side Sheet is docked, shadowless and non-modal
as specified; the docked search and find panels float and carry the one shadow legitimately.

## Later
- Derive the menubar/palette label casing from one source (menubar is Title Case "Save As…", palette sentence case "Save as…").
- A visual-regression snapshot of the five key views in both modes, run from the existing e2e harness.
