# Wave 2 — accessibility findings

> **Historical record** of the 1.0 consolidation (November 2026), closed on
> 2026-11-19. It was written in the project's previous repository, now kept as a
> private archive: commit hashes, PR numbers, branch names, `file:line`
> references and scripts cited here refer to that tree and may no longer exist.
> The current state is in [`docs/ROADMAP.md`](../ROADMAP.md) and
> [`CHANGELOG.md`](../../CHANGELOG.md).

Reviewer: accessibility (WCAG 2.2 AA, WAI-ARIA APG). Tree reviewed: this branch after Wave 1 (`521296d`), production bundle (`vite preview`) in Chromium with the e2e IPC mock, platform = linux (custom title bar + menubar), deviceScaleFactor 1. No axe-core (owner decision): evidence is a scripted keyboard walkthrough, Playwright `ariaSnapshot()` trees, computed styles, and contrast computed from the Radix scales with the same formula as `src/styles/contrast.test.ts`. Scripts, snapshots and screenshots: `.superpowers/sdd/2026-11-17-consolidation/w2-a11y/` (gitignored; `walk*.ts`, `aria-*.yml`, `*.png`).

All W3C references read 2026-11-18. Every finding is in a surface Wave 1 kept (editor, reading view, tabs, file tree, palette, workspace search, find, settings, menubar, status bar, notifications), so **every finding below is a required fix**, not a keep/cut question. Severity order: blocker → serious → moderate → minor.

Counts: **1 blocker · 6 serious · 6 moderate · 5 minor** (18).

## What already holds (verified, not findings)

