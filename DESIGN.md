---
name: Asterisco
description: A native, local-first Markdown editor for the files a codebase is made of.
colors:
  page: "#fcfcfc"
  surface: "#f9f9f9"
  muted-surface: "#f0f0f0"
  border: "#d9d9d9"
  ink-secondary: "#646464"
  ink: "#202020"
  signal: "#f76b15"
  signal-solid: "#cc4e00"
  ring: "#cc4e00"
  selection: "#ffdfb5"
  danger: "#e5484d"
typography:
  display:
    fontFamily: "Source Serif 4 Variable, Georgia, serif"
    fontSize: "2em"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Source Serif 4 Variable, Georgia, serif"
    fontSize: "1.5em"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Source Serif 4 Variable, Georgia, serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: "normal"
  ui:
    fontFamily: "Source Sans 3 Variable, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Source Sans 3 Variable, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    letterSpacing: "normal"
  data:
    fontFamily: "Source Code Pro Variable, ui-monospace, Menlo, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    letterSpacing: "normal"
  mono:
    fontFamily: "Source Code Pro Variable, ui-monospace, Menlo, monospace"
    fontSize: "0.875em"
    fontWeight: 400
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.signal-solid}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    typography: "{typography.ui}"
    height: "36px"
  button-outline:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
---

# Design System: Asterisco

## 1. Overview

**Creative North Star: "The manual, well set."**

Not a book, not a terminal: a well-composed technical manual. The lineage is documentation printing — one ink, one signal colour, a strict grid, hairline rules, and type chosen so prose, chrome and code speak with one voice instead of three. The user is a developer who opened this window for forty seconds to fix a line in a README, twenty times a day, on a bright monitor, next to a dark IDE. Everything here serves that: read it instantly, trust what you see, get out.

This is a *product* system in service of documentation, not a brand surface that performs. The bar is **earned familiarity**, and the tool disappears into the task.

The system runs on three live, independent axes — light/dark, a selectable **accent** (default **Orange**), and a selectable **neutral** base (default **Gray**, true chroma-0) — all built on official **Radix Colors** scales. **Light and dark are equally canonical**: the app follows the OS preference, and neither mode is *the* portrait of the product. The tokens documented here hold in every axis combination.

The system rejects two aesthetics at once, and the second rejection is the harder one. It is not the dev-tool register (dark-by-default, mono everywhere, terminal cosplay). It is also not the warm-paper editorial register (cream backgrounds, literary serifs, "the quiet page") that a Markdown editor reaches for the moment it decides not to look like a dev tool. Both are reflexes. What is left is the manual: neutral, exact, quietly confident, with colour reserved for signal.

**Key Characteristics:**
- **True neutral, chroma 0** (`#fcfcfc` light, `#111111` dark) — neither warm paper nor cool terminal. The neutral takes no side.
- **One superfamily, three cuts** — Source Serif 4 for prose, Source Sans 3 for chrome, Source Code Pro for code and machine data.
- **One signal** (Orange), scarce. At rest the app is grey, ink, and the colours of *your content* — syntax highlighting, diagrams, images.
- **Flat, hairline, tight** — 4/6/8px radii; depth is a tonal step and a 1px rule, never a shadow.
- **Every colour pair measured, not inherited** — the numbers are in this document and pinned by a test.
- **Motion 120–220ms** (the app mark is the one, documented exception), nothing on the typing path, and no entrance choreography at launch. Opening fast is a feature; watching it open is not.

## 2. Colors

A chroma-0 grey foundation carrying one orange signal. Colour is scarce and load-bearing: at rest a screen shows no accent at all unless something is selected, focused, active, or wrong.

### Primary
- **Signal** (`#f76b15`, Radix `orange-9`): the pure signal step. Accent borders, tints and graphics that sit beside their own label. **Never behind small text** — see the measured-fill rule.
- **Signal solid** (`#cc4e00`, Radix `orange-11`): the fill that carries text — primary buttons, active rows, the focus ring — and the state indicators that must be seen on their own (unsaved dot, selected-tab underline, success icon). In dark mode the same role resolves to `#ffa057` and the text on it flips to page ink.

Orange is the default of a user-selectable set (Tomato, Gold, Bronze, Jade, Grass, Teal, Blue, Indigo, Plum, plus monochrome). The role is identical whichever the user picks; only the hue moves.

