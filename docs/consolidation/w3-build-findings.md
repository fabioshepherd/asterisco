# Wave 3 build findings (build and dependency engineer)

> **Historical record** of the 1.0 consolidation (November 2026), closed on
> 2026-11-19. It was written in the project's previous repository, now kept as a
> private archive: commit hashes, PR numbers, branch names, `file:line`
> references and scripts cited here refer to that tree and may no longer exist.
> The current state is in [`docs/ROADMAP.md`](../ROADMAP.md) and
> [`CHANGELOG.md`](../../CHANGELOG.md).

Date: 2026-11-18. Tree: `consolidation/wave-3` (= origin/main after Waves 0-2). Read-only audit; nothing outside this file was changed.
Measured with `bunx vite build --sourcemap --outDir <scratchpad>` (raw+gzip level 6 per file, sourcemap attribution), `cargo about` 0.8.4 (installed) and 0.9.3 (built in the scratchpad), `npm view`. Scratch work stayed outside the repo.
Context change since `w1-cost-findings.md`: DOCX/PDF/CSV import-export, `mammoth`, `markdown-docx`, `pdfjs-dist`, `turndown`, `fflate`, `@tanstack/highlight` are no longer in `package.json`; JS is now 209 chunks, 7.01 MB raw / 2.18 MB gz; initial load (`index` + `dist`) is 2.59 MB raw / **827 KB gz** (was 859).
Tauri stays 2.x (3.x is alpha). `@milkdown/*` and `@playwright/test` stay pinned (deps.md). `@tanstack/highlight` is gone, skipped.

## Part A: build, chunking, notices

