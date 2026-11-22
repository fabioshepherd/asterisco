# Wave 2 — decisions

> **Historical record** of the 1.0 consolidation (November 2026), closed on
> 2026-11-19. It was written in the project's previous repository, now kept as a
> private archive: commit hashes, PR numbers, branch names, `file:line`
> references and scripts cited here refer to that tree and may no longer exist.
> The current state is in [`docs/ROADMAP.md`](../ROADMAP.md) and
> [`CHANGELOG.md`](../../CHANGELOG.md).

Sources: `w2-ui-findings.md` (design-system reviewer), `w2-a11y-findings.md` (accessibility reviewer). Full evidence, file:line and sources are in those files; each entry here is the decision record.
Owner decision 2026-11-18: no axe-core. `e2e/a11y.spec.ts` is built dependency-free (keyboard walkthrough, outline at the end of `w2-a11y-findings.md`).

## Required (fix; decided as "how" only)

### V1-05 — Source view crash with two documents open (UI-01)
- What: an editor unmounted mid-creation registered itself after cleanup; Source view called `getMarkdown()` on it. Pre-existing since the first public commit.
- Decision: done in Wave 1 PR (a22f26f, e2e `view switch with two documents open`)

### V1-06 — Design-system defects (UI-03, UI-05, UI-06, UI-07, UI-14, UI-15)
- What: `cn()` strips `text-data` (shortcuts/paths render in sans); active tree row is a solid accent bar → muted row; Crepe floating UI in serif / ALL CAPS / unlocalized "Hide"/"Edit" → sans, sentence case, i18n; Source-mode highlight colours 1.4–2.0:1 in dark → token `HighlightStyle`; token misuse sweep (danger text, shadow, z-index, kbd size, export fallback palette); reading/edit switch animates the whole document → no transition.
- Why: DESIGN §2–§5 rules quoted in `w2-ui-findings.md`; contrast is a PRODUCT accessibility commitment.
- Risk: low; Crepe class names are internal (visual check after Milkdown upgrades).
- Decision: approved (required)

### V1-07 — Accessibility defects A11Y-02 … A11Y-18 (WCAG 2.2 AA)
- What: the auditor's recommended fix for each (image alt rendered from `alt` + an "Alt text" field; focus return after palette/settings/dialogs/menubar; visible focus on menu/palette/search items; caret in `--fg`; editor accessible names, `aria-readonly`, focusable Reading panel; Crepe icon buttons named; tree focus ring on the row only; tab close not a tab stop, 24×24, "New tab" outside `tablist`; step-9 indicators ≥3:1 + test; reflow at 640px × 200%; shortcut-row names; search focus ring; static toggle names; notifications region reachable from the keyboard; `alertdialog`; caret readout visible text).
- Why: WCAG SCs cited per finding; CLAUDE.md accessibility section; ROADMAP `[V1]` accessibility audit.
- Risk: low each; Crepe node-view patches need a visual/e2e check.
- Decision: approved (required)

### V1-08 — `e2e/a11y.spec.ts` (no new dependency)
- What: keyboard-walkthrough spec per the outline in `w2-a11y-findings.md` (focus visible, roles/names via `getByRole`, focus return after dialogs, Tab leaves the editor).
- Decision: approved (required)

### A11Y-01 — Tab inside the WYSIWYG editor (blocker, SC 2.1.1 / 2.1.2)
- What: Crepe's indent plugin makes Tab insert spaces anywhere; forward Tab never leaves the editor; a walkthrough corrupted a heading.
- Options: **A (rec.)** remove the indent plugin: Tab nests/un-nests in lists and indents in code blocks, elsewhere it moves focus; Source mode keeps Esc → Tab (documented under Shortcuts) · B keep Tab = indent everywhere, add a documented escape (Esc then Tab, or Ctrl+M) and stop inserting spaces into headings/paragraphs.
- Risk: A changes what Tab does in a plain paragraph (no more spaces).
- Decision: approved (A: remove indent plugin; Tab moves focus outside lists/code) — owner 2026-11-18

## Owner decisions

### UI-02 — Code blocks rendered twice (editor + "Preview"), in two palettes
- What: show the preview only for Mermaid and LaTeX; one token-based CodeMirror theme for code; drop `@tanstack/highlight` (0.0.9) and `highlight.ts`.
- Why: PRODUCT anti-reference "the same thing twice"; DESIGN "every colour pair measured" (oneDark is not).
- Cost/benefit: −1 dep, −79 LOC, one code palette everywhere. Shares the theme with V1-06 (Source mode).
- Risk: reading view still shows highlighted code via CodeMirror (read-only).
- Decision: approved — owner 2026-11-18

### UI-04 — One text measure
- What: the "Line width" setting only drives edit mode; reading is hardcoded 66ch, source 50rem; the hint says the opposite.
- Options: **A (rec.)** one measure for all views, default 66ch, the setting drives it; remove the per-view overrides; DESIGN §3 drops "drafting is wider" · B two measures (reading = setting, edit = setting + 24ch) · C only fix the hint.
- Risk: A narrows edit mode for users on the default (90 → 66ch).
- Decision: approved (A) — owner 2026-11-18

### UI-08/09/10 — One segmented control, one dialog primitive, one icon button
- What: Settings selected options become a muted chip (no solid accent fills at rest); NameDialog/UnsavedPrompt/Notices/palette share one `Dialog` (scrim token, hairline, shadow); 32 hand-rolled icon buttons use `Button` ghost `icon-sm` (one press scale, one focus ring).
- Why: DESIGN §5 components; Signal Rule.
- Cost/benefit: fewer lines, consistent focus/press; no feature change.
- Risk: dialog focus-trap/Escape must stay identical (e2e covers the unsaved prompt).
- Decision: approved — owner 2026-11-18

### UI-11 — Theme presets
- What: five preset cards; one is named after the provisional product name, "Editorial" is the warm-paper look DESIGN rejects, two switch the body to sans; each only seeds settings shown right below.
- Options: **A (rec.)** cut presets (−256 LOC + tests + i18n; neutral/accent/font controls stay) · B keep: rename that one → "Default", drop "Editorial", rows not cards.
- Risk: A removes a surface kept in Wave 1; no persisted value.
- Decision: approved (A: cut presets) — owner 2026-11-18

### UI-12/13/16 — Chrome that hasn't earned its pixels
- What: remove the sidebar "show ignored folders" button (the Settings switch stays); hide view switch, word count, auto-save toggle and outline when no document is open; show the workspace name once (drop the duplicate root row).
- Why: PRODUCT principle 5.
- Risk: the root context menu actions stay reachable from the header buttons.
- Decision: approved — owner 2026-11-18

### UI-17 — Mono reading font
- What: drop "mono" from the reading-font choices (a stored `mono` becomes `serif`).
- Why: DESIGN §6 "no mono outside code and machine data"; PRODUCT anti-reference.
- Decision: approved — owner 2026-11-18

### UI-18/19/20 — Small visual calm-downs
- What: Mermaid light theme `neutral` instead of lavender `default`; the unsaved dot sits in the close-button slot (no tab-strip shift on the first keystroke); success toasts on a plain surface (the icon carries the state).
- Why: DESIGN Signal Rule; nothing between keystroke and character.
- Decision: approved — owner 2026-11-18
