# Architecture

This document describes how Asterisco is put together. It is the
engineering companion to the product brief ([PRODUCT.md](./PRODUCT.md)), the
roadmap ([docs/ROADMAP.md](./docs/ROADMAP.md)) and the always-loaded brief
([CLAUDE.md](./CLAUDE.md)).

## Overview

A Tauri 2 desktop shell (Rust) hosts a React 19 + TypeScript frontend in the
OS-native WebView. The two communicate only through typed Tauri commands
(`invoke`) and events — there is no other bridge.

```
┌─────────────────────────── WebView ───────────────────────────┐
│  React 19 + TS (Vite)                                          │
│   app/        bootstrap, providers, startup, menu, chrome      │
│   editor/     Milkdown/Crepe WYSIWYG · CodeMirror · view modes │
│   features/   file tree, tabs, export, find, palette, outline  │
│   stores/     Zustand: document, workspace, ui, settings, …    │
│   i18n/       i18next (it/en), inline resources                │
│   styles/     design tokens + light/dark themes (CSS vars)     │
│   components/ design system (components/ui = shadcn on Radix)   │
│   lib/tauri/  typed bridge: invoke(...) + event listeners      │
└───────────────▲───────────────────────────────┬───────────────┘
        events  │  (menu://*, …)        invoke   │  (read_text_file, …)
┌───────────────┴───────────────────────────────▼───────────────┐
│  Rust backend (src-tauri)                                      │
│   commands/   #[tauri::command] fs I/O (the only fs access)    │
│   menu/       native menu construction + event forwarding      │
│   error.rs    AppError → tagged JSON the frontend narrows      │
│   plugins     dialog, store, window-state, os, opener,         │
│               clipboard-manager, updater, log, single-instance │
│   capabilities/ plugin and core permissions per window         │
└────────────────────────────────────────────────────────────────┘
```

## Responsibility boundary

- **Rust (backend)** owns all filesystem and native I/O: reading/writing files,
  native dialogs, window state persistence, native menus, export and
  auto-update. It exposes typed commands; the capability system
  gates plugin and core permissions only (see Security below).
- **React (frontend)** owns editing, rendering, UI state, theming, settings and
  interactions. It never touches the filesystem directly.

### Why custom commands instead of the fs plugin

The frontend is **not** granted the `fs:*` capability. Instead, every file
operation is a hand-written `#[tauri::command]` in [src-tauri/src/commands/](./src-tauri/src/commands/)
(file I/O in `fs.rs`; search, workspace listing, image assets and themes in their
own modules), surfaced through the typed wrappers in [src/lib/tauri/](./src/lib/tauri/).
This keeps the attack surface to an explicit, reviewable list of operations and
lets us enforce invariants (e.g. `move_to_trash` never hard-deletes) in one place.

Commands return `AppResult<T>`; on error the Rust `AppError` serializes to a
tagged union `{ kind, message }` that the frontend narrows via
[src/lib/tauri/errors.ts](./src/lib/tauri/errors.ts).

## Theming

All colors are CSS variables, so themes are pure CSS and every component works in
both light and dark mode ([src/styles/global.css](./src/styles/global.css)):

- **Primitive tokens** (`--font-*`, `--radius-*`, `--shadow-*`) live in Tailwind
  v4's `@theme` block.
- **Semantic tokens** (`--bg`, `--fg`, `--muted`, `--border`, `--primary`, …) are
  declared on `:root` (light) and `[data-theme="dark"]` (dark), then mapped into
  Tailwind utilities with `@theme inline` so utilities follow live theme switches.
- The effective theme is resolved by the pure `resolveTheme(preference, systemDark)`
  ([src/stores/theme.ts](./src/stores/theme.ts)) from the user's preference
  (`system | light | dark`) and the OS color scheme.

**Source of truth & flow:** the Zustand settings store holds `themePreference`,
persisted to disk via `tauri-plugin-store`. `useThemeSync` watches the preference
and a `matchMedia` listener, sets `<html data-theme>`. A tiny
pre-paint script ([public/theme-init.js](./public/theme-init.js)) reads a
`localStorage` mirror of the preference to set the theme before first paint and
avoid a flash (FOUC). It is an external file so it satisfies `script-src 'self'`.

## State management (Zustand)

- `stores/settings.ts` — persisted preferences (`themePreference`, `language`,
  `showIgnoredFolders` (which replaced `showHiddenFiles` in schema v2), autosave,
  a schema version); persisted via plugin-store.