### CODE-BUILD-01 — Notices generation silently does nothing in the release workflow
- What: `.github/workflows/release.yml:106-107` runs `cargo install --locked cargo-about@0.9.0 || true` then `bun run notices || echo "notices generation skipped"`. cargo-about 0.9 gates the binary behind the `cli` feature ([changelog 0.9.0, PR#299](https://raw.githubusercontent.com/EmbarkStudios/cargo-about/main/CHANGELOG.md), read 2026-11-18): I built 0.9.3 without it and cargo finished with "none of the package's binaries are available ... requires the features: `cli`" and installed no binary. Even with `--features cli`, `src-tauri/about.toml:11` (`no-clearly-defined = true`) fails 0.9.x with `expected a table, found boolean` (key removed in 0.8.0, PR#287). So on a clean runner the step never generates anything and the committed `src-tauri/THIRD-PARTY-NOTICES.txt` ships as is; both `|| true` / `|| echo` hide it. This is the Wave 0 "0.8.4 vs 0.9" incompatibility, now root-caused.
- Why: CLAUDE.md "the build MUST generate and bundle a THIRD-PARTY-NOTICES file"; a swallowed failure means notices go stale on the first dependency change.
- Cost/benefit: delete 1 line from `about.toml`; I verified the file without it gives byte-identical output on 0.8.4 and runs on 0.9.3 (0.9.3 lists 617 crates vs 586, it no longer discards found license files, changelog 0.9.2). CI: `cargo install --locked --features cli cargo-about@0.9.3` (about 1 min) and drop both `|| ...` so a failure fails the release (or keep the committed file and regenerate in a PR check).
- Risk: low. Release job gets stricter, which is the point. Update the stale comment at the top of `about.toml` (wrong `about.hbs` path).
- Recommendation: fix. **required** (licensing rule).

### CODE-BUILD-02 — Rust license texts are HTML-escaped in the shipped notices
- What: `src-tauri/about.hbs:14` uses `{{text}}`; Handlebars escapes it, so the bundled Apache-2.0 text reads `&quot;License&quot; shall mean ...` (629 entities in `THIRD-PARTY-NOTICES-rust.txt`, shown to users in Settings, View third-party notices). Verified: with `{{{text}}}` the entities drop to 3 (genuine ones in the texts). The npm half (`generate-license-file`) is clean. `Used by` names should stay `{{ }}`.
- Why: license text must be reproduced verbatim (MIT/Apache/BSD notice clauses); altered quoting is a defect in the thing the notice exists to prove.
- Cost/benefit: 1 character change in `about.hbs`, regenerate the file (committed, ~600 KB).
- Risk: none (text only; `NoticesDialog` renders plain text, check it does not `dangerouslySetInnerHTML` an unescaped `<`).
- Recommendation: fix. **required**.

### CODE-BUILD-03 — `katex` is imported but not declared (phantom dependency)
- What: `src/features/export/render-rich.ts:2`, `theme-snapshot.ts:1` (`katex/dist/katex.min.css?raw`), `PrintView.tsx:5` import `katex`, but `package.json` has none; it resolves to the copy hoisted for `@milkdown/crepe` (0.19.1). `npm ls katex`: crepe 0.19.1, mermaid 0.16.47, `micromark-extension-math` 0.16.47.
- Why: a Crepe bump that changes its katex range silently changes our export renderer; `generate-license-file --input package.json` only sees it transitively. Rule of opinion: declare what you import.
- Cost/benefit: +1 line (`"katex": "^0.19.1"`); katex 0.19 ships its own types (`types/katex.d.ts`), so `@types/katex` is not needed.
- Risk: none (same installed version).
- Recommendation: fix. Not strictly required, but cheap and it pins the thing CODE-BUILD-06 depends on.

### CODE-BUILD-04 — Two direct dependencies are unused or half-used
- What: `codemirror` (the basicSetup meta-package) is declared but never imported (`grep` over `src/ e2e/ scripts/` finds only the string `"codemirror"` as a union tag in `edit-commands.ts`); Crepe depends on it by itself (`@milkdown/crepe/package.json:122`). `@radix-ui/react-slot` is used only for `Button`'s `asChild` (`button.tsx:40-47`) and no call site passes `asChild`.
- Why: less is more; each direct dep is a notice entry and an update to review.
- Cost/benefit: remove `codemirror` (-1 direct dep, no bundle change). Slot: drop the prop and the import (-1 direct dep, about -12 LOC; Slot stays installed through `@radix-ui/react-dialog`). Do both in one commit.
- Risk: none for `codemirror`; Slot: only if an unmerged branch uses `asChild`.
- Recommendation: cut.

### CODE-BUILD-05 — `build.minify: "esbuild"` is deprecated in Vite 8; the `esbuild` dev dependency exists only for it
- What: `vite.config.ts:41` selects esbuild; Vite 8 default is Oxc and `'esbuild'` "is deprecated and will be removed" ([vite.dev/config/build-options](https://vite.dev/config/build-options#build-minify), read 2026-11-18). The only other `esbuild` reference in the repo is `package.json:81`.
- Why: deprecated option pinned by an extra dependency.
- Cost/benefit: measured `vite build --minify oxc` vs current: JS 7,013,696 to 6,896,780 B raw (-1.7%), 2,184,302 to 2,115,264 B gz (-3.2%, about -69 KB), build 5.6 s to 1.9 s (the first run included sourcemaps, so time is indicative only). Change: `minify: process.env.TAURI_ENV_DEBUG ? false : undefined` (or just `!process.env.TAURI_ENV_DEBUG`-style boolean) and remove `esbuild` from devDependencies.
- Risk: low; minifier output changes, so run the e2e suite once (Oxc minifier is also Vite's default for everyone).
- Recommendation: simplify.

### CODE-BUILD-06 — KaTeX is bundled twice (0.19.1 initial, 0.16.47 for mermaid)
- What: `index-*.js` contains `katex/dist/katex.mjs` (259 KB raw, about 77 KB gz, initial); mermaid pulls its own nested 0.16.47 into a lazy chunk `katex-CqSbR_mt.js` (260 KB raw, 76.9 KB gz). `micromark-extension-math` also nests a 0.16.47 but is not bundled (its main entry does not import katex).
- Why: one math renderer, one set of fonts/CSS; mermaid's range is `^0.16.x` so only an override can unify them.
- Cost/benefit: `"overrides": {"katex": "^0.19.1"}` (bun reads `overrides`/`resolutions`) removes about 260 KB raw / 77 KB gz of lazy JS and one nested install; the lazy chunk is only loaded when a diagram with math renders.
- Risk: medium-low: mermaid is only tested against 0.16; the 0.17-0.19 API used by mermaid (`katex.renderToString`) is unchanged to my knowledge but I did not verify it (no katex changelog read). Gate it with an e2e that renders a `$$` flowchart label.
- Options: A (recommended, after BUILD-03): override, test, keep if green. B: leave it; the cost is lazy and local-first means no download.
- Recommendation: simplify (try; revert if mermaid math breaks). Not required.

### CODE-BUILD-07 — Initial chunk is 827 KB gz; what can realistically move to lazy chunks
- What: attribution of `index` (714 KB gz) + `dist` (113 KB gz, CodeMirror view/state/language): katex 259 KB raw (via Crepe's Latex feature and `render-rich`), react-dom 211, prosemirror-view/model/tables/transform about 212, `@milkdown/*` (crepe 95, components 69, preset-commonmark 33), our `src` 232, `@lezer/javascript` 78, motion-dom + framer-motion 80, marked 52, i18next + react-i18next 80, `@dnd-kit/core` 40, dompurify 32, tailwind-merge 29, `@vue/runtime-core` 32 (Crepe). Mermaid is already lazy (`import("mermaid")`, `mermaid.ts:26`); the pdf/docx/xlsx stacks are gone.
- Why: only `src/main.tsx` -> `PrintView` -> `katex`/css, `export-ops` -> `render-rich` -> `marked` + `katex` + `dompurify`, and `App` -> `DocumentEditor` -> `CrepeEditor` are static. There is no `React.lazy` in `src`.
- Cost/benefit: (a) lazy-load the export path: `export-ops` is called from menu actions only, so `await import("./render-rich")` removes `marked` (about 17 KB gz) and our export code from first paint; `dompurify` stays (mermaid.ts uses it). (b) lazy `DocumentEditor`/`CrepeEditor` would move Milkdown + ProseMirror + katex (about 450-500 KB gz, more than half the initial) behind a Suspense fallback.
- Risk: (a) low. (b) medium: restored tabs open the editor at launch anyway, so the gain is for the welcome screen only; a Suspense flash and the Crepe CSS ordering need e2e; and there is no measurement that parse time on a WebView is a problem. This is a local-first app (assets from disk), so gz size is not a download cost.
- Options: A (recommended) do (a) only; B do (a)+(b) after measuring time-to-interactive in the packaged app; C nothing.
- Recommendation: simplify (A). Opinion: the byte count is a proxy; measure startup before touching the editor.

### CODE-BUILD-08 — KaTeX ships 59 font files in three formats (817 KB never used)
- What: `katex.min.css` references each face as woff2, woff and ttf; the build emits all 59 (woff2 864 KB, woff 303 KB, ttf 514 KB). Both WebKit (macOS 10.15+, `tauri.conf.json:83`) and Chromium (Windows) read woff2, so the 40 woff/ttf files are dead weight in `dist/` and in every installer.
- Why: smaller bundle, nothing to review.
- Cost/benefit: about -817 KB in `dist/` (compresses less well than JS, so installer gain is smaller). Implementation is the only cost: a 10-line Vite plugin that strips the `woff`/`ttf` `src:` entries from the imported katex CSS (or a `generateBundle` filter plus CSS transform). `theme-snapshot.ts` also embeds the same CSS `?raw` for export, so test that path.
- Risk: low-medium (a broken `url()` in print/HTML export if the CSS and files disagree).
- Recommendation: later (post-1.0 polish) unless installer size matters now; do not hand-edit `node_modules`.

### CODE-BUILD-09 — `rust-version = "1.77.2"` is stale
- What: `src-tauri/Cargo.toml:6` says 1.77.2; `tauri`, `tauri-build` and all plugins in the lock require 1.90 (`cargo metadata` `rust_version`), `trash` 1.87, `notify` 1.88; toolchain is 1.97.
- Why: the field promises something the dependency tree cannot honor and gives a misleading MSRV error.
- Cost/benefit: set `rust-version = "1.90"` (1 line); CI uses `dtolnay/rust-toolchain@stable`, unaffected.
- Risk: none.
- Recommendation: fix.

### CODE-BUILD-10 — `bun run typecheck` and CI skip the Node config and e2e projects
- What: `package.json:12` type-checks `tsconfig.app.json` only; `ci.yml:15` runs that. `tsconfig.node.json` (vite/vitest configs) and `tsconfig.e2e.json` (all Playwright specs, including the new `a11y.spec.ts`) are compiled only by `build` (`tsc -b`), which runs in the slow `build-check.yml`. `tsc -b --noEmit` passes today (8 s).
- Why: a type error in an e2e spec is found after the e2e job ran, or only at bundle time.
- Cost/benefit: `"typecheck": "tsc -b --noEmit"` (0 LOC, +about 3 s).
- Risk: none.
- Recommendation: fix.

### CODE-BUILD-11 — Declared libraries that look redundant but should stay
- What: `marked` 18 (initial 17 KB gz, one consumer `render-rich.ts`): the remark/mdast stack in the bundle is transitive (Milkdown's `unified`/`mdast-*`, none declared); replacing `marked` would need 3+ new direct deps (`mdast-util-from-markdown`, `-to-hast`, an HTML serializer) plus rewriting the footnote/math/frontmatter extensions, so it adds rather than removes. `tailwind-merge` (29 KB raw, about 9 KB gz): needed for `extendTailwindMerge` that keeps `text-data` (V1-06). `lucide-react`: tree-shaken, 47 icons in the bundle. `@radix-ui/react-dialog` and `-menubar` back the single Dialog and the menubar; `cmdk` 4.6 KB gz. `class-variance-authority` + `clsx` are tiny and used once each.
- Why: keep-list so nobody re-opens it; evidence in the numbers above. Opinion on `marked`: its cost is the extension code, not the library.
- Recommendation: keep.

## Part B: major upgrades (surviving candidates from `deps.md`)

Latest versions from `npm view` 2026-11-18. "Not measured" = I did not install it. Policy suggestion: 1.0 ships on the current stack; only upgrade where the release notes show zero visible change and the gain is real.

### CODE-BUILD-12 — i18next 26.3.0 -> 27.1.5 and react-i18next 17.0.8 -> 18.0.2 (must move together)
- What: v27 ([i18next CHANGELOG 27.0.0](https://raw.githubusercontent.com/i18next/i18next/master/CHANGELOG.md), read 2026-11-18) changes defaults: `fallbackLng` default `false` (we set `"en"`), `returnEmptyString` false, language codes cleaned, `strictInterpolationChecks` true (types: `t()` must receive variables), dotted-language resource calls removed, escape no longer escapes `/`, Node 22+. react-i18next 18 ([CHANGELOG 18.0.0](https://raw.githubusercontent.com/i18next/react-i18next/master/CHANGELOG.md)) requires i18next 27; `Trans` always decodes entities, `useSSR` and the icu macro changes do not apply to us.
- Migration cost: `src/i18n/index.ts` already sets `fallbackLng`, `supportedLngs`, `escapeValue:false`, inline resources, no Trans/SSR/ICU. Risks are the empty-string default (any `""` translation in `it` now falls back to `en`, check `resources.test.ts` for empties) and the stricter `t()` typing (typecheck will list call sites; `ParseKeysWithoutVariables`). Estimate: small, mostly type fixes.
- Risk: low runtime, moderate type churn; benefit for 1.0 is nil (no feature we use).
- Recommendation: later (post-1.0, together). 26.x still receives patches (26.3.6 released).

### CODE-BUILD-13 — mermaid 11.17.2 -> 12.3.0
- What: v12 ([mermaid CHANGELOG 12.0.0](https://raw.githubusercontent.com/mermaid-js/mermaid/develop/packages/mermaid/CHANGELOG.md), read 2026-11-18): builds for ES2024 and Safari 17.4+ (our `vite.config.ts:38` target is `safari16`, and `tauri.conf.json:83` allows macOS 10.15 whose WKWebView is far older), and ELK becomes the default layout for flowchart/state/class/ER (diagrams change shape unless `layout: dagre`).
- Migration cost: raising the target or polyfilling, a visual regression pass on every diagram type, ELK adds another lazy chunk. Mermaid is already 35% of JS and lazy; v12 would make it larger.
- Risk: high for 1.0: a Safari floor above the app's stated macOS floor, and a visible change to users' diagrams (the opposite of "the renderer shows what the file says").
- Recommendation: never for 1.0; revisit only if the macOS floor is raised. Stay on 11.x (it is still patched: 11.17.2).

### CODE-BUILD-14 — motion 12.43.0 -> 14.14.0
- What: [Motion CHANGELOG](https://raw.githubusercontent.com/motiondivision/motion/main/CHANGELOG.md), read 2026-11-18: 13.0.0 only removes the optional `@emotion/is-prop-valid` dependency (explicit `isValidProp` prop on `MotionConfig`); 14.0.0 removes internal APIs kept for `framer-motion` 13.0-13.4 compatibility. No public-API breaks listed. We import only `LazyMotion, MotionConfig, domAnimation, m, AnimatePresence, useReducedMotion` from `motion/react` (8 files).
- Migration cost: bump + run unit/e2e; no code change expected. Bundle effect unmeasured (about 26 KB gz today).
- Risk: low (changelog); version moves fast (14.14 two weeks ago), so exact-pin or accept the caret.
- Recommendation: upgrade now (low-risk, gated by the existing suite) or later; no 1.0 benefit either way. I would do it only if the suite is green on the first try.

### CODE-BUILD-15 — eslint 9.39.5 -> 10.15.0 and @eslint/js -> 10.0.1 (chain: needs eslint-plugin-react-hooks 5.2.0 -> 7.1.1)
- What: [ESLint v10 migration guide](https://eslint.org/docs/latest/use/migrate-to-10.0.0) (curl-blocked here; read from the GitHub raw `docs/src/use/migrate-to-10.0.0.md`, 2026-11-18): Node 20.19/22.13/24+, `eslint:recommended` gains `no-unassigned-vars`, `no-useless-assignment`, `preserve-caught-error`; JSX references tracked; `eslint-env` comments error; config lookup from the file's directory (flat config only, we already use it). `eslint-plugin-react-hooks@5.2.0` peers only `^9` (`npm view`), so 10 needs react-hooks 7.x ([CHANGELOG 7.0.0/7.1.0](https://raw.githubusercontent.com/facebook/react/main/packages/eslint-plugin-react-hooks/CHANGELOG.md)): ESLint 10 support, and `recommended` now enables all React Compiler rules (`set-state-in-effect`, refs, purity, immutability).
- Migration cost: `eslint.config.js:46` spreads `reactHooks.configs.recommended.rules`, which keeps working. Unknown: how many new compiler-rule violations the 5k-LOC UI has (not measured; I did not install it). typescript-eslint 8.73 already peers `eslint ^10`.
- Risk: lint only, but potentially a long list of "fix" churn in components right before 1.0, against the "minimal changes" rule. Gain: none user-visible.
- Recommendation: later (post-1.0), as one dev-tooling PR.

### CODE-BUILD-16 — Small lint-satellite majors: eslint-config-prettier 9.1.2 -> 10.1.8, eslint-plugin-react-refresh 0.4.26 -> 0.5.8, globals 15.15.0 -> 17.14.0
- What: eslint-config-prettier 10.0.0 "add support for @stylistic formatting rules" ([CHANGELOG](https://raw.githubusercontent.com/prettier/eslint-config-prettier/main/CHANGELOG.md), read 2026-11-18); no breaking change for flat config. react-refresh 0.5.0 ([CHANGELOG](https://raw.githubusercontent.com/ArnaudBarre/eslint-plugin-react-refresh/main/CHANGELOG.md)): ESM only, needs ESLint 9 + Node 20, `customHOCs` renamed `extraHOCs`, stricter HOC validation; our config uses the default export and only `allowConstantExport`, which still work. `globals`: data-only package (its readme says ESLint 9+ should depend on it directly); majors add/remove global names, no changelog reachable (GitHub release notes blocked), unmeasured.
- Migration cost: three version bumps and one `bun run lint`; fix any new "unknown global" if `globals.browser` drops a name.
- Risk: very low, lint-only.
- Recommendation: upgrade now is acceptable (can be done independently of eslint 10 since all three peer `eslint >=7/>=8.40`); otherwise later. Zero user value, so do not spend review time on it before 1.0.

### CODE-BUILD-17 — jsdom 25.0.1 -> 31.0.1
- What: six majors (26.0.0 2025-01, 27 2025-09, 28 2026-02, 29 2026-03, 30 2026-07, 31 2026-11-05). jsdom 31 requires Node `^22.22.2 || ^24.15.0 || >=26` and depends on undici 8 (`npm view`). Changelog is not reachable from here (GitHub blocked, not in the npm tarball), so I cannot cite per-version breaks.
- Migration cost: unknown; the risk is concentrated in `src/test/setup.ts` (jsdom shims for `Range#getClientRects`, `scrollIntoView`, `scrollTo`) and the ProseMirror/Crepe tests (`repro.test.ts`, `wysiwyg-search.test.ts`); newer jsdoms implement more, which may make some shims redundant or change selection behavior. Our local Node is 22.23.5 (fine); CI Node version is unpinned (`setup-bun` only).
- Risk: medium for test stability; zero for the product.
- Recommendation: later; pin CI Node if/when done.

### CODE-BUILD-18 — jest-axe 10.0.0 -> 11.0.0 and @testing-library/jest-dom 6.9.1 -> 7.0.1
- What: jest-axe 11.0.0 ([CHANGELOG](https://raw.githubusercontent.com/NickColley/jest-axe/main/CHANGELOG.md), read 2026-11-18): axe-core 4.10.2 -> 4.12.1 and Jest 30 matcher utils (drops Node 16); the unreleased next major requires Node 22 and removes chalk. Used in 3 test files. jest-dom 7.0.1: engines `node >=22`, peers `vitest >=0.32` and `@testing-library/dom >=10 <11`; no changelog reachable (release notes live on GitHub only), so unverified. `@types/jest-axe` stays at 3.5.9 (latest).
- Migration cost: bump both; newer axe-core may report new violations in the 3 jest-axe tests (a feature: it tightens the a11y gate, but Wave 2 already built the a11y suite and the owner chose no axe-core in e2e).
- Risk: low; test-only.
- Recommendation: later together with vitest/jsdom (BUILD-17, 20); jest-axe alone could go now if you want a newer axe ruleset before 1.0.

### CODE-BUILD-19 — @types/node 22.20.5 -> 26.6.6
- What: types for Node 26. We run Node 22 (local 22.23.5; `tsconfig.node.json`/`tsconfig.e2e.json` use `types: ["node"]`, the app project does not). Types should match the runtime, not the latest.
- Migration cost: none other than possible new type errors in `vite.config.ts`/`e2e` if APIs differ.
- Risk: types that describe Node APIs the runtime lacks; vitest 5 peers `@types/node ^22 || >=24`.
- Recommendation: never beyond the Node major used in CI/dev (stay on 22.x until Node is bumped). Opinion; no source.

### CODE-BUILD-20 — typescript 6.0.3 -> 7.0.2
- What: 7.x is the native compiler line. `typescript-eslint` 8.73 (latest) peers `typescript >=4.8.4 <6.1.0` (`npm view`), so type-checked lint (`recommendedTypeChecked`, `projectService`) cannot run on 7.0.2. I did not run `tsc` 7 (no release notes reachable; the TypeScript blog is outside the reachable list).
- Migration cost: blocked by the lint toolchain, not by our code (`tsc -b` config is plain strict/bundler).
- Risk: high for the lint gate.
- Recommendation: later; wait for a typescript-eslint release that declares TS 7 support.

### CODE-BUILD-21 — vitest 4.1.7 -> 5.1.1
- What: [Migrating to Vitest 5.0](https://vitest.dev/guide/migration.html) (read 2026-11-18): needs Vite >= 6.4 (we have 8.3.8) and Node >= 22.12; `clearMocks` now defaults to true (mock history cleared before each test: 25 of our test files use `toHaveBeenCalledTimes`/`mock.calls`, setup-file and `beforeAll` call history is affected); unawaited async assertions now fail the test; class mocks keep prototype methods; `expect.poll` and `toThrow("")` stricter; fake timers mock `Temporal`; DOM-environment global assignments now update the underlying window (jsdom shims in `src/test/setup.ts` assign onto `Range`/`Element` prototypes, so recheck); config no longer looked up from parent directories; reports go to `.vitest/`.
- Migration cost: bump, run the 70+ test files, fix the clearMocks-sensitive ones (or set `clearMocks: false` to keep v4 behavior, 1 line); likely half a day, unmeasured.
- Risk: medium (test-only); no product benefit for 1.0. `vitest.config.ts` has no `projects`, so the inline-project changes do not apply.
- Recommendation: later, as one test-tooling PR with jsdom and jest-dom (BUILD-17, 18).

## Later (not 1.0)
- Move the editor behind `React.lazy` once startup is measured on the packaged app (BUILD-07 B).
- KaTeX woff/ttf stripping plugin (BUILD-08).
- `[profile.release]` in `src-tauri/Cargo.toml` (none today; `lto`, `strip`, `codegen-units = 1` would shrink the binary): opinion, not measured, belongs to the Rust auditor.
- Edition 2021 to 2024 (toolchain is 1.97).