### Neutral
The Gray ramp is the whole stage — Radix Gray is a true neutral (chroma 0), chosen deliberately over warm Sand and cool Slate so the surface takes no side. Lightest to darkest, light mode:
- **Page** (`#fcfcfc`, `gray-1`) — the app background. Dark: `#111111`.
- **Surface** (`#f9f9f9`, `gray-2`) — raised chrome: title bar, side panels, toolbars. Dark: `#191919`.
- **Muted surface** (`#f0f0f0`, `gray-3`) — component and hover fill. Dark: `#222222`.
- **Border** (`#d9d9d9`, `gray-6`) — hairline rules and separators. Dark: `#3a3a3a`.
- **Ink secondary** (`#646464`, `gray-11`) — secondary text, labels, machine data. Dark: `#b4b4b4`.
- **Ink** (`#202020`, `gray-12`) — primary text. Dark: `#eeeeee`.

### Functional
- **Danger** (`#e5484d`, Radix `red-9`): destructive actions and error states only — fixed, does not follow the accent axis. Error *copy* uses `--danger-text` (`red-11`), 5.08:1 on the page; `red-9` as text is 3.9:1 and is for fills and borders only.
- **Selection** (`#ffdfb5`, `orange-4`): text-selection background, a soft tint of the live accent.
- **Ring** (`#cc4e00`, `orange-11`): focus ring, always 2px with a 2px offset.
- **Syntax** (`--syntax-keyword` · `--syntax-string` · `--syntax-literal` · `--syntax-type` → `plum-11` · `grass-11` · `indigo-11` · `gold-11`): code colours in code blocks and Source mode — content, not signal. Comments and markup use `--muted-fg`; each pair is measured ≥4.5:1 by the contrast test.

The signal must stay distinguishable from danger: an accent adjacent to red (Tomato) is available to the user but is never the default, because "primary action" and "destructive" must not read as the same colour out of the box.

### Named Rules

**The Signal Rule.** Exactly one chromatic accent is live at a time, and it appears only where something is *signalled*: primary action, current selection, focus, live state, error. Never decoration, never a fill behind neutral content. At rest the only colours on screen belong to the user's content — code syntax, diagrams, images. If a screen reads as "orange", the signal has leaked; pull it back.

**The Measured-Fill Rule.** Solid fills that carry text use **step 11**, and the text on them is the opposite neutral extreme: white in light mode, page ink in dark mode. Measured across the whole curated accent set: 4.51:1 → 6.01:1 in light, ~9:1 in dark — all above the WCAG AA 4.5:1 floor. **Step 9 is not a text background:** white on `accent-9` lands between 2.97:1 and 3.91:1 on every accent except the two darkest scales (Indigo 5.21:1, Plum 4.75:1). One uniform rule beats a per-scale exception list, so nothing fills with step 9; it stays for graphics, tints and accent borders. The same holds for non-text: step 9 against the light page or surface measures 2.82:1 (Orange) → 2.99:1 (Jade) on four accents, under the 3:1 floor (SC 1.4.11), so state indicators draw in step 11 too. Orange has the thinnest margin in the set (4.51:1); if it moves, the test fails.

**The Ring Rule.** The focus ring is **step 11**, never step 8. Radix documents step 8 as the focus-ring step, but measured against the page it is 2.29:1 in light — below the 3:1 floor WCAG 2.2 sets for non-text contrast. Step 11 measures 4.41:1 → 5.90:1 in light and 8.72:1 → 10.15:1 in dark.

**The Hover-Toward-Ink Rule.** Hover on a solid fill mixes toward `--fg`, never toward `--bg`. Lightening a fill toward the page destroys the contrast the fill was chosen for; mixing toward ink raises it in light mode and — because `--fg` flips in dark mode — raises it there too. One direction, correct in both modes.

**The Chroma-Zero Rule.** The default neutral is a true grey. Do not tint it warm to feel friendly or cool to feel technical; both are category reflexes, and the user already owns the temperature axis (Sand, Slate, and the rest are one click away). Warmth in this product comes from the reading type and from the content, never from the background.

## 3. Typography

**Reading font:** Source Serif 4 Variable (with Georgia, serif) — weight and **optical-size** axes
**Chrome font:** Source Sans 3 Variable (with system-ui, sans-serif)
**Code & data font:** Source Code Pro Variable (with ui-monospace, Menlo)

**Character:** one superfamily in three cuts, not three unrelated faces. The cuts share proportions, rhythm and vertical metrics, so a heading, a menu label and a code span sit on the same page without arguing — which is exactly this product's claim that prose and code belong in one document. Source Serif 4 carries a true optical-size axis, so display sizes tighten and small sizes open up on their own, and a true italic (markdown emphasis is *drawn*, never browser-synthesised). All faces are self-hosted variable fonts (latin + latin-ext, OFL-1.1), no CDN.

