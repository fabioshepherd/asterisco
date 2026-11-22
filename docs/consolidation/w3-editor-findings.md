# Wave 3 — Editor findings (`src/editor`)

> **Historical record** of the 1.0 consolidation (November 2026), closed on
> 2026-11-19. It was written in the project's previous repository, now kept as a
> private archive: commit hashes, PR numbers, branch names, `file:line`
> references and scripts cited here refer to that tree and may no longer exist.
> The current state is in [`docs/ROADMAP.md`](../ROADMAP.md) and
> [`CHANGELOG.md`](../../CHANGELOG.md).

Auditor: Milkdown/ProseMirror + CodeMirror 6. Tree: `consolidation/wave-3`. Installed: `@milkdown/*` 7.23.0 (latest on npm), `@codemirror/view` 6.43.15, `@codemirror/state` 6.7.6, `katex` 0.19.1, `mermaid` 11.17.2 (npm latest 12.3.0).
Evidence: throwaway vitest/jsdom probes and `bun build` bundles in the session scratchpad (`w3-editor/b/`), outside the repo. jsdom timings show ratios, not WebView numbers.
Docs read 2026-11-18: https://milkdown.dev/docs/api/crepe, https://milkdown.dev/docs/guide/using-crepe, https://milkdown.dev/docs/api/core, https://codemirror.net/examples/tab/. Where the docs and the installed code disagree, the installed 7.23.0 source decides: the `renderPreview` docs still show the old two-argument signature, while `@milkdown/components/lib/code-block/config.d.ts` takes `applyPreview` and returns `void | null | string | HTMLElement`.

### CODE-EDITOR-01 — Standalone `<br>` lines are deleted on the next save — **required**
- What / Where: `CrepeEditor.tsx:350-352` + `preserve-empty-line.ts:18`. `remarkPreserveEmptyLinePlugin` is removed *after* `create()`, so the doc was already parsed with it: `<br>`, `<br/>` and `<br />` paragraphs become empty paragraphs, and once the plugin is gone the serializer writes them as blank lines. Probe: `a\n\n<br>\n\nc\n\n<br/>\n\nb` → baseline `…<br />…` (so the doc looks clean), but after the removal it serializes as `a\n\n\n\nc\n\n\n\nb`. The first edit and save therefore delete them from the file. READMEs use `<br>` for spacing.
- Why: PRODUCT §"anything the app writes to a file must survive a `git diff`"; CLAUDE "what the app did not write, it must not destroy" (frontmatter.ts rationale).
- Cost/benefit: −1 file (19 LOC), −1 effect. Call `void crepe.editor.remove(remarkPreserveEmptyLinePlugin)` before `create()`, next to the `indentPlugin` removal (`CrepeEditor.tsx:286`). Probe: no warning, `<br>` and `<br />` kept verbatim, and an empty paragraph still serializes as a blank line, not `<br />`.
- Risk: low. Re-run `list-behavior.test.ts` and the e2e transient-list-item case. Files saved since the feature landed may already have lost lines (no remedy).
- Recommendation: **fix**

