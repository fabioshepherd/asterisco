# Wave 3 — Shell and state findings (`src/app`, `src/stores`, `src/lib`)

> **Historical record** of the 1.0 consolidation (November 2026), closed on
> 2026-11-19. It was written in the project's previous repository, now kept as a
> private archive: commit hashes, PR numbers, branch names, `file:line`
> references and scripts cited here refer to that tree and may no longer exist.
> The current state is in [`docs/ROADMAP.md`](../ROADMAP.md) and
> [`CHANGELOG.md`](../../CHANGELOG.md).

Auditor: React 19 + Zustand architect. Tree: `consolidation/wave-3` (React 19.3.1,
zustand 5.1.0, @tauri-apps/plugin-store 2.5.1, as installed). Read-only; nothing
was built or run. "Found by reading" marks a defect inferred from code, not
reproduced.

Sources read 2026-11-18:
- Tauri Store plugin — https://v2.tauri.app/plugin/store/ (`autoSave` "will save
  the changes to disk after a debounce delay, 100ms by default"; `entries`
  command). Installed JS (`node_modules/@tauri-apps/plugin-store/dist-js/index.js`)
  confirms every `get`/`set`/`delete`/`save` is one `invoke`; `store:default`
  grants `allow-entries` (crate `permissions/default.toml`).
- Zustand vanilla store (`node_modules/zustand/esm/vanilla.mjs`, 5.1.0):
  `setState` with an object partial always notifies every listener, and
  listeners receive `(state, previousState)`.

---

### CODE-SHELL-01 — Persistence subscribers write on every unrelated change and race the startup load — **required**
- What / Where: `src/app/use-startup.ts:183-220` subscribes to whole stores. The `useUi` listener calls `saveUiPrefs` (2 `set` + `store.save()` = a `settings.json` rewrite) on *any* UI change: view mode, distraction-free, sidebar toggle, `resolvedTheme`, and every `pointermove` of the sidebar drag (`src/features/file-tree/SidebarResizer.tsx:58-65`). `useThemeSync` calls `setResolvedTheme` at mount (`src/app/use-theme-sync.ts:28`), so `saveUiPrefs({outlineVisible:true, sidebarWidth:240})` is issued *while* `loadUiPrefs` is still reading the same keys (`src/lib/tauri/settings-store.ts:316-329`): two awaited round trips interleaved, so the second `get` can read the default just written. Found by reading.
- Why: zustand notifies on every `set` (source above); the load and save share one store without ordering.
- Cost/benefit: ~15 LOC changed. Removes a disk write per drag frame and per view toggle; removes an intermittent loss of persisted sidebar width/outline state.
- Risk: low; persisted keys unchanged.
- Options: (A, recommended) register the four subscriptions *after* hydration and compare the persisted slice with `prevState` before saving; open the store with the plugin's `autoSave` debounce instead of `autoSave:false` + explicit `save()` per call. (B) A only, keep explicit saves.
- Recommendation: fix

### CODE-SHELL-02 — [V1] File/app accelerators off macOS: one webview dispatcher derived from `MENU_MODEL` — **required**
- What / Where: `src/app/use-save-shortcut.ts:133` hand-lists `{s, p}`; `src/app/chrome/AppMenubar.tsx:61` hand-lists the same two in `DISPATCHED_ACCELERATORS`; ROADMAP "[V1] File and app accelerators do not fire on Windows/Linux" and "[V1] reserved-combos".
- Why: the mapping already exists — every command node in `MENU_MODEL` carries its accelerator and `acceleratorToCombo` (`src/features/settings/reserved-combos.ts:53`) normalizes it. Generalize `use-save-shortcut` to "every `MENU_MODEL` command accelerator → `COMMANDS[id].run()`" (macOS: native menu consumes them first, as the file already documents) and drop `DISPATCHED_ACCELERATORS` (all accelerators become true). Both [V1] items close; `reserved-combos` becomes correct as is.
- Cost/benefit: about −10 net LOC; no new registry. ROADMAP's "wire them through the keymap" would also make them remappable, but that means a second list. Opinion: simpler not to.
- Risk: Ctrl+W/Ctrl+Q now fire in the webview on Win/Linux (intended). Make it the one window `keydown` dispatcher that respects `event.defaultPrevented` (there are six such listeners today: global shortcuts, save, tabs, menubar access, distraction-free Escape, floating sidebar).
- Recommendation: fix