### Hierarchy
- **Display** (Source Serif 4 700, `2em`, line-height 1.2, `-0.01em`): the document H1 — the title of the file being edited.
- **Headline** (Source Serif 4 600, `1.5em`, line-height 1.3): document H2–H6. Weight steps down the hierarchy; size carries the rest.
- **Body** (Source Serif 4 400, `16px`, line-height 1.7): the reading surface, on a capped measure.
- **UI** (Source Sans 3 400, `0.875rem`/14px, line-height 1.5): app chrome — menus, toolbars, dialogs, settings, buttons. Medium (500) for buttons and emphasis.
- **Label** (Source Sans 3 500, `0.75rem`/12px): small chrome labels and captions. **Sentence case** — never ALL CAPS, never tracked-out eyebrows.
- **Data** (Source Code Pro 400, `0.75rem`/12px): machine truth — file paths, word and character counts, byte sizes, timestamps, keyboard shortcuts, line and column.
- **Mono** (Source Code Pro 400, `0.875em`): code blocks, inline code, source mode. Coding ligatures disabled (`font-variant-ligatures: none`).

### Named Rules

**The One-Voice Rule.** Three cuts of one superfamily, each with a job: Source Serif 4 owns the reading surface, Source Sans 3 owns the chrome, Source Code Pro owns code and data. Never mix cuts within a job, and never let the reading serif leak into a UI label or a button.

**The Machine-Data Rule.** Anything the machine knows and the human only reads — paths, counts, sizes, timestamps, shortcuts, cursor position — is set in mono at label size. Anything a human wrote is set in serif; anything the app says to a human is set in sans. A word count in sans is a bug: it makes an exact number look like an opinion.

