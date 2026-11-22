# Gate snapshot (Wave 0, baseline before any change)

> **Historical record** of the 1.0 consolidation (November 2026), closed on
> 2026-11-19. It was written in the project's previous repository, now kept as a
> private archive: commit hashes, PR numbers, branch names, `file:line`
> references and scripts cited here refer to that tree and may no longer exist.
> The current state is in [`docs/ROADMAP.md`](../ROADMAP.md) and
> [`CHANGELOG.md`](../../CHANGELOG.md).

- Date: 2026-11-17
- Commit: db9434e
- Purpose: record gates that already fail, so later waves are judged on "no new regressions".

| Gate | Status | Detail |
| --- | --- | --- |
| `bun run typecheck` | pass | `tsc --noEmit -p tsconfig.app.json`, no errors |
| `bun run lint` | pass | eslint clean, prettier `--check` clean |
| `bun run test` | pass | vitest 4.1.7: 135 files passed, 1118 tests passed, 0 failed; 43.3 s |
| `cargo clippy -- -D warnings` | pass | exit 0 (after installing Tauri Linux prerequisites via apt: libwebkit2gtk-4.1-dev, libxdo-dev, libayatana-appindicator3-dev, librsvg2-dev, build-essential) |
| `cargo test` | pass | 67 passed, 0 failed (lib); 0 tests in the other two targets |
| `cargo fmt --check` | pass | exit 0, no diff |
| it/en i18n key parity | pass | `src/i18n/locales/{en,it}/{common,editor,menu}.json`: 15/15, 435/435, 65/65 keys, none missing either way |
| Hardcoded UI strings | fail (best effort) | 2 areas found, see below |
| Console errors (`bun tauri dev`) | not checked (no display) | |

Note: the system packages were installed in this sandbox only; no repo file was touched other than this one.

## Pre-existing failures

All automated gates are green. The only findings are unlocalized user-facing strings
(CLAUDE.md: "UI strings only via i18n"). Each is a Wave 1 decision candidate.

### 1. Crepe image-block labels left at English defaults
`src/editor/CrepeEditor.tsx:180-186` configures `Crepe.Feature.ImageBlock` with only
`onUpload`, `blockOnUpload`, `inlineOnUpload`, `proxyDomURL`. These localizable text
options (from `@milkdown/crepe` `ImageBlockConfig`) are not passed, so Crepe's English
defaults show in both locales:
- `inlineUploadPlaceholderText`
- `blockUploadPlaceholderText`
- `blockCaptionPlaceholderText`
- `inlineUploadButton`, `blockUploadButton` (these take label/markup)
- `inlineConfirmButton`, `blockConfirmButton` (icon markup, likely fine)

By contrast Placeholder, CodeMirror (search/noResult/copy/preview), BlockEdit slash menu
(text/list/advanced groups) and LinkTooltip `inputPlaceholder` ARE localized
(`CrepeEditor.tsx:121-177`).

### 2. English literal returned as UI error text
`src/features/find-replace/find-utils.ts:45`: fallback `"Invalid regular expression"`
returned when the thrown error is not an `Error` instance (otherwise the engine's
English `error.message` is surfaced as-is, also unlocalized).

### Not verified
- Other Crepe features not configured in `featureConfigs` (e.g. table / toolbar
  tooltips, if any ship text defaults) were not audited; only a grep-level pass of
  `src/**/*.tsx|ts` for obvious English literals was done (no hits in JSX attributes
  `aria-label=`, `title=`, `placeholder=`).
- Runtime console errors: not checked (no display).

## Known defects found by e2e (Wave 0)

Found by the Playwright suite (`e2e/core.spec.ts`). Each is pinned by a `test.fail()`
spec, so the suite stays green while the defect exists and flags the fix (the spec then
passes unexpectedly and `test.fail` must be removed). Wave 1 fix items.

### W0-KD-1: saving right after typing writes stale content
- Status: fixed in Wave 1 (V1-01).
- Spec: `save right after typing writes the latest text`.
- Edits reach the document store only through Milkdown's `markdownUpdated` listener,
  which is debounced ~200 ms (`node_modules/@milkdown/plugin-listener/lib/index.js:76`,
  lodash `debounce`, default 200 ms); wired at `src/editor/CrepeEditor.tsx:232`.
- Save path: Ctrl/Cmd+S (`src/app/use-save-shortcut.ts`) → `COMMANDS["save-file"]`
  (`src/app/menu/commands.ts:76`) → `saveActiveDocument` → `saveDocument`
  (`src/features/file-ops/file-ops.ts:124`), which writes `doc.markdown` from the store
  (`file-ops.ts:131`) without flushing the editor. Same for `saveDocumentAs` (`file-ops.ts:148`).
- Effect: type, save within ~200 ms → the file lacks the last edit; the tab turns dirty
  again afterwards, so it is not silent, but the saved file is behind the screen.
- Only `listener.blur` (`CrepeEditor.tsx:237`) flushes with `crepe.getMarkdown()` today.

### W0-KD-2: unedited save rewrites definition lists
- Status: fixed in Wave 1 (UX-08: extension removed).
- Spec: `unedited round trip keeps definition lists` (fixture `e2e/fixtures/deflist.md`).
- `Term\n: Def` is written back as `Term\n:   Def` (colon + 3 spaces), and a definition
  list that is the last block gains an extra trailing blank line.
- Marker spacing: `defListDescriptionHandler` in
  `node_modules/mdast-util-definition-list/lib/to-markdown.js` (`':' + ' '.repeat(3)`),
  registered at `src/editor/definition-lists.ts:49`.
- Trailing blank line: not pinned down yet; candidates are the description serializer
  (`src/editor/definition-lists.ts:117-123`, `spread` defaults to loose) and the
  list-to-mdast runner (`definition-lists.ts:68-75`). To confirm in Wave 1.
- Front matter, tables, code blocks, math and mermaid round-trip byte-exact
  (spec `unedited round trip`).

## Known limitations

- A file with mixed line endings (some CRLF, some LF) is written back with the ending most of
  its lines use once it is edited and saved; an unedited file is never rewritten
  (`src/lib/text-format.ts`).
