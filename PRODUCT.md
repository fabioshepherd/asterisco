# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary:**

- **Developers who write their project's documentation** — README, ADRs, specs, changelogs, a `docs/` tree. They live in an IDE, but the IDE treats prose as raw text: no measure, no reading typography, no sense of how the page will actually be read.
- **Developers who write for AI agents** — `CLAUDE.md`, `AGENTS.md`, skills, prompts, task specs. These `.md` files change constantly and get re-read far more often than they get written. (This is *why the market exists*, not a product feature: the app treats them as ordinary Markdown, with no AI awareness and no network.)

**Secondary:** technical writers and docs engineers; people maintaining documentation sites (Docusaurus, Astro, MkDocs, VitePress) who edit the same `.md` the generator consumes; keyboard-first power users (command palette, slash commands, custom keybindings); long-form writers who want a calm page; privacy-conscious / anti-subscription users who want to *own* their files; refugees from Electron bloat; **Italian-first users** (first-class IT/EN UI, not an afterthought).

## Product Purpose

A **native, cross-platform, local-first** Markdown editor for the files a codebase is made of. It opens a `.md` and shows it **as it will be read** while you edit it: seamless inline WYSIWYG, one column, no split preview, no raw text. Plain `.md` on disk, no account, zero telemetry. Native shell (Tauri 2 / OS WebView), no bundled browser.

Markdown became the format software is documented in and the format we brief agents in. This is the dedicated tool for those files — **beside** the IDE, never a replacement for it. Scope runs from the single file to a documentation folder as one navigable, searchable body; it stops well short of a knowledge graph.

**Success =** a developer opens it for a README and leaves it open all day; their files stay plain `.md` on their own disk, forever. Model: free and open source (MIT) — no licence, no account, no upsell.

## Positioning

**Reading and editing `.md` are the same job, and reading is the larger half.** Markdown became the format the industry communicates in — documentation for humans, briefs for AI agents — so these files are opened to be *read* far more often than they are opened to be changed. The product is a support tool for developers and people in the industry to read or amend those files, and to keep documentation effortlessly readable while it is being written.

That is the claim a neighbouring product cannot truthfully copy without becoming a different product:

- A **split-preview editor** cannot make the reading state the default state; it renders the document beside the work instead of as the work.
- A **PKM / graph tool** answers a different question — relationships between notes, not the legibility of one file a codebase actually ships.
- An **IDE** owns the code and will not give prose a measure, reading typography, or a page.

The mechanism underneath is one object rather than two: editing surface and rendered page are literally the same thing, on plain `.md` the user owns, in a native shell that opens fast enough that reading a file here is cheaper than reading it in the IDE.

## Operating Context

Desktop, as a second window beside the IDE. Usually reached *from the file* (double-click, file association, "open with") rather than from the app. Short, frequent sessions — open, read, fix a line, close — interleaved with long drafting sessions. Local `.md` files; 100% offline.

- **Files in scope:** `.md`, `.markdown`, `.mdx`, `.txt` — a project's README, ADRs, specs, changelogs, a `docs/` tree, and the agent files (`CLAUDE.md`, `AGENTS.md`, skills, prompts) that sit in the same repo. `.mdx` is in because the documentation sites below are written in it; it is opened and edited as Markdown, and the JSX in it is left alone rather than understood.
- **Neighbouring tools:** the IDE (the app never competes with it), git (these files are versioned, so they are diffed and reviewed as text), and static-site generators (Docusaurus, Astro, MkDocs, VitePress) that consume the very same `.md`.
- **Consequence for design:** anything the app writes to a file must survive a `git diff` and a generator's parser. The file, not the app's state, is the artifact.
- **Platform reality:** desktop only. The `web` value above is the taxonomy's design-language axis — this is not a browser product. It runs as a Tauri 2 native shell on the OS WebView, and a tagged release builds all three desktop platforms — macOS (Apple Silicon and Intel), Windows and Linux. The macOS bundles are unsigned by decision, so Gatekeeper warns on first open until a certificate is configured.

## Capabilities and Constraints

**Development state (as of 2026-11-20):** Phase 2 — V1.0 done except the release gates (publishing from the public repository and a smoke test of a real release on each platform; the product name is decided). Phase 0 (scaffold) and Phase 1 (editing MVP) are done. Manifests read `0.5.1`; the 1.0.0 notes are drafted under `[Unreleased]` in `CHANGELOG.md`, and the version is bumped at release time. The release matrix builds macOS, Windows and Linux; macOS ships unsigned for now. See `docs/ROADMAP.md` (phase status and what remains for 1.0) and `ARCHITECTURE.md`.