- `stores/ui.ts` — transient UI: `viewMode` (`edit | source | reading`) and
  sidebar width and sidebar/outline visibility.
- `stores/theme.ts` — pure theme-resolution logic (unit-tested).
- `stores/document.ts` — the open document (path, content, dirty/baseline).
- `stores/workspace.ts` — the opened folder and a nonce to force file-tree reload.
- `stores/recents.ts` — recently opened files and folders.
- `stores/selection.ts` — live editor-selection text, for per-selection counts.
- `stores/notifications.ts` — toast notifications.

Persistence and hydration happen in `app/use-startup.ts`: load persisted settings
(falling back to the OS locale for language), then subscribe to persist changes
and keep i18n in sync.

## i18n

i18next with **inline** resources (local-first: no network backend, no auto
detector). Namespaces `common`, `menu` and `editor`, languages `it`/`en`, fallback `en`.
Initial language comes from the persisted setting, else the OS locale. Translation
keys are type-checked against the English resources
([src/i18n/i18next.d.ts](./src/i18n/i18next.d.ts)). No UI string is hardcoded.

## Menus, commands & window chrome

A single **command registry** in the frontend (`app/menu/`) is the one source of
truth for actions: it feeds the command palette, the keybindings, and a
declarative menu model. That localized menu spec is serialized to the backend,
which builds the native menu data-driven from it ([src-tauri/src/menu/](./src-tauri/src/menu/)),
so labels follow the active language and the menu rebuilds on language change.
Custom items emit `menu://<id>` events the frontend handles in
`app/use-menu-events.ts` (the event-name contract is pinned by a test);
predefined items (Quit, Copy, Undo, Minimize, Fullscreen, …) are handled
natively. On macOS the application menu (Services / Hide / Quit) stays correct.

**Window chrome is per-platform** (`app/chrome/`, selected by
`use-platform-chrome`): macOS uses an overlay title strip
([MacTitleStrip](./src/app/chrome/MacTitleStrip.tsx)) that hosts the tabs;
Windows/Linux use frameless decorations with custom window controls and an
in-window application menubar (`AppMenubar`) rendered from the same menu model
(Alt/F10 to focus).

## Editor & view modes

The document host ([src/editor/DocumentEditor.tsx](./src/editor/DocumentEditor.tsx))
switches on `ui.viewMode`:

- **edit** — Milkdown via Crepe ([CrepeEditor](./src/editor/CrepeEditor.tsx)),
  WYSIWYG markdown-native, with plugins for code blocks (CodeMirror, token-based syntax
  colours), KaTeX math, Mermaid, frontmatter and image upload.
- **source** — raw Markdown in CodeMirror 6 ([SourceEditor](./src/editor/SourceEditor.tsx)).
- **reading** — the same Crepe page, read-only, on the same text measure.

Both editors feed `stores/selection.ts` so the status bar can count the current
selection. Feature UIs (file tree, tabs, export, find & replace, command
palette, outline, settings, …) live under [src/features/](./src/features/).

## Security

- **Local-first:** no network calls except the update check the user triggers;
  AI/sync/upload features (future) are opt-in, behind flags and explicit
  consent.
