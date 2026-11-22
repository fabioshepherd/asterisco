# Wave 3 — code review findings: `features` (src/features, src/components)

> **Historical record** of the 1.0 consolidation (November 2026), closed on
> 2026-11-19. It was written in the project's previous repository, now kept as a
> private archive: commit hashes, PR numbers, branch names, `file:line`
> references and scripts cited here refer to that tree and may no longer exist.
> The current state is in [`docs/ROADMAP.md`](../ROADMAP.md) and
> [`CHANGELOG.md`](../../CHANGELOG.md).

Auditor: senior React engineer, read-only. Method: scratch scripts (outside the repo, `.../scratchpad/w3-features/`) for unused exports and unused i18n keys; manual read of the motion call sites, the Wave 2 primitives and the large components. Sources read 2026-11-18: MDN browser-compat-data (raw.githubusercontent.com/mdn/browser-compat-data/main/css/...), Tauri webview-versions (https://v2.tauri.app/reference/webview-versions/). MDN, caniuse and motion.dev are not reachable from this sandbox, so BCD is the compat source. Anything unsourced is marked "opinion".

Overall: the area is in good shape after Waves 1–2. No dead component or whole dead module; dead weight is limited to 9 i18n keys, 2 needless exports and some residual hand-rolled buttons. The motion dependency is the one real decision.

### CODE-FEATURES-01 — `motion` after Wave 1: keep for 1.0 (CSS cannot replace the width/height animations on the Safari 16 target)
- What: `motion` 12.43 (`LazyMotion` + `m` + `AnimatePresence`) is used in 7 files: `app/App.tsx` (sidebar and settings dock, `width: 0 -> auto` + opacity, exit animated), `file-tree/Sidebar.tsx` (outline accordion `height: 0 -> auto`), `tabs/TabBar.tsx` (tab enter/exit `width 0 <-> auto`), `notifications/Toaster.tsx` (`layout` + enter/exit), `file-drop/DropOverlay.tsx` and `components/ui/dialog.tsx` (fade + 8px rise, with exit), plus `app/MotionProvider.tsx` and `lib/motion.ts` (+ test). `useReducedMotion` is also used just to pick `scroll-behavior` (TabBar, Settings).
- Why CSS is not a drop-in: every exit animation needs the element to stay mounted, and every `auto` size needs interpolation of intrinsic sizes. CSS has `@starting-style` (enter) and `transition-behavior: allow-discrete` (exit from `display: none`) and `interpolate-size: allow-keywords` (`auto` sizes). BCD (read 2026-11-18): `@starting-style` Chrome 117 / Firefox 129 / **Safari 17.5**; `transition-behavior` Safari 17.4; `interpolate-size` Chrome 129, Firefox no, Safari only "preview". The project targets WebKit as old as Safari 16 (`vite.config.ts:40` `build.target: safari16`), and Tauri's table lists Ubuntu 22.04 at webkit2gtk 2.36 = "Safari TP 140 (16.0)" (v2.tauri.app/reference/webview-versions, last updated May 17 2026, read 2026-11-18). So on the Linux WebKitGTK that Ubuntu 22.04 ships, `@starting-style` and `allow-discrete` do not exist (inference from the table: the version is older than 17.4/17.5; the table says itself it is incomplete and distro-dependent). Newer distros would work, older would silently lose the animation or, worse, an exit that never completes.
- Cost/benefit of dropping: removes 1 direct dep (+ `framer-motion`, `motion-dom`, `motion-utils` transitively; ~11 MB in node_modules, bundle saving not measured — opinion: tens of kB gzip), `MotionProvider.tsx`, `lib/motion.ts` + test, ~150 LOC of animation props. Costs: loses exit animations everywhere and the sidebar/accordion/tab width easing, or needs hand-written grid `0fr -> 1fr` tricks (grid-template-columns animation: Safari 16 / Chrome 107 / Firefox 66 per BCD, so that part is portable) with `visibility` timing and `onTransitionEnd` unmounting — more code than the motion props it replaces.
- Risk: dialog/palette/unsaved prompt focus handling is built on Radix `Presence` + the motion exit; changing it touches the dialog focus-return e2e.
- Options: **A (recommended)** keep as is for 1.0; revisit when the Linux floor is Safari >= 17.5 and `interpolate-size` ships in WebKit · B drop animation entirely (instant open/close; DESIGN.md §Motion says "motion conveys state and feedback only", nothing in PRODUCT requires it) and drop the dep: smallest code, but a visible regression owners did not ask for · C CSS keyframe-only enter animations (`animation:` works on Safari 16, no `@starting-style`), exits instant: drops the dep, keeps half the polish.
- Recommendation: keep (owner may pick B/C if dependency count matters more than polish). Not required.

### CODE-FEATURES-02 — Nine i18n keys with no code reference (both locales)
- What: unused in `src/**` (scratch script `i18n.py`: literal keys and `t(\`prefix.${x}\`)` templates resolved by hand): `common`: `app.tagline`, `phase.status`, `phase.resolvedTheme` (Phase 0 scaffold leftovers; the whole `phase` object), `theme.label`, `theme.toggle`, `language.label` (the theme/language rows use `settings.themePreference` / `settings.language`); `editor`: `document.unsaved`, `modes.distractionFree` (distraction-free is labelled via `shortcuts.actions.distractionFree`); `menu`: `window.controls.restore` (`WindowControls.tsx` has no `restore` reference; `app.about` is deliberately unrendered per the `AppMenubar.tsx:109` comment, keep or cut with it). `theme.light/dark/system` and `language.en/it` are used dynamically and must stay.
- Why: dead strings are translated twice for nothing and are the last trace of Phase 0.
- Cost/benefit: ~12 JSON lines x 2 locales; zero risk if `resources.test.ts` parity holds (it will, delete in pairs).
- Recommendation: cut.

### CODE-FEATURES-03 — Two command registries: menu `COMMANDS` and the palette's own list
- What: `app/menu/commands.ts` (40 commands: id, `labelKey` in `menu.json`, `run`) and `command-palette/CommandPalette.tsx:152-~400` (36 entries with different ids, e.g. `new` vs `new-file`, labels from `editor:commands.*`, `run` re-bound by hand: new/open/openFolder/closeFolder/save/saveAs/print/find/replace/...). The same action therefore has two ids, two label keys (two translations) and two `run` bindings that can drift.
- Why: one source of truth (opinion; the codebase already applies it to the settings entries and to keybindings).
- Cost/benefit: palette consumes `COMMANDS` for the shared ones and keeps only palette-only entries inline; estimate −80–120 LOC and one label namespace (`editor:commands.*`, ~25 keys x 2 locales), and `CommandPalette.tsx` falls to ~400 lines.
- Risk: medium: recents are in-memory only (`recent-commands.ts:15`), so id renames are safe; palette labels may deliberately differ from menu labels ("Open file" vs "Open…"), which is a copy decision.
- Options: **A (recommended, but post-1.0 if time is short)** unify as above · B leave, add a test asserting every palette command that mirrors a menu command resolves to the same `run`.
- Recommendation: simplify (optional for 1.0; flag, do not rush).

### CODE-FEATURES-04 — Residual hand-rolled buttons next to the Wave 2 `Button`
- What: UI-10 replaced the icon buttons, but 9 `<button>` with bespoke class strings remain, each repeating `transition-colors duration-(--motion-duration-fast) ease-snappy hover:bg-muted hover:text-fg`: `Sidebar.tsx:165` (clear filter, icon), `SettingsPanel.tsx` search-clear (icon) and section jump links (`:1167`), `Toaster.tsx:78` (action, bordered) and `:156` (clear all), `StatusBar.tsx:113` (auto-save toggle), `Sidebar.tsx:220` (outline disclosure). Rows that are list items (`Outline.tsx:112`, `EmptyState.tsx:58`) and `WindowControls.tsx` (3, custom hit targets) are legitimately bespoke.
- Why: one press scale and one focus ring from a single primitive (UI-10 rationale); the same string 7 times is the thing the primitive exists to remove.
- Cost/benefit: ~−25 LOC; the two icon buttons become `Button variant="ghost" size="icon-sm"`, Toaster ones `outline`/`ghost` `sm`.
- Risk: low; `Button`'s 24x24 minimum and focus ring must still fit inside the 32 px search field and the toast; check visually.
- Recommendation: simplify (small).

### CODE-FEATURES-05 — `SettingsPanel.tsx` (1,214 lines): split the file, not the component
- What: lines 57–503 are 9 private helpers (`Field`, `FieldRow`, `SectionHeading`, `GroupLabel`, `SegButtons`, `NumberField`, `KeybindingRow`, `FixedShortcutRow`, `highlightLabel`); the `SettingsPanel` function (504–1214) is ~700 lines, of which ~450 are the declarative `entries` array — deliberately the single source for the per-section and the search view (comment at :624).
- Why: a 1.2k-line file is hard to review, but the entries array is flat data and splitting it by section would mean passing `settings`, `t`, `tc`, `kw`, `group` into each part and breaking the one-list invariant, for no complexity saved.
- Cost/benefit: move the helpers (~450 lines) into `settings-fields.tsx` and the two shortcut rows (~230, they carry the conflict/capture logic) into `ShortcutRows.tsx`: `SettingsPanel.tsx` ~550 lines, no behaviour change, no LOC saved. Review-only benefit.
- Risk: low (pure move; `SettingsPanel.test.tsx` covers it).
- Recommendation: simplify, optional; do not split `entries`.

### CODE-FEATURES-06 — Duplicated roving-list keyboard handler
- What: `Outline.tsx:85-95` and `EmptyState.tsx:36-46` are the same 10 lines (ArrowUp/Down/Home/End, `focusIndex`, `refs`, `tabbable = min(focusIndex, n-1)`).
- Cost/benefit: one `useRovingFocus(count)` hook (~25 lines) saves ~15 net and a place to fix the next a11y bug once. `FileTree` has its own tree navigation (different keys, typeahead) and should not be folded in.
- Recommendation: simplify (small, optional).

### CODE-FEATURES-07 — Needless exports
- What: `find-replace/find-utils.ts:12` `buildSearchRegExp` and `file-tree/tree-utils.ts:124` `FILTER_ROW_LIMIT` are exported but used only in their own file. Another ~20 exported types have no importer (`ButtonProps`, `ContextMenu*Props`, `KeyAction*`, `FixedShortcut*`, `TabLabel`, `DropRoute`, ...): conventional for component props, harmless. Exports used only by tests (`handleExternalChange/Delete`, `sanitizeThemeCss`, `slugify`, `confirmCloseAllDirty`, `RESERVED_COMBOS`, ...) are fine: they are the tested seams.
- Cost/benefit: 2 words; no knip/ts-prune dependency is warranted for this.
- Recommendation: simplify (drop the two `export`s); leave the rest.

### CODE-FEATURES-08 — Large components that are fine as they are
- `FileTree.tsx` (669): already split into `TreeNode` (~320) and `FileTree` (~270) with `TreeNavContext`, plus `tree-utils`, `file-actions`, `use-tree-menu`, `TreeStateRow`; the remainder is ARIA tree keyboard handling that has to live together. `TabBar.tsx` (429): `TabStripEnd` + one tab item + `TabBar` with DnD split into `tab-dnd`/`TabDndContext`/`TabRenameInput`/`useTabRename`. A further split would add props plumbing, not remove complexity.
- Recommendation: keep.

### CODE-FEATURES-09 — Raw `<input>` in five places, and the native `ask()` dialog in Settings
- What: `FindReplace.tsx:99,181`, `WorkspaceSearch.tsx:208`, `Sidebar.tsx:134`, `TabRenameInput.tsx:36` use bare `<input>` instead of `ui/Input`: they are borderless fields inside a bordered composite (find bar, search header) or an inline rename, where the primitive's border/ring would be wrong — legitimate. Separately, `SettingsPanel.tsx:569,585` confirm resets with the Tauri native `ask()` while every other confirmation uses the shared `Dialog`.
- Recommendation: keep the inputs. The `ask()` mismatch is a consistency nit (native OS dialog is unthemed, not localizable beyond the strings passed); candidate for the shared `Dialog` — see Later.

## Later (not 1.0)
- Move the two Settings reset confirmations to the shared `Dialog` (CODE-FEATURES-09).
- Re-evaluate CSS-only motion (`@starting-style`, `interpolate-size`) once the Linux floor is WebKitGTK >= 2.46 (Safari 17.5-equivalent) — CODE-FEATURES-01.
- Palette/menu command unification if not done now — CODE-FEATURES-03.