**Working today:** WYSIWYG Markdown (Milkdown/Crepe) with full GFM, code blocks, tables and auto-pairing · math (KaTeX), Mermaid, collapsible YAML front matter · three views of the same column — source (CodeMirror 6), edit, reading — plus distraction-free · open / save / save-as / new, auto-save, external-change watcher, tabs with inline rename, recent files and folders · file-tree workspace scoped to the nearest project root, filterable and `.gitignore`-aware, outline panel, find & replace, workspace-wide search, command palette · export to HTML, print (save as PDF from the print dialog) and clipboard copy as HTML/Markdown · light / dark / system theming with accent colours and user custom CSS, reading typography, settings panel, customizable keybindings · images dragged or pasted into an `assets/` folder with relative links · i18n (it/en), native menu, persisted window state, in-app updater.

**Still pending for V1:** the release gates in `docs/ROADMAP.md` — the product name and a smoke test of a real release on each platform. Atomic file writes, the localized slash menu and link tooltip, the release matrix that builds every declared target, File and app shortcuts on Windows/Linux, and a Playwright suite (`e2e/`, run by `bun run test:e2e`: core flows plus a keyboard walkthrough) have landed; the suite has no expected failures. What was cut for 1.0 and what waits until after it are listed in `docs/ROADMAP.md`.

**Hard constraints:**