### CODE-SHELL-03 — `mod+1…6` has two owners: Heading 1–6 and "select tab by position" — **required**
- What / Where: `src/editor/formatting-keymap.ts:17` (`Mod-1…6` headings, also native accelerators on macOS via `src/lib/tauri/menu-spec.ts:52-54`) vs `src/features/settings/fixed-shortcuts.ts:30-34` + `src/features/tabs/use-tab-shortcuts.ts:75-79` (`mod+1…9`). Off macOS, with the caret in the editor, ProseMirror applies the heading and calls `preventDefault` without stopping propagation; the window handler does not check `defaultPrevented`, so it also switches tab. On macOS the native Format menu takes Cmd+1…6 first, so tab-by-position works only for 7–9. `reserved-combos` misses this because format hints are not in the menu model. Found by reading. Verify with one e2e keypress.
- Why: one combo, one owner (the premise of `reserved-combos.ts`).
- Options: (A, recommended, opinion) keep headings on `Mod-1…6` (writing-editor convention), cut `selectByPosition` (≈−15 LOC, −1 fixed shortcut, −2 i18n keys); Ctrl+Tab MRU stays. (B) Move headings to `Mod-Alt-1…6` (editor keymap + menu hints change). (C) Tab handler skips `defaultPrevented` (context-dependent meaning; macOS still broken).
- Risk: muscle memory for whichever loses; no persisted data.
- Recommendation: fix

### CODE-SHELL-04 — Command palette keeps a third command list. Derive it from `COMMANDS` (fixes the wrong `mod+shift+e` hint) — **required** (hint)
- What / Where: `src/features/command-palette/CommandPalette.tsx:147-358` redefines ~40 commands, with their own `run` functions and their own ids, beside `COMMANDS` (`src/app/menu/commands.ts:61-235`). `shortcuts.ts:14-22` `NATIVE_COMBOS` hand-copies menu accelerators and lists `exportHtml: "mod+shift+e"`, which `menu-model.ts:313-318` removed on purpose (that combo is the `focusFileTree` default). So the palette advertises Export HTML on a key that focuses the tree. `toggleTheme` logic is duplicated (`commands.ts:47-50`, `CommandPalette.tsx:350-356`). Labels use a separate `editor:commands.*` set (29 keys × 2 locales) beside the `menu` labels.
- Why: single source of truth, as `commands.ts:57-60` already promises ("(later) the command palette").
- Cost/benefit: about −200 LOC in the palette, −`NATIVE_COMBOS`, up to −29×2 i18n keys. Add palette-only actions (rename folder, focus tree/notifications, reveal, move tab, toggle auto-save) to `COMMANDS` with a `group`; derive the native hint via `acceleratorToCombo(node.accelerator)` from `MENU_MODEL`.
- Risk: palette recency ids change. They are in-memory only (`recent-commands.ts`), so no migration. Palette label wording may shift toward the menu's.
- Recommendation: simplify (the hint fix is required even if the merge is declined: delete `exportHtml` from `NATIVE_COMBOS`)

### CODE-SHELL-05 — Keymap actions duplicate command bodies. One shortcut-hint function for three surfaces
- What / Where: `src/features/settings/keybindings.ts:97-194` gives each `KEY_ACTIONS` entry its own `run`, re-implementing `COMMANDS` entries; they already drift (`searchWorkspace` toggles at `:117`, the menu and palette `open()` it). The hint "format combo, else accelerator, else keymap" is computed three times: `menu-spec.ts:52-54`, `AppMenubar.tsx:150-159`, palette `formatHints` (`CommandPalette.tsx:362-373`, which also hardcodes `"Mod-b"/"Mod-i"/"Mod-e"` already in `FORMAT_COMMAND_HINTS`).
- Why: the same as 04. Persisted keybinding ids (`"sidebar"`, `"outline"`, …) must stay stable, so give each `KEY_ACTION` a `command: CommandId` instead of a `run`.
- Cost/benefit: about −60 LOC; one `commandShortcut(id, platform, bindings)` helper.
- Risk: keep `KEY_ACTIONS` ids unchanged (persisted in `keybindings`).
- Recommendation: simplify (do with 04)

