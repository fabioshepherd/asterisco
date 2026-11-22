# Wave 1 cost findings (dependency-weight audit)

> **Historical record** of the 1.0 consolidation (November 2026), closed on
> 2026-11-19. It was written in the project's previous repository, now kept as a
> private archive: commit hashes, PR numbers, branch names, `file:line`
> references and scripts cited here refer to that tree and may no longer exist.
> The current state is in [`docs/ROADMAP.md`](../ROADMAP.md) and
> [`CHANGELOG.md`](../../CHANGELOG.md).

Date: 2026-11-17. Tree: Wave 0 baseline (v0.5.1, deps refreshed). Totals: 216 JS chunks, 8,754,953 B raw / 2,704,850 B gzip (level 6, per file).
Initial load = `index` + `dist` (CodeMirror core) chunks = 2,679,069 B raw / 858,701 B gzip; everything else is a lazy chunk.
Bundle numbers are sourcemap-attributed (bytes of generated code per source file; gzip is the chunk's gzip pro-rated by raw share), so +-5%.
LOC = non-blank, non-test (matches `baseline.md`). "excl." = packages reachable only through that feature's direct deps.

## Feature table

| Feature | LOC | Exclusive npm deps (direct/transitive) | Rust surface | Bundle raw / gzip | Initial or lazy | Note |
| --- | ---: | --- | --- | --- | --- | --- |
| command-palette | 917 | cmdk 1 / 5 (radix-primitive internals) | none | 24 KB / 7.7 KB (cmdk 4.6 KB + src 3.2 KB) | initial | cheap |
| export: HTML / print / clipboard | ~900 | `marked` 1 / 0 | none | 68 KB / 21.7 KB (marked 16.6 KB + src 5.1 KB) | initial | also pulls `katex` (static) |
| export: DOCX (`markdown-docx`, `fflate`) | ~260 of 1,135 (restyle-docx, reference-template, part of export-ops) | markdown-docx 1 / 20 (docx, fast-xml-parser, xml-js, nanoid, hash.js, nested marked@15 + katex@0.16.47, commander x2, image-size, @types/node@25); fflate 1 / 0 | `write_binary_file` only (shared) | docx stack 760 KB / 226.1 KB; fflate 12.9 KB / 4.1 KB | docx lazy (one chunk); fflate initial | 8.4% of all JS gzip for one menu item |
| import: DOCX (`mammoth`, `turndown`, gfm plugin) | part of 526 (docx.ts 66) | mammoth 1 / 10 (jszip is shared, dingbat-to-unicode, @xmldom, xmlbuilder, underscore, lop...); turndown+gfm 1 / 2 (@mixmark-io/domino) | `read_import_bytes` (shared) | mammoth stack 407 KB / 104.3 KB; turndown+gfm 16 KB / 6.5 KB | lazy | `dingbat-to-unicode` alone is 30.7 KB gz |
| import: PDF (`pdfjs-dist`) | part of 526 (pdf.ts + heuristics ~150) | pdfjs-dist 1 / 3 (`@napi-rs/canvas` + 2 native binaries, not bundled) | `read_import_bytes` (shared) | main 451 KB / 136.0 KB; **worker asset `pdf.worker.min.mjs` 1,271,915 B / 379,236 B** | lazy (both) | worker is `.mjs`, so NOT in the baseline JS total |
| import: CSV / XLSX | part of 526 | none (JS side) | 5 commands (`import_csv[_bytes]`, `import_xlsx[_bytes]`, `read_import_bytes`), `commands/import.rs` 101 + `import/` 210 LOC, crates `csv` (3 excl.), `calamine` (12 excl., incl. `zip` shared with updater), `base64` | JS: import src 7.3 KB / 3.2 KB total (2.0 KB lazy) | mostly initial | the cost is in the binary, not the bundle |
| mermaid | 96 (`editor/mermaid.ts`) | mermaid 1 / 108 (113 reachable: d3, cytoscape, langium/chevrotain, roughjs, dayjs, own katex 0.16.47, marked 16...) | none | **3.35 MB / 959 KB** (mermaid 517, @mermaid-js/parser 155, cytoscape 143, fcose 35, dagre-d3-es 11, own katex copy 77) | lazy (~50 chunks, per diagram type) | 35% of all JS gzip; loaded only when a diagram renders |
| KaTeX | 0 own (Crepe `katexOptions` + export `render-rich`) | katex is transitive (0.19.1 via Crepe/export); not in package.json | none | 259 KB / 83.2 KB JS + 59 font files 1.07 MB (ttf+woff+woff2 all emitted) + CSS | initial (JS); fonts on demand | mermaid ships a second katex (0.16.47, 77 KB gz) |
| code-block languages (Crepe `language-data`, not a feature in `src`) | 0 | `@codemirror/language-data` via Crepe | none | 1.17 MB / 447 KB (legacy-modes 189, @lezer/* langs, lang-* pkgs) | lazy (init share 53.5 KB) | pulled by Crepe code block, unrelated to our code |
| editor: WYSIWYG (Crepe/Milkdown) | 3,282 src/editor total (CrepeEditor 305, footnotes 505, definition-lists 344, auto-pairing 242...) | @milkdown/*, prosemirror-*, remark/mdast/micromark, @vue/* runtime (Crepe) | none | milkdown stack 755 KB / 242 KB + editor src ~11 KB gz | initial | largest initial stack after CodeMirror |
| editor: source mode (CodeMirror) | SourceEditor 140 + source-search 90 + edit-commands 301 | 0 excl. (Crepe code block shares CodeMirror) | none | CodeMirror core 345 KB / 112.9 KB (own `dist` chunk) + state/view/commands/search in index | initial | cannot be dropped alone without losing code blocks |
| split view | 569 | 0 (dnd-kit shared with tabs/file-tree) | none | src 7.3 KB / 2.4 KB | initial | cheap in bytes, high in complexity |
| `dnd-kit` (core+sortable+utilities) | used in split, tabs, file-tree | 3 direct / 1 transitive (@dnd-kit/accessibility) | none | 50 KB / 16.2 KB | initial | 3 features depend on it |
| `motion` | 73 in MotionProvider + ThemeCrossfade; `m.*` in 13 files | 1 / 3 (framer-motion, motion-dom, motion-utils) | none | 82 KB / 26.3 KB (`LazyMotion` + `domAnimation`) | initial | already the reduced `m` build |
| updater | 37 | `@tauri-apps/plugin-updater` 1 / 0 | crate `tauri-plugin-updater` (11 excl. crates: zip, tar, typed-path, minisign-verify, nix, xattr...), capability `updater:default`, `tauri.conf` `plugins.updater` (endpoint + pubkey), `createUpdaterArtifacts`, 0 commands | 1 KB / 0.5 KB + src 0.2 KB | lazy | negligible JS, real build/release surface |
| settings | 2,318 | 0 | `settings-store` via plugin-store (1 crate) | 35 KB / 11.2 KB | initial | largest feature src; LOC cost > byte cost |
| file-tree | 1,896 | 0 | `fs.rs` 286, `workspace.rs` 190, `fs_policy.rs` 198, `trash` (5 excl. crates) | 26 KB / 8.4 KB | initial | shared with file-ops |
| file-ops | 319 | 0 | shares fs commands, `assets.rs` 64 (image save) | 4 KB / 1.4 KB | initial | |
| file-sync | 213 | 0 | `watcher.rs` 129, 2 commands, `notify` + `notify-debouncer-full` (19 excl. crates) | 2 KB / 0.7 KB | initial | |
| search (workspace) | 315 | 0 | `search.rs` 236, 1 command; `ignore` is shared with `fs_policy` (5 excl. crates) | 5.7 KB / 1.8 KB | initial | |
| themes (custom CSS) | 338 | 0 | `themes.rs` 136, 3 commands, reuses `notify` | 3.2 KB / 1.0 KB | initial | |
| tabs | 988 | 0 (dnd-kit shared) | none | 11.8 KB / 3.8 KB | initial | |
| find-replace | 537 | 0 | none | 7.5 KB / 2.4 KB | initial | |
| status-bar | 295 | 0 | none | 5.1 KB / 1.6 KB | initial | |
| welcome | 211 | 0 | none | 5.3 KB / 1.7 KB | initial | |
| notifications | 156 | 0 | none | 3.4 KB / 1.1 KB | initial | |
| outline | 196 | 0 | none | 2.7 KB / 0.9 KB | initial | |

## Biggest cost observations

- Mermaid is the heaviest dependency by far: 959 KB gz (35% of all JS) in ~50 lazy chunks, 108 exclusive npm packages; zero cost on first paint. Candidate: keep lazy, or cut.
- PDF import costs 136 KB gz (lib) plus a 379 KB gz worker (`.mjs`, missed by the baseline JS sum, so real JS is ~3.08 MB gz, not 2.71 MB): ~515 KB gz for one import format, lazy.
- DOCX export is 226 KB gz lazy, 20 exclusive packages, mostly `docx` (115 KB) + `markdown-docx` (96 KB); `fflate` adds 4 KB in the initial chunk for restyling. Candidate.
- DOCX import (`mammoth` + `turndown`) is ~111 KB gz lazy; `dingbat-to-unicode` is 31 KB of it. Together the four import/export converters (DOCX, PDF, DOCX export) are ~1.0 MB gz lazy (~38% of JS), none on first paint.
- Duplicate KaTeX: 0.19.1 (83 KB gz, initial, via Crepe math + export) and 0.16.47 inside mermaid (77 KB gz, lazy). Also 3 `marked` versions installed (18 ours, 15 via markdown-docx, 16 via mermaid); `marked` 18 is initial (16.6 KB gz), used only by `render-rich` export.
- KaTeX emits 59 font files (1.07 MB: ttf + woff + woff2) into the bundle although a WebView needs one format; likely the largest static-asset line after pdf worker.
- Code-block language support from Crepe `language-data` is 447 KB gz (lazy chunks of legacy-modes + lezer/lang-*) and not our code; 53.5 KB of it is already in the initial chunk.
- Initial load is 859 KB gz: Crepe/Milkdown/prosemirror stack ~242 KB, CodeMirror ~113 KB + extras, KaTeX 83 KB, react-dom 68 KB, `motion` 26 KB, `dnd-kit` 16 KB, `marked` 17 KB, `dompurify` 10 KB. Our own `src/` is only ~75 KB gz of it (settings 11 KB is the largest).
- Split view is 569 LOC and 2.4 KB gz, and `dnd-kit` (16 KB gz) is shared with tabs and file-tree, so cutting split frees little bundle and no dependency; its cost is code and UI complexity (candidate: LOC, not bytes).
- Rust: CSV/XLSX import is 5 commands, ~310 LOC and 2 exclusive crate groups (`calamine` 12, `csv` 3, plus `base64`); the updater brings 11 exclusive crates plus signing config; `notify` brings 19 (shared by file-sync and themes watcher). None of this is visible in the JS bundle.

## How measured

- `bunx vite build --sourcemap --outDir <scratchpad>/out --emptyOutDir` on the unmodified `vite.config.ts` (CLI flags only; no config edit, no dependency added; the output went to the session scratchpad, not `dist/`).
- A throwaway script (kept in the scratchpad, not in the repo) decoded each `.js.map` VLQ mapping, attributed the generated bytes of each segment to its source file, grouped by `node_modules/<pkg>` or `src/features/<name>`, and pro-rated the chunk's Node `gzip` (level 6) by raw-byte share. "Initial" = `index-*.js` + its static import `dist-*.js` (found by following static `import`/`from` edges from `index.html`; `import()` edges are lazy). 8 small chunks have no map and were counted in totals only.
- Exclusive npm deps: walked `node_modules/*/package.json` `dependencies` + `optionalDependencies` from each direct dependency (resolving nested installs by directory), then subtracted packages reachable from every other direct dependency. Dev deps excluded. Nested copies count separately (e.g. `marked@15` vs `marked@18`).
- Exclusive crates: `cargo metadata --offline` resolve graph (non-dev edges, all targets), same subtraction against the app crate's other direct deps. Counts therefore include platform-specific crates (e.g. `notify` shows Windows/macOS crates).
- LOC: non-blank lines of non-test files; Rust excludes everything after `#[cfg(test)]`. "~" values are partial-file estimates.
- Not measured: CSS split per feature (167 KB raw total), runtime cost (parse/execute), installer size per feature, Windows/macOS builds. Pro-rated gzip ignores cross-module compression, so per-feature numbers do not sum exactly to the totals.