Tree is a `role="tree"` with roving tabindex, arrows, Home/End, type-ahead, Shift+F10 context menu with focus return; context menus rove, close on Tab/Escape and return focus; unsaved-changes dialog traps focus, lands on Save and returns focus to the tab on Escape; find bar returns focus to the editor on Escape; workspace search is a combobox/listbox with `aria-activedescendant` and a polite result count; view switch is a roving radiogroup; F10/Alt reach the menubar; save/error toasts are announced through persistent live regions and action/error toasts never auto-dismiss; `prefers-color-scheme` drives the System theme (dark verified); `prefers-reduced-motion` collapses the sidebar/settings width animations to instant (measured) and CSS animations via the global reset; the focus ring (step 11) clears 3:1 against page, surface and muted steps for every accent × neutral × mode (computed, extends the test's page-only check); `<html lang>` follows the locale.

## Findings

### A11Y-01 · blocker · Tab inside the WYSIWYG editor edits the document and never leaves it
- SC 2.1.1 Keyboard, 2.1.2 No Keyboard Trap — https://www.w3.org/WAI/WCAG22/Understanding/no-keyboard-trap.html (read 2026-11-18).
- What: Crepe always installs `@milkdown/plugin-indent` (Tab → insert 2 spaces at any caret). A keyboard user tabbing from the tab strip into the editor and pressing Tab again inserts spaces; `notes.md` was saved as `# &#x20;       Notes` (`walk5.ts`). Forward Tab never reaches the status bar, an open Settings sheet or toasts; only Shift+Tab leaves.
- Where: `node_modules/@milkdown/crepe/lib/esm/builder.js:136` (`.use(indent)`), wired from `src/editor/CrepeEditor.tsx:92` (HEAD).
- Impact: keyboard and screen-reader users silently corrupt the file (violates PRODUCT "survive a `git diff`") and cannot reach chrome after the editor.
- Fix: remove `indentPlugin` from `crepe.editor` before create, so Tab moves focus outside lists (Crepe's list keymap keeps sink/lift) and code blocks (CodeMirror). Source mode already escapes with Esc → Tab (CodeMirror tab-focus, verified): list it under Settings ▸ Shortcuts ▸ Built in so users are "advised" (2.1.2).
- Risk: low; add a test that Tab in a list item still nests and Tab in a paragraph moves focus without a doc change.

### A11Y-02 · serious · Block images expose the caption as alt; untitled images become decorative; alt is not editable
- SC 1.1.1 Non-text Content — https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html (read 2026-11-18). Wave 1 hand-off.
- What: `![Architecture](a.png "The system")` renders `<img alt="The system">`; `![Overview](b.png)` renders `alt=""` (decorative), in Edit and Reading views (`aria-images.yml`). The WYSIWYG offers a caption field only.
- Where: node view `node_modules/@milkdown/components/lib/image-block/index.js:461` (`alt: caption.value`); `src/editor/image-block-alt.ts` keeps `alt` in the model but nothing renders or edits it.
- Impact: reading a `.md` is half the product; screen-reader users hear the wrong text or nothing.
- Fix: set the rendered `<img>` `alt` from `attrs.alt` (small node-view patch after mount, as W1 did for labels) and add an "Alt text" field beside the caption (i18n it/en).
- Risk: Crepe node-view internals; keep the `images.md` round-trip e2e green.

### A11Y-03 · serious · Focus is dropped to `<body>` after closing the palette, Settings and the name dialog
- SC 2.4.3 Focus Order — https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html; APG Dialog (Modal) — https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ (both read 2026-11-18).
- What: measured `document.activeElement === body` after: palette Escape (opened from editor or tab) and after running a palette command; Settings Escape and its Close button; New file / Rename dialog Escape (`walk4/6/12.ts`).
- Where: `src/features/command-palette/CommandPalette.tsx:389`, `src/features/settings/SettingsPanel.tsx:1096` (closing unmounts the sheet from `App.tsx`), `src/features/file-tree/NameDialog.tsx:41`.
- Impact: keyboard/AT users lose their place after every palette use; the next keystroke goes nowhere.
- Fix: capture `document.activeElement` on open, restore it in `onCloseAutoFocus` (preventDefault) or on close; fall back to the active editor. The unsaved prompt and context menus already do this.
- Risk: low; must not steal focus when a palette command itself moves focus (e.g. focus file tree).

### A11Y-04 · serious · Menu, palette and search-result focus is a 1.1:1 grey tint
- SC 2.4.7 Focus Visible, 1.4.11 Non-text Contrast — https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html (read 2026-11-18).
- What: the only indicator of the focused menu item / active option is `--muted` (step 3) on step 1/2: 1.08–1.19:1 in every neutral and mode (`menu-light.png`, `palette.png`).
- Where: `src/components/ui/menubar.tsx:65,82` (`outline-none focus:bg-muted`); `src/features/command-palette/command-palette.css:103`; `src/features/search/WorkspaceSearch.tsx:283-284`.
- Impact: low-vision keyboard users cannot see which command Enter will run.
- Fix: keep the tint and add an inset 2px `--ring` outline (or a 2px step-11 leading bar) on `:focus`/`[data-highlighted]`, `[data-selected=true]`, `[aria-selected=true]`.
- Risk: none; visual-only, DESIGN Ring Rule compliant.

### A11Y-05 · serious · The editor's only focus indicator, the caret, is 1.4:1
- SC 2.4.7 Focus Visible, 1.4.11 Non-text Contrast — https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html (read 2026-11-18).
- What: the ProseMirror outline is suppressed in favour of the caret, but Crepe paints its virtual caret in `--crepe-color-outline` = `--border` (step 6): 1.37–1.39:1 light, 1.65:1 dark (`caret-light.png`).
- Where: `src/styles/editor-theme.css:22` (`--crepe-color-outline: var(--border)`) and `:149-151` (outline removed); upstream `@milkdown/crepe/lib/theme/common/cursor.css`.
- Impact: users cannot find the insertion point; the code comment's "conveyed by its caret" premise fails.
- Fix: `.milkdown .ProseMirror-focused { --prosemirror-virtual-cursor-color: var(--fg); }` (Source mode already uses `--fg`).
- Risk: none.

### A11Y-06 · serious · Editors have no accessible name; Reading view is an unfocusable "textbox"
- SC 4.1.2 Name, Role, Value — https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html; APG Tabs (tabpanel `tabindex="0"`) — https://www.w3.org/WAI/ARIA/apg/patterns/tabs/ (read 2026-11-18).
- What: ProseMirror and CodeMirror expose an unnamed `textbox`. In Reading view the ProseMirror is `contenteditable="false"` but keeps `role="textbox"`, has no `aria-readonly`, and neither it nor the tabpanel is focusable, so WebKit webviews (no focusable scrollers) cannot scroll it from the keyboard.
- Where: `src/editor/CrepeEditor.tsx` (editor attributes), `src/editor/SourceEditor.tsx:76` (`EditorView.contentAttributes`), `src/editor/DocumentEditor.tsx:70`.
- Fix: `aria-label` "{name}" via i18n on both editors; `aria-readonly="true"` in Reading; `tabIndex={0}` on the tabpanel in Reading view.
- Risk: low.

### A11Y-07 · serious · Crepe's icon buttons are unnamed
- SC 4.1.2 Name, Role, Value — https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html (read 2026-11-18).
- What: block-handle "+" and drag buttons (hover, 16×28/28×16), table align/delete button group, one selection-toolbar button and the link tooltip input have no name; decorative `.milkdown-icon` SVGs surface as unnamed `img` (`walk9.ts`, `aria-start.yml`).
- Where: Crepe `block-edit`, `table`, `toolbar`, `link-tooltip` features, configured at `src/editor/CrepeEditor.tsx:92-174` (HEAD).
- Fix: label them through feature configs where offered, else the same post-mount patch W1 used for image-block labels (i18n it/en); `aria-hidden` on `.milkdown-icon svg`.
- Risk: upstream DOM can change on Crepe bumps; pin with a unit test on the selectors.

### A11Y-08 · moderate · Focusing a folder rings every row below it
- SC 2.4.7 Focus Visible — https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html (read 2026-11-18).
- What: rows use `group-focus-visible/item:outline-2`, and every nested `<li>` is also `group/item`, so a focused folder outlines all descendant rows (`tab-contact.png`, third strip).
- Where: `src/features/file-tree/FileTree.tsx:196-203` (and `FilteredFiles.tsx:71-72`).
- Fix: ring only the direct row: on the `<li>`, `[&:focus-visible>div]:outline-2 [&:focus-visible>div]:-outline-offset-2 …` instead of the group variant.
- Risk: none.

### A11Y-09 · moderate · Tab strip structure: nested close buttons, extra tab stops, a button inside `tablist`
- APG Tabs — https://www.w3.org/WAI/ARIA/apg/patterns/tabs/; WAI-ARIA 1.2 `tab` (Children Presentational) — https://www.w3.org/TR/wai-aria-1.2/#tab (read 2026-11-18).
- What: each close button sits inside `role="tab"` (hidden from AT, nested interactive) yet is its own Tab stop, so N tabs add N stops after the roving tab; "New tab" is a child of `role="tablist"`, which may own only tabs.
- Where: `src/features/tabs/TabBar.tsx:178-189`, `:379-388`.
- Fix: `tabIndex={-1}` on close buttons (Delete/Backspace and the context menu already close; add `aria-keyshortcuts="Delete"` on the tab); render "New tab" after the `tablist` element.
- Risk: low.

### A11Y-10 · moderate · Tab close target is 18×18 inside the tab target
- SC 2.5.8 Target Size (Minimum) — https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html (read 2026-11-18).
- What: the 24px circle over the 18px button intersects the enclosing tab target, which the Understanding text classes as a fail.
- Where: `src/features/tabs/TabBar.tsx:186` (`p-0.5` + `size-3.5`).
- Fix: 24×24 hit area (`size-6`, icon stays 14px).
- Risk: tab width grows 6px.

### A11Y-11 · moderate · Step-9 signals fall under 3:1 in light mode, and the test does not pin them
- SC 1.4.11 Non-text Contrast — https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html (read 2026-11-18).
- What: the unsaved dot and the selected-tab underline use `--accent` (step 9) on `--surface` (step 2): orange (default) 2.82, grass 2.88, teal 2.92, jade 2.99 (`contrast.ts`). On inactive tabs the dot is the only visual "unsaved" cue.
- Where: `src/features/tabs/TabBar.tsx:137,176`, `src/features/status-bar/StatusBar.tsx:95`; gap in `src/styles/contrast.test.ts`.
- Fix: add a test "step 9 ≥ 3:1 vs steps 1–2" and, where it fails, draw these indicators in `--primary` (step 11).
- Risk: slightly stronger orange on screen; DESIGN Signal Rule still holds.

### A11Y-12 · moderate · No reflow at the minimum window × 200% zoom
- SC 1.4.10 Reflow, 1.4.4 Resize Text — https://www.w3.org/WAI/WCAG22/Understanding/reflow.html (read 2026-11-18).
- What: min window 640 px at 200% = 320 CSS px: the sidebar keeps 240 px, the document gets 80 px and the status-bar path overlaps "Saved" (`reflow320.png`). At 640 CSS px with Settings open, sidebar + sheet take 624 px (`zoom200-settings.png`).
- Where: `src/app/App.tsx` (sidebar/sheet columns), `src/features/status-bar/StatusBar.tsx:79`.
- Fix: collapse the sidebar (or overlay it) when `main` is under ~400 px; let the status-bar path shrink/truncate first.
- Risk: layout logic; keep the sidebar preference untouched.

### A11Y-13 · moderate · Shortcut rows: names miss the visible text, and 13 identical "Reset to default"
- SC 2.5.3 Label in Name — https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html; 2.4.6 Headings and Labels (read 2026-11-18).
- What: the record button shows "Ctrl+Shift+P" but is named "Record a shortcut for Command palette"; every reset button is "Reset to default" (`aria-settings.yml`).
- Where: `src/features/settings/SettingsPanel.tsx:418,445`.
- Fix: name "{action}: {combo}" with the recording hint in `aria-describedby`; reset `aria-label` "Reset {action} shortcut" (i18n).
- Risk: none.

### A11Y-14 · minor · Workspace search field has no focus ring
- SC 2.4.7 Focus Visible (read 2026-11-18).
- What: the combobox is `outline-none` and its row has no `focus-within` ring; only the caret shows focus (the sidebar filter field draws one).
- Where: `src/features/search/WorkspaceSearch.tsx:217`.
- Fix: the filter field's `focus-within:outline-2 … outline-[var(--ring)]` on the input row.
- Risk: none.

### A11Y-15 · minor · Toggle labels flip with their state
- APG Button ("the label on a toggle does not change when its state changes") — https://www.w3.org/WAI/ARIA/apg/patterns/button/ (read 2026-11-18).
- What: "Auto-save: on/off" + `aria-pressed` reads "Auto-save: off, not pressed"; "Show/Hide outline" + `aria-expanded` likewise.
- Where: `src/features/status-bar/StatusBar.tsx:107-108`, `src/features/file-tree/Sidebar.tsx:215-217`.
- Fix: static names "Auto-save" / "Outline"; keep the visible text.
- Risk: none.

### A11Y-16 · minor · Escape from the menubar lands in the wrong place
- SC 2.4.3 Focus Order; APG Menubar — https://www.w3.org/WAI/ARIA/apg/patterns/menubar/ (read 2026-11-18).
- What: Escape always focuses the first `[contenteditable=true]`: from the tree it lands in the editor; in Source view that element is the hidden Crepe, so focus stays on the menubar (`walk14.ts`).
- Where: `src/app/chrome/AppMenubar.tsx:224-228`.
- Fix: remember the element focused before F10/Alt and restore it; fall back to the visible editor.
- Risk: none.

### A11Y-17 · minor · Sticky toasts have no keyboard route
- SC 2.1.1 Keyboard — https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html (read 2026-11-18).
- What: error and Retry/Undo toasts wait for the user, but sit last in the DOM with no landmark or shortcut; with A11Y-01 they are unreachable by forward Tab.
- Where: `src/features/notifications/Toaster.tsx:140`.
- Fix: wrap the stack in `role="region"` + `aria-label` "Notifications" (i18n) and add a palette command / F6 stop that focuses the newest toast.
- Risk: none.

### A11Y-18 · minor · Unsaved-changes confirmation is a plain dialog; status caret label is ignored
- APG Alert Dialog — https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/; SC 4.1.2 (read 2026-11-18).
- What: the interrupting save/discard prompt is `role="dialog"`; the Source-mode "Ln/Col" readout puts `aria-label` on a generic `<span>`, which ARIA 1.2 prohibits and AT ignores.
- Where: `src/features/file-ops/UnsavedPromptDialog.tsx:33`; `src/features/status-bar/StatusBar.tsx:127`.
- Fix: `role="alertdialog"` on the Content; replace the span label with visible text + an `sr-only` expansion.
- Risk: none.

## Proposed `e2e/a11y.spec.ts` (dependency-free; for the executor)

Built on `e2e/support/fixtures.ts`; uses only `getByRole`, `toBeFocused`, `evaluate(':focus-visible')` and computed styles. One helper `expectFocusVisible(locator)`: element is focused, matches `:focus-visible`, and has `outline-style != none` with width ≥ 2px **or** a non-transparent `box-shadow` ring.

1. **Landmarks and names** — `menubar`, `complementary "File tree"`, `tree "File tree"`, `tablist "Open documents"`, `tabpanel` named after the tab, `contentinfo`, `radiogroup "Document view"`; editor `textbox` has a name (A11Y-06); no `button` with an empty name inside the tabpanel (A11Y-07).
2. **Tab walk** — from load, Tab through menubar → window controls → sidebar → tree (one stop) → tab (one stop) → New tab → editor; each stop passes `expectFocusVisible`; no close button in the sequence (A11Y-09).
3. **Tab does not edit** — Tab into the editor, press Tab, assert the tab name has no "unsaved changes" and focus left the editor (A11Y-01); in a list item Tab still nests.
4. **Tree** — Ctrl+Shift+E focuses a `treeitem`; ArrowDown/Up/Home/End move focus; Enter opens; only the focused row is outlined (A11Y-08); Shift+F10 opens `menu "File actions"`, Escape returns focus to the row.
5. **Tabs** — ArrowLeft/Right rove, Enter selects, Delete on a dirty tab opens the unsaved dialog with Save focused, Escape returns focus to the tab.
6. **Palette** — Ctrl+Shift+P → `dialog "Command palette"` with the combobox focused; ArrowDown changes `aria-activedescendant`; Escape → focus back on the editor (A11Y-03); same after running "Toggle reading mode".
7. **Workspace search** — Ctrl+Shift+F focuses `combobox "Search in workspace"`; typing yields `option`s; Escape returns focus to the editor.
8. **Find** — Ctrl+F focuses `textbox "Find"`; Tab cycles inside `search`; Escape returns focus to the editor.
9. **Settings** — Ctrl+, focuses `textbox "Search settings"` inside `dialog "Settings"`; Escape closes and focus returns to the editor (A11Y-03).
10. **Name dialog** — New file in the tree → `dialog "New file"` with `textbox "Name"` focused; Escape returns focus to the New file button (A11Y-03).
11. **Menubar** — F10 focuses the first `menuitem`; Enter opens a `menu`; ArrowRight moves menus; Escape twice returns focus to where it was (A11Y-16).
12. **Images** — open `images.md`: `img` names are "Architecture", "Overview", "diagram" (A11Y-02).
13. **Media features** — `emulateMedia({ reducedMotion: 'reduce' })`: Ctrl+Shift+L hides the sidebar with width 0 on the next frame; `colorScheme: 'dark'` → `<html class="dark">`.
14. **Reflow** — viewport 320×256: `document.documentElement.scrollWidth === 320` and the editor column ≥ 280 px (A11Y-12).