- All filesystem and native I/O goes through declared Rust commands (they accept any path the user's account can reach; restricting paths is planned after 1.0); Tauri 2 capabilities gate plugin and core permissions only, and the frontend is never granted direct filesystem access. Restrictive CSP in the WebView; HTML rendered from Markdown is sanitized.
- No network calls except the user-triggered update check. No telemetry, no account, no cloud service — ever, by default.
- Deletion goes to the system trash, never permanent. Unsaved changes always prompt.
- UI strings only via i18n at it/en parity; never hardcoded.
- Dependencies must be MIT-redistribution compatible; copyleft (GPL/AGPL) is excluded unless explicitly approved. The build generates and bundles `THIRD-PARTY-NOTICES`.

**Explicit non-goals:** not a PKM/graph tool (wiki-links and backlinks are Phase 4, optional); not a general code editor (CodeMirror serves source mode and code blocks only); no mandatory cloud or account; nothing that sends user content to a third party without explicit consent.

**Not shipped — do not describe as present:** AI assistant, real-time collaboration, wiki-link/backlink, third-party plugin system, mobile builds. All are Phase 4 "future / optional".

**Product name:** **Asterisco**, chosen by the owner and made final on 2026-11-20 (`docs/naming.md`). It is the same in Italian and English; technical names (binary, package, log file) use lowercase `asterisco`, and the app identifier is `it.fabiopastore.asterisco`. The repository is `fabioshepherd/asterisco`.

## Brand Commitments

- **Name:** Asterisco, in both languages (see the product name above).
- **Licence:** MIT, free and open source. No paid tier, no licence key, no upsell. Do not add per-file licence headers.
- **Bilingual by commitment:** Italian and English at parity, not English with a translation. `<html lang>` tracks the locale, including in HTML export.
- **Voice:** sentence case, plain, precise, bilingual — see Brand Personality below.
- **Integrity:** never overclaim shipped versus roadmap. This one is load-bearing, because the roadmap in `docs/ROADMAP.md` is far larger than what runs today.

## Brand Personality

**Quick, crafted, unceremonious.** It speaks in facts — "plain `.md` on your disk", "no account" — never in adjectives. Courteous but brisk: it respects the user's time because the user is in the middle of something else. Craft is visible in the result, never announced. Confident and honest: integrity is part of the brand (never overclaim shipped vs roadmap). Voice is sentence case, plain, precise, bilingual. Emotional goals: relief, trust, ownership, quiet delight.

## Anti-references

- **The side-by-side preview** — VS Code's two-pane Markdown mode and everything shaped like it: two columns showing the same thing twice, and a caret in the ugly one.
- **Terminal aesthetic as costume** — dark-by-default and mono everywhere as a way of signalling "this is for developers". It's a disguise, not a function; the audience is technical, the disguise is not required.
- **Electron bloat** — the heaviness / slow startup / high RAM of a VS-Code-as-text-editor. Startup time is a feature here, not a metric.
- **PKM / graph & subscription tools** — Notion/Obsidian complexity, backlink panels, graph views. A docs folder is a body of files, not a second brain.
- **SaaS-template UI inside the app** — hero-metric panels, identical card grids, tracked uppercase eyebrows.
- **Loud visual effects** — heavy gradients, glow, glassmorphism, strong shadows.
- **Gratuitous motion on the typing path** — nothing comes between keystroke and character.

## Evidence on Hand

What actually exists, so future work cites it instead of inventing it.

**Real:**

- The working software itself, run locally. The capability list above is read off the shipped build and `README.md`, not off the roadmap.
- The repository as a document set: `docs/ROADMAP.md` (phase status and remaining 1.0 work), `ARCHITECTURE.md`, `DESIGN.md`, `docs/THEMING.md`, `docs/RELEASING.md`, `CHANGELOG.md`, `PRIVACY.md`, `SECURITY.md`, `CONTRIBUTING.md`.
- A measured contrast guarantee: `src/styles/contrast.test.ts` pins the WCAG ratios claimed in `DESIGN.md`. This is the one quantitative claim the repo actually enforces.

**Absent — must not be fabricated:**

- **Nothing is released yet.** The source is public at `fabioshepherd/asterisco`, but no release binary has been published there yet (earlier test builds lived in the previous, private repository and were never distributed). Until 1.0 is published there is no download to point at and no install count.
- **No external users.** No one outside the author uses it. No testimonials, quotes, reviews, ratings, adoption numbers, or "trusted by" claims exist or may be implied.
- **No performance claims.** Cold start, idle RAM and large-file open times were long-standing targets that were never measured. By owner decision (2026-11-17) they are not measured for 1.0 and were dropped from all user-facing copy and docs instead; no speed or memory figure ships until a real measurement exists.
- **No press, case studies, or comparative benchmarks** against Typora, Obsidian, or any other editor.

## Product Principles

Durable strategic commitments, distinct from the visual ones below.

1. **The file is the product, the app is the lens.** Everything must survive uninstalling the app: plain `.md`, no proprietary format, no hidden state the content depends on. If a feature needs its own database to make sense, it is the wrong feature.
2. **Reading is a first-class use, not a mode.** The file is opened to be read more often than to be edited. Any decision that makes editing better at the cost of reading is backwards.
3. **Beside the IDE, never instead of it.** The product wins by doing one thing the IDE structurally cannot, and loses the moment it starts growing toward being an IDE.
4. **The network is a feature the user turns on, never a default.** No call leaves the device without an explicit user action. Anything that would change this is opt-in, isolated behind a flag, and consented to first.
5. **Claim only what runs.** The roadmap is much larger than the build; every user-facing statement describes the shipped app, and unverified numbers stay out of the copy.

## Design Principles

1. **Open and see** — from double-click to readable text, as little as possible happens. Launch speed, first paint, and fidelity of the first render are product features, not engineering metrics.
2. **One column, never two** — editing and rendering are the same object. A split preview is a design failure, not a convenience.
3. **Prose is the citizen, code is an honoured guest** — measure, typography, and focus serve the text; code blocks, tables, mermaid, and frontmatter are rendered with real seriousness, never as an afterthought.
4. **Local-first by construction** — no network unless user-triggered; privacy and file ownership are *felt*, not merely promised. No AI features, no telemetry, no account.
5. **Calm is the competitive advantage** — the quiet page is what the IDE cannot offer; it is a differentiator, not decoration. Chrome earns its pixels, and personalization (Radix three-axis, custom CSS) stays deep but restrained.

## Accessibility & Inclusion

**WCAG 2.2 AA** commitment: full keyboard navigation, always-visible focus, correct ARIA on custom UI, sufficient contrast in every theme/accent/neutral combination (guaranteed by the Radix scales), honoring `prefers-reduced-motion` and `prefers-color-scheme`. The keyboard-navigation gaps this brief used to list — the file tree, its context menu, workspace search — were closed and re-checked on 2026-08-17. An end-to-end audit followed in the 1.0 consolidation (2026-11-18): its findings were fixed, and a keyboard walkthrough of a real session runs in the end-to-end suite (`e2e/a11y.spec.ts`). An automated axe pass was rejected by the owner (2026-11-18). Bilingual **IT/EN** UI at parity; `<html lang>` tracks the locale (including in HTML export) for correct screen-reader pronunciation.