### CODE-SHELL-06 — Settings fields are spelled out seven times, read with 17 sequential IPC calls, and sanitized unevenly
- What / Where: the field list is repeated in `PersistableSettings` (`settings.ts:98-115`), `SettingsState`, `PersistedSettings` (`settings-store.ts:34-52`), `pickKnownSettings` (`:63-98`), the `loadPersistedSettings` reads (`:138-155`, 17 awaited `store.get` = 17 round trips in series on the startup path), `savePersistedSettings` (`:163-205`: 16 `set` + 6 retired-key `delete` + `save` = 24 IPC per settings change), and the subscriber in `use-startup.ts:184-200`. `hydrate` sanitizes numbers, accent, neutral and view mode, but not `themePreference`, `language`, `editorFontFamily` or `customThemeName`. A corrupt `editorFontFamily` becomes `var(--font-<junk>)` (`App.tsx:345`).
- Why: one key table removes the drift class. `store.entries()` reads everything in one call (sources above).
- Cost/benefit: about −120 LOC. Startup settings read goes from 17 to 1 IPC; save goes from 24 to about 17, with a `RETIRED_KEYS` array deleted once when `fromVersion < 4`.
- Risk: medium: persisted keys must stay byte-identical. Keep `migrateSettings` steps (v0.1–v0.5.1 tags exist, so stores exist in the wild). Cover with `settings-store.test.ts`.
- Recommendation: simplify

### CODE-SHELL-07 — Stale schema and registry comments (v4 clarity)
- What / Where: `settings-store.ts:21` says v2 is "current shape" and `:29` says v4 is too; the `migrateSettings` doc (`:100-109`) still describes only v0→v1. `settings.ts:119` says "over the fixed Sand base" (the neutral is selectable, default Gray per CLAUDE.md). `settings.ts:132` says "default 90" (it is 66). `commands.ts:58-59` says "(later) the command palette".
- Why: the schema comment is the migration contract; two "current" versions invite a wrong bump.
- Cost/benefit: ~10 comment lines. Risk: none.
- Recommendation: fix