**The 66ch Rule.** The reading column is capped at ~`66ch` (user-tunable 50–90ch) and centred; prose never runs full-bleed. Edit, reading and source views share this one measure in characters (Source mode's `ch` resolves in the mono face, so its pixel column is wider).

## 4. Elevation

**Flat by default.** Surfaces are flat at rest. Depth is built from tonal layering (page → surface → muted surface) and 1px hairline rules, not from shadows. A single soft shadow exists, reserved for elements that genuinely float above the page.

### Shadow Vocabulary
- **Floating** (`box-shadow: 0 1px 2px rgb(0 0 0 / 0.04), 0 8px 24px -4px rgb(0 0 0 / 0.1)`): the *only* shadow. Menus, dialogs, popovers, the command palette, toasts. Never on a static panel or a resting card.

### Named Rules

**The Flat-By-Default Rule.** If an element is not literally floating over other content, it gets no shadow. Resting hierarchy is the grey ladder and hairline rules. A shadow on a static panel is a bug.

**The Rule-Not-Box Rule.** Prefer a single 1px rule to a full box. A manual separates sections with a line, not with a card around each one. Cards are the lazy answer; nested cards are always wrong.

## 5. Components

Component character: **instrument-like.** Tight corners (4/6/8px), hairline borders, flat surfaces, one solid signal fill on the single primary action, and a small confident press on interaction. Nothing bounces; nothing glows.

### Buttons
- **Shape:** `6px` (`rounded-md`); small/large variants keep the same radius. A tighter corner than the old chrome reads as precise, not bubbly.
- **Primary:** solid signal-solid fill (`#cc4e00` light / `#ffa057` dark), text at the opposite neutral extreme (white / page ink), `36px` tall, `8px 16px`, Source Sans 3 medium.
- **Outline:** page background, 1px border, ink text; hover fills to muted surface.
- **Ghost:** transparent; hover fills to muted surface.
- **Danger:** solid red, white text — destructive actions only.
- **Hover:** solid fills mix ~12% toward `--fg`, never toward `--bg`; outline/ghost gain a muted-surface fill. Transition `color, background, border, transform` at `120ms` `ease-snappy`.
- **Active:** `scale(0.98)` — the quiet press.
- **Focus-visible:** `2px` ring in `--ring` (`accent-11`) at `2px` offset.
- **Disabled:** `opacity: 0.5`, pointer events off.

### Menus & Floating Surfaces
Built on Radix primitives (menubar, dialog) and `cmdk` (command palette). Surface background, hairline border, `rounded-md`/`lg`, and the single floating shadow. Selected/hover row uses muted surface; the active item may carry the signal. Keyboard-navigable with always-visible focus.

### Panels & Containers
Not a decorated card — a quiet region. Surface background, a 1px rule or a tonal step against the page, generous internal padding (16px+), no shadow at rest. Nesting climbs one grey step; it never stacks shadows.

### The Side Sheet (docked panel)
Settings and other long-lived panels dock as a column of the window — right edge, `384px`, surface background, a single hairline against the page and **no shadow**: it rests in the layout, it does not float over it. It is non-modal by construction (no scrim, no focus trap, nothing inert behind it), because a panel that changes how the document looks has to be used while the document is on screen. It opens and closes on the same `180ms` width animation as the sidebar it mirrors. Clicking outside never dismisses it, and Escape reaches it only while focus is inside it. Content inside sizes against the **sheet**, not the window: container queries (`@sm`, `@lg`), never viewport breakpoints.

### The Status Line (signature)
The one piece of chrome allowed to be dense. It carries machine truth — path, word count, save state, cursor position — set in mono at label size, separated by thin rules rather than boxes, with the signal appearing only on live state. It is the manual's running foot: always there, never in the way.

It reports **state that has to be seen, not every command that has to be reached**. Its left side answers one question — *what am I looking at* — with a single labelled segmented control (source · edit · reading, ordered raw → rendered). Commands with a home in the View menu, the command palette and a keybinding do not also earn a permanent button here, and a control the bar cannot report the state of (distraction-free hides the bar) never belongs in it at all.

### The Editor Reading Surface (signature)
The core component. Source Serif 4 body at `16px`/1.7 on the page, centred to a `66ch` measure, with the optical-size axis doing the work at heading sizes. Document headings use the serif weight hierarchy (H1 700, H2–H6 600). Code blocks, tables, frontmatter and diagrams are rendered with real care — they are what a developer's Markdown is *made of*, not an edge case. This surface is sacred: chrome, motion and accent colour stay off it.

### Global Focus & Selection
Every interactive element shows a `2px` solid ring at `2px` offset on `:focus-visible` (WCAG 2.2 AA; measured ≥4.41:1 in light, ≥8.72:1 in dark). Text selection paints the accent's step-4 tint.

### Motion
Snappy and quiet: `ease-snappy` `cubic-bezier(0.2, 0, 0, 1)`, durations `120ms` / `160ms` / `220ms`. Motion conveys state and feedback only. **Nothing animates at launch** — "open and see" means the first frame is the document, not an entrance. All motion collapses to instant under `prefers-reduced-motion: reduce`.

**The logo exception.** The app mark is the one documented exception to these bounds. It moves on springs, in four moments only:
- when the empty state returns after the last document closes (~`620ms`);
- when the About panel opens (~`920ms`);
- while an update check started from About is running: a `1600ms` breathing loop that stops by itself after `5s`;
- when that check settles (~`640ms`).

It never moves at cold launch, on the document surface or on the typing path, and it is instant under reduced motion (owner decision, 2026-11-20).

## 6. Do's and Don'ts

### Do:
- **Do** start every surface from the true-neutral page and build depth with the grey ladder and 1px rules.
- **Do** keep colour scarce — one signal, for action, selection, focus, live state and error only.
- **Do** measure any new colour pair against WCAG AA (4.5:1 text, 3:1 non-text) before shipping it; the numbers in §2 are pinned by a test.
- **Do** set machine data (paths, counts, sizes, shortcuts) in mono, human prose in serif, app chrome in sans.
- **Do** cap reading prose at ~66ch and centre it.
- **Do** give every interactive element default, hover, focus-visible, active and disabled — plus loading and error where they apply.
- **Do** write UI strings in sentence case, localised (it/en at parity) — never hardcoded, never ALL CAPS.
- **Do** keep motion at 120–220ms ease-out with a `prefers-reduced-motion` path, and keep it off the typing path entirely (the app mark is the one exception, §5).

### Don't:
- **Don't** put small text on `accent-9`, or use `accent-8` as a focus ring — both fail AA, whatever the scale looks like.
- **Don't** lighten a solid fill on hover; mix toward `--fg`.
- **Don't** tint the neutral warm or cool by default — chroma 0 is the decision, and the user owns the temperature axis.
- **Don't** reach for the terminal costume: no dark-by-default, no mono outside code and machine data, no green-on-black.
- **Don't** reach for the warm-paper editorial costume either: no cream backgrounds, no `--paper` tokens, no "quiet page" nostalgia.
- **Don't** use heavy gradients, glow, glassmorphism or strong shadows.
- **Don't** build SaaS-template UI — no hero-metric panels, no identical card grids, no tracked uppercase eyebrows.
- **Don't** add a shadow to anything that isn't literally floating, or a card where a 1px rule would do.
- **Don't** use a `border-left`/`border-right` colour stripe as an accent, or gradient-filled text.
- **Don't** hand-author hex or `font-family`; consume the semantic tokens (`--bg`, `--fg`, `--primary`, `--ring`, `--font-sans`/`--font-serif`/`--font-mono`) so every theme/accent/neutral combination stays correct.
