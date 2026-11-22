# Theming & color tokens

The app's palette is built entirely on **[Radix Colors](https://www.radix-ui.com/colors)** (`@radix-ui/colors`, MIT). Three independent axes:

- **Light / dark** — driven by a `data-theme` attribute on `<html>` plus a `.dark` class (the class is what makes Radix's dark scales resolve). Follows the OS scheme when the preference is `system`. Resolved in JS (`src/app/use-theme-sync.ts`) and pre-painted before React mounts (`public/theme-init.js`).
- **Accent** — a user-selectable color, chosen from a curated set of Radix scales, applied live via a `data-accent` attribute on `<html>`. Persisted in settings; default **Orange** (the signal colour).
- **Neutral** — a user-selectable Radix gray scale (the base/paper colour), applied live via a `data-neutral` attribute on `<html>`. Persisted in settings and pre-painted before React mounts; default **Gray** (true chroma-0).

Gray is the default neutral — temperature is the user's axis, not a default; **Sand** (warm) and **Slate** (cool) are also available.

## Layers

```
src/styles/accents.css   Radix scale @imports + accent role mapping  (data-accent blocks)
src/styles/neutrals.css  Radix gray @imports + neutral role mapping   (data-neutral blocks)
src/styles/global.css    @theme inline (→ Tailwind utilities) + fixed danger/layout tokens
src/features/themes/accents.ts   the accent registry + resolveAccent()
src/features/themes/neutrals.ts  the neutral registry + resolveNeutral()
```

### How a switch works (no reload)

1. User picks an accent in Settings → `useSettings.setAccent(accent)`.
2. The store mirrors it to `localStorage` (`asterisco.accent`) for the pre-paint bootstrap and persists it via tauri-plugin-store.
3. An effect in `App.tsx` sets `document.documentElement.dataset.accent`.
4. `accents.css` has one static block per accent (`[data-accent="grass"] { … }`) that re-points the accent-derived tokens to that scale.

Because each Radix scale ships separate light/dark variables (scoped to `:root` / `.dark`), `var(--grass-9)` already resolves per mode — so **one block per accent covers both light and dark**. Dark mode swaps scales, it does not invert colors.

No runtime contrast checks — but the mapping is **measured, not assumed**. Radix guarantees its own text steps against its own surface steps; it says nothing about white on a solid fill or a ring against the page, and both fail WCAG AA at the steps Radix nominally documents for them. So the app binds fills and rings to **step 11**, keeps **step 9** for signal-only use, and `src/styles/contrast.test.ts` pins every accent × neutral × mode combination (4.5:1 for text, 3:1 for non-text).

## Token role map (Radix convention)

| Semantic token | Source | Role |
|---|---|---|
| `--bg` | `<neutral>-1` | app background |
| `--fg` | `<neutral>-12` | primary text |
| `--surface` | `<neutral>-2` | raised surface (title bar, panels) |
| `--muted` | `<neutral>-3` | component / hover surface |
| `--muted-fg` | `<neutral>-11` | secondary text |
| `--border` | `<neutral>-6` | borders / separators |
| `--danger` | `red-9` | danger SIGNAL: icons, borders, tints (non-text) |
| `--danger-solid` / `--danger-text` | `red-11` | danger fill under text · error copy |
| `--danger-fg` | white | icon/text on a `red-9` surface (e.g. the window close button) |
| `--primary` | `<accent>-11` | solid fill that carries text, accent-coloured text, and state indicators (unsaved dot, selected-tab underline, success icon) |
| `--accent` | `<accent>-9` | the signal: accent borders, tints, graphics — under 3:1 on the light page for some accents, so not for indicators that stand alone |
| `--on-solid` → `--primary-fg` / `--accent-fg` | white (light) · `var(--bg)` (dark) | text on a solid fill |
| `--primary-hover` / `--danger-hover` | fill mixed 12% toward `--fg` | hover on a solid fill |
| `--ring` | `<accent>-11` | focus ring |
| `--selection` | `<accent>-4` | text selection background |
| `--syntax-keyword` · `--syntax-string` · `--syntax-literal` · `--syntax-type` | `plum-11` · `grass-11` · `indigo-11` · `gold-11` | code syntax colours (CodeMirror: code blocks + Source mode, `src/editor/code-theme.ts`); content, not signal; comments/markup use `--muted-fg` |

The monochrome `gray` accent points `--primary` / `--accent` / `--ring` at `--muted-fg`, so it follows whichever neutral is live instead of pinning one scale.

Components consume the **semantic tokens** (`bg-primary`, `text-fg`, `var(--accent)`, …), never the raw Radix scale variables — except the accent swatch in `AccentPicker.tsx`, which previews `var(--<scale>-9)` by design.

## Curated accents

`orange` (default — the signal colour), `jade`, `grass`, `teal`, `blue`, `indigo`, `plum`, `bronze`, `gold`, `tomato`, `gray` (monochrome — maps the accent tokens onto the live neutral). Labels are localized under the `editor` namespace, `accents.*`.

## Curated neutrals

`gray` (default — true neutral, chroma 0), `sand` (warm paper), `slate` (cool gray). Each maps 1:1 to the same-named Radix gray scale. Registry in `src/features/themes/neutrals.ts`; labels localized under `editor`, `neutrals.*`.

## Adding an accent

1. Confirm an official Radix scale exists. Map `--primary` and `--ring` to its **step 11** and `--accent` to step 9; `contrast.test.ts` will fail the build if the new scale misses 4.5:1 (fill) or 3:1 (ring) on any neutral in either mode.
2. `accents.css`: `@import` its light + dark files, add a `[data-accent="<id>"] { … }` block (copy an existing one).
3. `src/features/themes/accents.ts`: add the id to `ACCENTS`.
4. `AccentPicker.tsx`: add the swatch var to `SWATCH_VAR`.
5. i18n: add `accents.<id>` to `en/editor.json` and `it/editor.json` (the `resources.test.ts` parity test enforces both).

## Adding a neutral

Parallel to adding an accent: `neutrals.css` — `@import` the Radix gray scale's light + dark files and add a `[data-neutral="<id>"] { … }` block (copy an existing one); `src/features/themes/neutrals.ts` — add the id to `NEUTRALS`; then add `neutrals.<id>` to both locale `editor.json` files.

## Custom CSS themes

Power-user feature: the app manages a **themes folder** under the app-config dir
(`<app_config_dir>/themes/`, seeded with a commented `example.css`). Any `.css`
there is selectable in Settings → Appearance and is **hot-reloaded** — editing
the active theme on disk re-applies it live; adding/removing files updates the
picker. The chosen theme is stored by filename (`customThemeName`) and injected
(sanitized — no `@import`, no remote `url()`) into a single `<style>` element.
A dedicated Rust watcher (`commands/themes.rs`, separate from the document
watcher) emits `themes-dir-changed`. See `src/features/themes/themes-folder.ts`,
`use-themes-hot-reload.ts`, and `apply-theme.ts`.

The seeded `example.css` is a **hand-curated** sample (its hex values approximate
the default Gray/Orange palette; they are not generated from the Radix scales), so
if the semantic token set is ever renamed, update the template by hand so it
doesn't teach a dead token.

## Typography (fonts)

Three self-hosted **variable** typefaces, one per surface role. Fonts are theme-agnostic — they resolve through the same semantic tokens in both light and dark mode.

| Token (`global.css` `@theme`) | Family | Role | Variable axis |
|---|---|---|---|
| `--font-sans` | **Source Sans 3** | app **chrome** — sidebar, toolbar, menus, dialogs, settings, status bar | `wght` 200–900 |
| `--font-serif` | **Source Serif 4** | editor **reading body + document titles** | `wght` 200–900 + `opsz` 8–60 + true italic |
| `--font-mono` | **Source Code Pro** | **code** blocks, inline code, source mode, and machine data | `wght` 200–900 |

Three cuts of **one superfamily** (DESIGN.md, "The One-Voice Rule"): shared proportions and vertical metrics, so prose, chrome and code sit on the same page without arguing. The editor "Reading font" setting (`editorFontFamily`: `serif` / `sans`) picks the content area's body face; the default is `serif` → Source Serif 4. Mono is not offered: it stays for code and machine data.

### Where it lives

- `src/styles/fonts.css` — explicit `@font-face` per face, **latin + latin-ext** subsets only (enough for it/en accents), reusing the `@fontsource-variable/*` woff2. Chrome and code use the `wght` cut; the reading serif uses the **`standard`** cut, which carries `opsz` alongside `wght` (~70 KB more per file, paid once from disk) so headings tighten and small text opens up on their own. It also declares its **true italic** so markdown `*emphasis*` is never browser-synthesised. `unicode-range` keeps latin-ext lazy.
- `src/styles/global.css` — the `@theme` block maps the three families onto `--font-sans` / `--font-serif` / `--font-mono` (with system fallbacks). `body` uses `--font-sans`; the editor maps `--crepe-font-*` onto these in `editor-theme.css`.
- `src/styles/editor-theme.css` — reading rhythm: `--editor-font-size` (default 16px), `--editor-line-height` (1.7), and the reading **measure** `--editor-measure` in **ch** (default `66ch`, range 50–90ch via the `lineWidth` setting). Document headings use the serif weight hierarchy (h1 700, h2–h6 600, body 400). Code disables forced coding ligatures (`font-variant-ligatures: none`).

### Local-first / licensing

- No CDN, no `<link>`, no network requests: every `.woff2` is bundled by Vite and served from the local Tauri asset origin. The CSP `font-src 'self' data:` needs no external origin.
- Source Serif 4, Source Sans 3 and Source Code Pro are all **SIL Open Font License 1.1**. Their notices are captured automatically into `THIRD-PARTY-NOTICES` by `bun run notices` (generate-license-file reads the `@fontsource-variable/*` packages).

## Window chrome / title bar

The custom title bar (`src/app/chrome/`) uses two **layout** tokens defined in the `:root` block of `global.css` (these are sizes, not colours — colours still come from the semantic tokens):

| Token | Value | Role |
| --- | --- | --- |
| `--titlebar-height` | `2.25rem` | Row height of the macOS title strip (`MacTitleStrip`) and the Windows/Linux `TitleBar`. |
| `--titlebar-mac-inset` | `78px` | Left padding of the macOS strip, reserving space for the native traffic lights under `TitleBarStyle::Overlay`. |

Consumed via Tailwind arbitrary properties, e.g. `min-h-(--titlebar-height)` and `pl-(--titlebar-mac-inset)`. The title bar surface uses `bg-surface` + `border-border`; the window controls use `text-muted-fg` with `hover:text-fg`, and the close button turns `hover:bg-danger hover:text-danger-fg` — all existing semantic tokens, so they follow theme + accent automatically. No new colour tokens were introduced.