### CODE-SHELL-08 — `resolvedTheme` in the UI store is a derived value
- What / Where: `src/stores/ui.ts:22,49,55`. Its only readers are the two `toggleTheme` copies (`commands.ts:48`, `CommandPalette.tsx:354`). `useThemeSync` writes it from an effect.
- Why: React docs, "You Might Not Need an Effect" (https://react.dev/learn/you-might-not-need-an-effect, read 2026-11-18): don't mirror values that can be computed. `resolveTheme(pref, matchMedia(...).matches)` at click time, or `document.documentElement.dataset.theme`, gives the same answer.
- Cost/benefit: about −8 LOC. Removes the mount-time `useUi` write that triggers 01's race.
- Risk: none (not persisted).
- Recommendation: cut

### CODE-SHELL-09 — First paint shows the English UI and `lang="en"` to Italian users
- What / Where: `src/i18n/index.ts:23` (`lng: "en"`), switched only after async settings + `getOsLanguage()` (`use-startup.ts:121,145`). On macOS the native menu is built in English, then rebuilt (`use-native-menu.ts:30-32`). Theme, accent and neutral already avoid this with a localStorage mirror read before React (`public/theme-init.js`).
- Why: WCAG 2.2 SC 3.1.1 (https://www.w3.org/TR/WCAG22/#language-of-page, read 2026-11-18). This is momentary; the flash is opinion.
- Cost/benefit: ~10 LOC: mirror `language` like `THEME_PREF_KEY` and pass it as `lng` at init. Alternative: await one `entries()` read (06) before `createRoot`.
- Risk: low; the mirror is a cache, and the store stays the truth.
- Recommendation: fix

### CODE-SHELL-10 — `tabs` duplicates the order of `documents`
- What / Where: `src/stores/document.ts:23-25`. Every document is created with a tab and removed with it, so `tabs` is a permutation of `documents` ids kept in sync by hand. The palette's "Open documents" iterates `documents` (`CommandPalette.tsx:455`), so it lists creation order, not the tab order the user arranged.
- Why: duplicated state (opinion; Zustand has no rule here).
- Cost/benefit: about −15 LOC in the store. `reorderTab` reorders `documents`; 6 readers of `.tabs` in `src/features/tabs` switch to `documents.map(d => d.id)` or a selector.
- Risk: touches the tab strip, MRU and dnd. Not persisted.
- Options: (A) merge; (B, recommended for 1.0) keep the shape, make the palette list follow `tabs`.
- Recommendation: simplify

### CODE-SHELL-11 — Toast `dismissLabel` is dead after the importer cut
- What / Where: `src/stores/notifications.ts:20-30,96-104,117,133,170-173`, `src/features/notifications/Toaster.tsx:94`. It existed for "Cancel import". The one remaining `notify.pending` caller (`export-ops.ts:62`) passes none.
- Why: W1 cut all importers (w1-decisions, approved 2026-11-17).
- Cost/benefit: about −15 LOC; `NotifyOptions` becomes `{ action? }`.
- Risk: none.
- Recommendation: cut

### CODE-SHELL-12 — Persistence is split across two homes, inside a 237-line effect
- What / Where: settings, recents, keybindings and UI prefs persist through subscriptions in `useStartup` (`use-startup.ts:183-220`); the workspace root persists from inside store actions (`src/stores/workspace.ts:73-80`). `useStartup` mixes hydration, persistence, i18n, the open-with drain and welcome seeding in one `useEffect`.
- Why: opinion. These are app-lifetime side effects, not component effects. A plain `persistence.ts` (load + subscribe) called once from `main.tsx` survives StrictMode double-mount by construction and is testable without rendering.
- Cost/benefit: about ±0 LOC, clearer startup path; pairs with 01 and 06.
- Risk: low; ordering of open-with drain vs workspace restore must be kept.
- Recommendation: simplify (only if 01/06 are taken; otherwise keep)

### CODE-SHELL-13 — `App` re-renders the whole shell on every typography/accent change
- What / Where: `src/app/App.tsx:297-302` subscribes `App` to six settings only to write `<html>` attributes and CSS variables in three effects (`:330-347`). Each slider commit re-renders `App` and every child that isn't memoized (Sidebar, StatusBar, editor wrapper).
- Why: these are DOM syncs, not render inputs. One `useSettings.subscribe` that writes the attributes (next to `mirrorAccent`) does the same without rendering (opinion).
- Cost/benefit: about −15 LOC in `App`, fewer re-renders.
- Risk: the first apply must happen at module init or after hydrate (as today, since hydrate calls `set`).
- Recommendation: simplify

### CODE-SHELL-14 — Small redundancies in `src/app`
- What / Where: `COMMANDS` repeats each key as `id` (`commands.ts`, 35 lines; derive it). `usePlatformChrome` (`chrome/use-platform-chrome.ts`) is a "hook" around a pure function and calls `platform()` on every render (make it a module constant). `menu/event-names.ts` is a one-line module. `workspace.revealPath`/`revealForce` versus `lib/reveal.ts` use "reveal" for two different things (naming only).
- Why: less is more (opinion).
- Cost/benefit: about −45 LOC. Risk: none (tests reference `id`; adjust).
- Recommendation: simplify

### CODE-SHELL-15 — Wave 2 focus helpers (`focus-return.ts`, `reveal.ts`): no duplication found
- What / Where: `src/lib/focus-return.ts` is shared by `dialog.tsx`, `AppMenubar`, `use-floating-sidebar`, `use-settings-panel`. `context-menu.tsx`'s own `returnFocus` prop is a target getter, not a second implementation. `src/lib/reveal.ts` is shared by TabBar, Outline and FileTree. No other `scrollIntoView` fallback exists for passive reveal. Settings migrations v0→v4 are small and still needed (tags v0.1.0–v0.5.1 exist).
- Why: requested check.
- Cost/benefit: none. Risk: none.
- Recommendation: keep

---

## Later (not for 1.0)
- Menu items with an `enabled` predicate (ROADMAP [Plus]). Once 04 lands, the registry is the place for it.
- Derive `isDirty` (`markdown !== savedMarkdown`) plus a `deletedOnDisk` flag instead of storing it.