### CODE-EDITOR-02 — Every `-` bullet is rewritten to `*` on save — **required**
- What / Where: no `remarkStringifyOptionsCtx` config anywhere in `src`. remark-stringify defaults to `bullet: "*"`, so editing one word in a `-`-bulleted README or CHANGELOG rewrites every list line. The probe also showed setext → ATX headings and `1)` → `1.`. Emphasis markers and `***` survive.
- Why: PRODUCT "survive a `git diff`" and the "Open and see / fidelity" principle. Milkdown exposes `remarkStringifyOptionsCtx` (https://milkdown.dev/docs/api/core, read 2026-11-18).
- Cost/benefit: 1 config line, `ctx.update(remarkStringifyOptionsCtx, (p) => ({ ...p, bullet: "-" }))`. Probe: `- one / - two / - nested` round-trips byte-exact. Removes the largest source of diff noise.
- Risk: a file written with `*` gets `-` after an edit (the same problem, but on the rarer marker). `-` is the Keep a Changelog/GitHub convention (opinion). Only `list-behavior.test.ts` and a comment in `preserve-empty-line.ts` mention `* `.
- Options: **A (rec.)** `bullet: "-"` · B detect the dominant marker per file at load (more code, a Later item) · C keep.
- Recommendation: **fix**

### CODE-EDITOR-03 — Selection word count reads the previous state — **required**
- What / Where: `CrepeEditor.tsx:328-337`. `selectionUpdated` runs inside the listener plugin's state `apply` (`@milkdown/plugin-listener` lib `apply:`), before the view takes the new state. The handler reads `viewFromCtx(ctx).state.selection`, which is the *old* selection. Probe: dispatching a 1→6 selection on "hello world" reported `view=""` while the listener's own argument was `"hello"`. A double-click word selection shows no count, and drags lag by one step.
- Why: correctness of an existing status-bar feature.
- Cost/benefit: ~−4 LOC. Use the arguments: `(_, selection) => selection.empty ? clear() : setText(selection.$from.doc.textBetween(selection.from, selection.to, " ", " "))`. This also drops the "view not mounted" guard, because the doc comes from the selection.
- Risk: none. Add a unit test with a dispatched selection.
- Recommendation: **fix**

### CODE-EDITOR-04 — W2-KL-1 (caret jumps to the start of a new list item): app-side mitigation exists
- What / Where: `@milkdown/components` `list-item-block` `scheduleRestore` replays a raw selection captured at node-view mount, one frame later. Probe on 7.23.0: Enter + "B" in the same tick, then "eta" → `* etaB`.
- Mitigation without patching the dependency (prototype verified: `* Beta`): (1) a `$prose` plugin whose `filterTransaction` rejects a selection-only transaction whose anchor/head equal a capture *and* whose `state.doc` is no longer the captured doc; (2) wrap the list-item node view through `nodeViewCtx`, the same pattern as `image-block-alt.ts:476`, to record `{doc, anchor, head}` at construction and drop the record after two frames. The restore is a no-op when nothing was typed, so only the stale case is blocked. ~35 LOC + 1 unit test. Keep the records per view (WeakMap), not in a module global.
- Options: **A (rec.)** the guard above, which lets `core.spec.ts:289`'s two-frame wait go · B disable `Crepe.Feature.ListItem`. This also removes one Vue app per list item: mounting 1,000 items took ~1.9–2.2 s with it vs ~0.25 s without, in jsdom. You lose Crepe's bullet/number labels and pointer-only task-checkbox toggle (needs CSS and a toggle path; visual change) · C keep as a known limitation (owner's W2 decision).
- Risk: A is a filter on a single upstream behaviour, so re-check it on a Milkdown upgrade, as KL-1 already says. This is not a dependency patch.
- Recommendation: **fix (A)**. It is required if text corruption counts as correctness for 1.0, which is the owner's call.

### CODE-EDITOR-05 — Mermaid preview disappears and re-renders on every keystroke
- What / Where: `mermaid.ts:335-348` returns `null`. In the code-block view (`@milkdown/components/lib/code-block/index.js` ~l.494-510), `null` sets `preview = null`, which hides the panel. `undefined` is the async contract: it keeps the previous preview and shows `previewLoading` only the first time. Each edit inside a ```` ```mermaid ```` block hides the diagram, then re-inserts it after `mermaid.render`, so the layout jumps on every keystroke.
- Why: installed `CodeBlockConfig.renderPreview` type and implementation (7.23.0).
- Cost/benefit: 1 line (`return undefined`, with the type `void`). Mermaid queues renders internally, so results arrive in order. An optional debounce goes to Later.
- Risk: the empty-content case should still return `null` (keep the early return).
- Recommendation: **fix**

### CODE-EDITOR-06 — Leaving Source mode always replaces the whole WYSIWYG doc
- What / Where: `SourceEditor.tsx:254-259` runs `replaceAll(edited)` even when nothing changed. Probe: an unchanged `replaceAll` adds an undo step (depth 0→1) and moves the caret to the end of the doc (12 → 19). So Edit → Source → Edit with no edits makes the first Ctrl+Z appear to do nothing and loses the caret.
- Why: opinion (the same no-op rule `setMarkdown` already follows).
- Cost/benefit: +1 condition, `if (edited !== editor.getMarkdown())`.
- Risk: none. It skips work in the common case.
- Recommendation: **fix**

### CODE-EDITOR-07 — `crepe-control-labels` re-queries the whole editor on every DOM batch
- What / Where: `crepe-control-labels.ts:79-83`. A subtree `childList` observer on the editor root runs `labelCrepeControls` on every mutation batch: Enter, new text nodes, mark changes, decorations, node-view re-renders. That is 14 `querySelectorAll` scans over the full document each time. The write-on-change guard prevents feedback loops but not the scans.
- Why: typing-path cost grows with document size (opinion, not measured in a WebView).
- Cost/benefit: ~+6 LOC. Skip records with no added `Element`, and for added elements run `labelCrepeControls(el)` only when `el.matches(SEL) || el.querySelector(SEL)`. Keystrokes in a paragraph then do no work.
- Risk: low. A control that Crepe re-renders by *attribute* only would not be relabelled, so check with the existing `crepe-control-labels.test.ts` plus an e2e table/link-tooltip pass.
- Recommendation: **simplify**

### CODE-EDITOR-08 — KaTeX "shipped twice": the runtime cost is already minimal, so keep
- What / Where: the initial 83 KB gz comes from Crepe's Latex feature, which imports `katex` statically (`@milkdown/crepe/lib/esm/feature/latex/index.js:2`, and also the monolithic `index.js:30`). It cannot be lazy-loaded without replacing the feature. Mermaid's copy (0.16.47) is a *dynamic* `import("katex")` (`mermaid/dist/chunks/mermaid.core/chunk-DU6HZSFF.mjs`), fetched only when a diagram contains math. It is disk bytes, not load cost. Mermaid 12.3.0 still wants `katex ^0.18`, so upgrading does not dedupe.
- Cost/benefit: measured with `bun build --minify`. Dropping the Latex feature saves 84 KB gz initial, but math then stops rendering and `$…$` round-trip changes, so it is not an option. A forced `overrides: { katex: 0.19.1 }` for mermaid saves 77 KB of lazy disk bytes against an untested major range.
- Risk: none if kept.
- Options: **A (rec.)** keep both · B override (not worth it) · C a custom lazy Latex feature (new code, no).
- Recommendation: **keep**. Correct the Wave 1 framing. KaTeX fonts (59 files, ttf+woff+woff2, pulled in via `crepe/theme/common/latex.css`) are a build-auditor item.

### CODE-EDITOR-09 — `CrepeBuilder` would trim 12.9 KB gz of disabled features
- What / Where: `CrepeEditor.tsx:1-2`. `new Crepe()` imports the monolithic entry, which carries the AI feature (+ `plugin-diff`, `plugin-streaming`, `component/diff`, `prosemirror-changeset`), TopBar and `oneDark`, all disabled or replaced here. `setCodeMirrorTheme` comes from a second entry (`feature/code-mirror`), which the docs warn are "bundled separately", so that code is in the bundle twice.
- Why: "useful when you want to reduce bundle size by only including the features you need" (https://milkdown.dev/docs/api/crepe §Using CrepeBuilder, read 2026-11-18).
- Cost/benefit: measured with the same 10 features: `Crepe` 381.9 KB gz vs `CrepeBuilder` 369.0 KB gz (−12.9 KB, ~1.5% of the 859 KB initial). Cost: ~+20 LOC (explicit `addFeature` list in Crepe's order, Latex after CodeMirror, and the `languages` from `@codemirror/language-data` that Crepe used to pass).
- Risk: feature order and defaults must match Crepe's. Needs a visual pass.
- Recommendation: **Later** (simplify after 1.0; not worth the risk now)

### CODE-EDITOR-10 — `repro.test.ts` is a leftover debugging test
- What / Where: `src/editor/repro.test.ts`, "repro: trailing paragraph dropped", with `console.log` dumps and lorem text. It asserts round-trip of a trailing paragraph. That is worth keeping as an assertion, but not as a "repro" file with logs.
- Cost/benefit: −43 LOC, quieter test output.
- Risk: if the regression is not covered elsewhere, move the two `expect`s into `list-behavior.test.ts` or an existing round-trip test, without the logs.
- Recommendation: **cut**

### CODE-EDITOR-11 — Small duplications and stale notes
- What / Where: `isRawTextContext` is defined twice (`auto-pairing.ts:137`, `footnotes.ts:233`). The link regex is in two places (`link-input-rule.ts:14`, `auto-pairing.ts:185`). `footnoteView` (`footnotes.ts:151`) duplicates `viewFromCtx`, and only tests use it. `docNeedsDefinition` is a one-line wrapper. The `runInsertFootnote` guard (`footnotes.ts:534-536`) duplicates `runFormatCommand`'s. `findDecoKey`, `footnoteInteractionKey`, `setFindMatches` and `FRONTMATTER_NODE` are exported but never imported. A stale comment, "plugin-listener 7.21.1" (`CrepeEditor.tsx:315`), should read 7.23.
- Cost/benefit: ~−30 LOC. Each item is mechanical.
- Risk: none (tests update their imports).
- Recommendation: **simplify**

### CODE-EDITOR-12 — Typing-path and plugin inventory (no action)
- What: WYSIWYG keystroke work, besides 07: Milkdown's listener re-serializes the whole doc once per 200 ms debounce. Footnote decorations rebuild with a full `doc.descendants` walk per doc change (`footnotes.ts:135`), sub-millisecond at README size (opinion). The find decorations are just `map`. Each image block has its own scoped observer (fine). Source mode does `doc.toString()` plus a store write on every keystroke (`SourceEditor.tsx:203`), which drives the regex word count and outline. That is linear but cheap, and it keeps `flushActiveEditor` simple. App plugins on top of Crepe's 10 features: 12 (frontmatter ×2, 2 input rules, footnote completion/deco/interaction, auto-pairing, find deco, image alt ×2, link/footnote keymaps) + 2 config tweaks. Each one is documented and tested.
- Recommendation: **keep**. Optional: short-circuit the footnote rebuild when neither the old nor the new doc has footnotes (Later).

### CODE-EDITOR-13 — Live language switch leaves editor strings stale until remount
- What / Where: `CrepeEditor.tsx:120-341`. `useEditor(…, [])` captures `t()` once, and `use-startup.ts:202` switches the language live. The slash menu, toolbar, placeholder, control labels, front-matter summary and footnote widgets keep the old language until the tab remounts.
- Cost/benefit: remounting on a language change costs undo history. Not worth it for a rare action.
- Recommendation: **keep** (note it in the settings hint or Later)

### CODE-EDITOR-14 — Direct `codemirror` meta-package dependency is unused
- What / Where: `package.json:54` `"codemirror": "^6.0.2"`. No import in `src`. It comes in only transitively through Crepe's `basicSetup`.
- Cost/benefit: −1 direct dependency line. The lockfile keeps it via Crepe.
- Recommendation: **cut** (cross-ref the build/deps auditor)

## Later
- Per-file bullet-marker detection (02 B). A debounced Mermaid render. Re-render open diagrams on a theme switch. `CrepeBuilder` (09). Footnote-deco short-circuit. Crepe code blocks load the full `basicSetup` per block (autocomplete, fold, lint gutters), which only the builder or upstream can trim.