- **Capabilities/ACL:** [src-tauri/capabilities/default.json](./src-tauri/capabilities/default.json)
  grants 18 permission entries to the `main` window: the
  `core:default` set plus seven window permissions (fullscreen, minimize,
  maximize, drag, close, destroy);
  `dialog:default`, `store:default`, `os:allow-locale`, `log:default`,
  `updater:default`; clipboard write-text, write-html and read-text (read-text
  backs Edit ▸ Paste on Windows/Linux); and two scoped `opener` entries —
  opening a path only under `$APPCONFIG/themes`, and opening only `http:`,
  `https:` and `mailto:` URLs. There is **no `fs:*` permission**, so the
  frontend has no direct filesystem access through the plugin (the
  `tauri-plugin-fs` plugin is not registered).
  The `print-*` windows, which render document-derived HTML, get only
  [print.json](./src-tauri/capabilities/print.json): events, the print call
  and the log. They are created in Rust (`open_print_window`, always on the
  app's print page), so no window can create a webview on another page.
  The capabilities gate plugin and core permissions only: the app declares no
  ACL manifest for its own commands, so every window, print windows included,
  can call the custom Rust commands (`read_text_file`, `write_text_file`,
  `move_to_trash`, …). Gating them per window is a later hardening.
- **Navigation guard:** [src-tauri/src/navigation.rs](./src-tauri/src/navigation.rs)
  cancels any navigation of a webview away from the app page, so a clicked
  link can neither load a remote site inside the app nor reload it.
- **CSP:** restrictive policy in [src-tauri/tauri.conf.json](./src-tauri/tauri.conf.json)
  (`default-src 'self'`, no external origins, IPC only on `connect-src`). A
  separate, looser `devCsp` allows Vite HMR in development only.
- **Asset-protocol scope (`assetProtocol.scope: ["$HOME/**"]`):** the asset
  protocol is what lets the WebView render local images referenced by an open
  Markdown file (e.g. `![](./images/diagram.png)`). Because users open `.md`
  files — and their relative images — from anywhere under their home directory,
  the scope is deliberately broad (`$HOME/**`). Narrowing it (e.g. to a single
  fixed folder) would break image rendering for documents opened elsewhere,
  which is the common case. This is an accepted trade-off for the first release.
  - **Known limit:** on macOS and Linux the glob does not match a leading dot,
    so images under a dot-folder (`.github/`, `.claude/`, a repository under
    `~/.local`) and images outside `$HOME` (a second drive, `/Volumes`, `D:\`)
    do not render. The dynamic scope below lifts both.
  - Nothing `fetch`es asset URLs (images load through `img-src`), so
    `connect-src` does not list the asset protocol.
  - **Future direction:** make the scope **dynamic per workspace** — grant only
    the directory tree of the currently open file/workspace at runtime, instead
    of all of `$HOME` up front.
  - **What the filesystem boundary really is:** the frontend has no `fs:*`
    capability, and every read/write/trash operation goes through a
    hand-written Rust command. Those commands (`read_text_file`,
    `write_text_file`, `create_file`, `rename_path`, `move_to_trash`,
    `read_dir`, `save_image_asset`, …) are **not** restricted to paths picked
    in a native dialog: they accept any absolute path the frontend passes, and
    run with the user's own OS permissions. The protection is that no
    untrusted script runs in the WebView (CSP `script-src 'self'`, HTML from
    Markdown sanitised with DOMPurify, navigation guard above); a compromised
    WebView would be equivalent to user-level file read/write. Restricting the
    commands to user-granted folders is planned for later (not in 1.0). The
    asset scope itself only governs which on-disk files the WebView may
    *display*.

## Build pipeline

`vite.config.ts` is tuned for Tauri: fixed dev port 5173 (`strictPort`),
`clearScreen: false`, `TAURI_ENV_*` env passthrough, and a platform-split
`build.target` (`safari16` for the WebKit WebView, `chrome105` for WebView2 on
Windows), and the Oxc minifier. TypeScript uses a split config
(`tsconfig.app.json` + `tsconfig.node.json` + `tsconfig.e2e.json`, all checked
by `bun run typecheck`) under strict mode with `moduleResolution: bundler`.

## Verified version pins (November 2026)

Tauri 2.12.6 (Rust) · `@tauri-apps/api` 2.12.5 · React 19.3.1 · TypeScript 6.0.3 ·
Vite 8.3.8 · Tailwind 4.3.5 · Zustand 5.1.0 · i18next 26.3.0 · Vitest 4.1.7.
Editor stack: Milkdown/Crepe 7.23.0 · CodeMirror 6 · Mermaid 11 ·
Motion 14. Tauri plugins (Rust): dialog 2.8.4, store 2.5.1, window-state 2.5.0,
os 2.4.0, opener 2.7.3, clipboard-manager 2.5.0, updater 2.14.1, log 2.10.2,
single-instance 2.5.5.

> Note: Vite 8 and TypeScript 6 are newer majors than the original spec assumed
> (it predates them); we pin the current stable releases per the "verify latest
> stable" rule.

## Roadmap

Phase 0 (scaffold) and the Phase 1 MVP — Milkdown/Crepe editor, open/save,
command palette, find & replace, file tree, tabs, view modes, HTML export and
print — are in place. Phase 2 (V1.0) is done except the release gates (the
product name and the platform release smoke test). Phase 3 Plus → Phase 4
Future follow.
See [docs/ROADMAP.md](./docs/ROADMAP.md) for the full breakdown.
