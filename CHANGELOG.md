# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-11-22

The 1.0 consolidation: fewer features, fewer dependencies, and the ones that
stay made correct. Files you open are left as they were unless you change them.

The project has a final name: **Asterisco**. Until 2026-11-20 it was developed
under the working name **Smeargle** (`project-smeargle`); the app, its identifier
(`it.fabiopastore.asterisco`), its settings keys and the repository now use the
final name. Settings from the earlier test builds are not carried over.

### Removed

- **Importers.** File ▸ Import… and the drag-and-drop conversion of DOCX, PDF,
  CSV/TSV and XLSX are gone; converting other formats is Pandoc's job. Dragging a
  Markdown file onto the window still opens it.
- **Word (DOCX) export**, with its reference-template setting. Export to HTML,
  Print and Copy as HTML / Markdown remain.
- **The split editor.** "Open to side", the edge drop zone, `Mod+\` and dragging
  a file from the tree into the editor are gone: one column, never two. Tabs can
  still be reordered by dragging.
- **Definition lists.** `Term` / `: Definition` is no longer rendered as a list;
  the text stays a plain paragraph and the file is saved exactly as it was.
- **Image resize and alignment.** They stored their state in the image's alt
  text, so saving turned `![Architecture](a.png)` into `![1.00](a.png)`. Alt text
  and title are now kept as written.
- **Smart punctuation** (`--` → `–`, `...` → `…`, curly quotes). It also fired
  inside inline code, so `--force` became `–force`.
- **Theme presets.** The neutral, accent and font controls they seeded stay.
- **The mono reading font.** If you had chosen mono, the editor now reads in
  serif.
- **Settings that should not exist:** the inline base64 image mode, the
  auto-save interval mode, settings import/export, and the default
  `Mod+Shift+A` shortcut for toggling auto-save (the status bar, the menu and
  the command palette still toggle it, and the shortcut can be bound again).
- **Character count and reading time** in the status bar. The word count stays
  and still counts the selection; the caret position shows in Source view only.
- **The code "Preview" under ordinary code blocks.** Code is shown once,
  highlighted by the editor; only Mermaid and LaTeX blocks keep a preview.
- **Select tab by position** (`Mod+1…9`). Off macOS it fired together with the
  heading shortcut; `Mod+1…6` now only sets a heading. Switch tabs with
  `Ctrl+Tab`, the command palette or the tab strip.
- **The accent picker inside the command palette** (it is in Settings), the
  theme crossfade and the "saved" animation, the scroll-following section rail
  in Settings, the sidebar's "show ignored folders" button (the Settings switch
  stays), the duplicate workspace row in the file tree, the duplicate Close
  and Toggle Theme menu items, and the regex-engine detail tooltip in search.

### Changed

- **Export PDF is now File ▸ Print… (`Ctrl/Cmd+P`).** Save as PDF from the
  print dialog, as in any other desktop app.
- **File ▸ Close is labelled "Close Tab".**
- **Auto-save is one switch.** When on, it saves a second after you stop
  typing and when the editor loses focus.
- **One text measure for every view.** The "Line width" setting now drives
  edit, reading and source alike, and defaults to 66 characters.
- **Tab moves focus out of the editor** in an ordinary paragraph instead of
  inserting spaces. In a list it still nests and un-nests the item, and in a
  code block it indents.
- **Lists are plain lists.** The editor no longer draws its own list-item
  blocks, which could send the caret to the start of a new item while typing.
- **Links in Reading view open outside the app.** A web or mail link opens in
  the system browser; a relative link to a Markdown file opens it in a new tab.
  A click can no longer navigate the app window away from your document.
- **The command palette and the shortcuts run the same commands as the menu,**
  with the menu's names. The palette also lists Quit, Close Tab and Help, and
  lists open documents in tab-strip order. Custom shortcuts saved on a Format
  key are dropped at launch, because they fired twice off macOS.
- **Calmer chrome.** Selected options in Settings are a muted chip instead of a
  solid accent fill; dialogs share one look; icon buttons share one size, press
  and focus ring; the view switch, word count, auto-save toggle and outline
  appear only when a document is open; the unsaved dot sits where the close
  button goes, so the tab strip no longer shifts on the first keystroke;
  success toasts sit on a plain surface; Mermaid's light theme is neutral.
- **Accessibility (WCAG 2.2 AA).** Focus returns where it came from after the
  palette, Settings and every dialog close; focus is visible in menus, the
  palette, search and the file tree; editors, Crepe's icon buttons, diagrams
  and shortcut rows have names; Reading view is read-only and focusable; the
  unsaved-changes prompt is announced as an alert; a tab strip is one Tab stop
  with 24 px close targets; state indicators meet 3:1 contrast; the layout
  reflows at the minimum window at 200% zoom; the notifications can be reached
  from the keyboard. A keyboard walkthrough runs as an end-to-end test.
- **A smaller download.** The release build is size-tuned and many
  dependencies are gone; the Linux `.deb` went from 13,486,576 to 8,325,518
  bytes.

### Fixed

- **Saving right after typing wrote the previous text.** Save, Save As, export,
  copy and auto-save now take the editor's latest content.
- **Saving rewrote untouched parts of the file.** Lines holding only `<br>`
  were deleted and every `-` bullet became `*`. A file you did not edit is no
  longer written at all, and CRLF line endings, a byte-order mark and a missing
  final newline are kept when you do edit it.
- **Saving a symlinked document replaced the link with a copy** (for example
  `CLAUDE.md -> AGENTS.md`). The save now writes to the link's target.
- **New, Open, Open Folder, Save As, Close Tab and Quit shortcuts did nothing on
  Windows and Linux.** They work, show in the menubar and can be remapped.
- **Settings could be overwritten at launch,** and dragging the sidebar rewrote
  the settings file on every frame. Only changed values are saved, after the
  saved ones have loaded.
- **Searching, listing the tree, quick-open and saving could freeze the
  window.** They run off the main thread.
- **Workspace search stopped at the first unreadable folder.** It skips it and
  goes on, though the search is still reported as "stopped at its limit" (a
  known limit, listed under Later in the roadmap).
- **Creating a file could truncate one created at the same moment** by another
  program.
- **Installing an update on Windows closed the app without asking about unsaved
  changes.**
- **Opening the source view with two documents open crashed the editor.**
- **Settings ▸ Open themes folder and Ctrl/Cmd-click on links did nothing.**
- **The status bar's selection count lagged one step behind.**
- **Typing in a Mermaid block made the diagram flicker,** and switching from
  Source back to edit without changes added an undo step and moved the caret.
- **Italian users saw English for a moment at launch.**
- **A pasted or dropped image that failed to save was dropped silently.** Pasted
  or dropped images are now saved under a new name (never over an existing
  file), up to 25 MB, and a failure is reported instead of being dropped
  silently.
- **The command palette showed the wrong shortcut for Export HTML.**
- **Untranslated text:** the image block's labels and the editor's floating
  controls ("Hide", "Edit") are localized, set in the interface font and in
  sentence case; shortcuts and paths render in the mono font again; Source
  view's syntax colours meet contrast in dark mode.
- **Release builds could ship without third-party notices,** and the Rust
  licence texts in them were HTML-escaped.
- **Print windows had all of the main window's permissions;** they now get only
  what printing needs.

## [0.5.1] — 2026-08-18

### Added

- **Releases cover all three platforms again.** A tag now builds macOS (Apple
  Silicon and Intel), Windows and Linux (deb + AppImage) — the five bundle
  targets the configuration has always declared, four of which no runner was
  producing. macOS bundles are unsigned for now, so Gatekeeper warns on first
  open; the signing path is wired and waits only on a certificate.

### Changed

- **The slash menu speaks Italian.** The `/` menu that inserts headings, lists,
  tables, code blocks and math — and the link tooltip's input — were English
  whatever the app language was set to. Every label is now translated.

### Fixed

- **The image-alignment control announces itself correctly.** It offers three
  mutually exclusive choices but called itself a toolbar, which is not a role
  `radio` buttons may sit in; screen readers now hear a radio group.
- **The file-tree context menu closes when you Tab out of it.** It used to stay
  open behind the focus, with no way back to it.

- **A save can no longer lose the document.** Saving used to truncate the file
  and then write into it, so a crash, a full disk or a power loss part-way
  through left the document truncated or empty — with the previous contents
  already gone. The bytes now go to a scratch file next to the original, get
  flushed to the device, and replace it in one atomic rename: the file on disk
  is either entirely the old version or entirely the new one, never a mixture,
  and a failed save leaves what was there untouched. Exports write the same way.
  The file's permissions survive the save, and the watch that notices external
  edits is re-armed afterwards, since the saved document is a new file rather
  than the same one rewritten.

## [0.5.0] — 2026-08-08

### Added

- **The file selector can be reached from the keyboard.** `Mod+Shift+E` opens the
  sidebar if it is closed and puts focus on the tree; "Focus file tree" and
  "Reveal in file tree" are in the command palette.
- **A filter field in the sidebar.** It searches the whole workspace, not only
  the branches that happen to be open, so it finds a file three folders down in a
  collapsed tree. Matches are listed with the folders they live in, and the count
  is announced as you type.
- **Collapse all folders.** Expansion state now lives outside the rows, so closing
  a folder — or hiding and reopening the sidebar — no longer erases the shape of
  everything underneath it.
- **A resizable sidebar.** The trailing edge is a proper window splitter: drag it,
  or focus it and use the arrow keys and Home/End. The width is remembered.
- **`.gitignore` is honored.** The tree, quick-open and workspace search read the
  repository's ignore files the way git does — nested files, negations and
  `.git/info/exclude` included. `.github`, `.claude` and `.cursor` stay visible
  whatever any ignore rule says: they hold the agent files this editor is for.
- **The file selector shows what a file is for.** An agent brief — `CLAUDE.md`,
  `AGENTS.md`, a skill's `SKILL.md`, anything under `.claude/` or `.cursor/` —
  carries its own glyph, and a README is set in medium so the door into a folder
  reads first. Glyph and weight only: no colour, no badges, no second hierarchy.
  The glyph says "addressed to a machine", not "generated configuration": these
  files are prose a person wrote.
- **A folder that can't be read offers to try again.** Enter, Space or a click on
  the error row re-reads that one folder, without reloading the tree and losing
  every branch you opened.
- **"Close folder"** is in the File menu and the command palette.
- **The view a document opens in is a setting.** Source, edit or reading —
  Settings ▸ Editor & files ▸ Reading ▸ "View on launch". This app is opened from
  a file twenty times a day and reading is the larger half of the job; it used to
  land in edit every time, with no way to say otherwise.
- **The neutral base is selectable.** Gray, Sand or Slate, in Settings ▸
  Appearance. The design system documents it as one of three independent axes and
  the app has always applied it live, but the only way to reach it was a preset
  that also overwrote the accent, the body font, the measure and the line height.
- **"Show ignored folders" is in Settings.** It governs the file tree, quick-open
  and workspace search together, and its only control was an eye icon inside a
  panel that can be hidden.
- **Help ▸ Open-source licenses** opens the third-party notices, which used to be
  reachable only from a settings tab called "Advanced".

### Changed

- **A capped scan says so.** The file index stopped at 5,000 documents and the
  workspace search at 2,000 matches, both in silence — and the index was sorted
  *after* being cut, so quick-open showed a tidy A→Z list that was really a
  partial one. Both now report it: quick-open notes that the workspace holds more,
  and the search summary reads "N+ matches in N+ files" instead of stating a
  capped number as fact. A file skipped for being too large counts too.
- **The tree follows the open document only until you disagree.** Reveal no longer
  reopens a folder you closed by hand, and it can be switched off entirely
  (Settings ▸ Editor ▸ Follow the open document). "Reveal in file tree" is the
  deliberate version and always opens the branch.
- The sidebar's ignored-files toggle is labelled for what it now does — it covers
  files as well as folders, and names them: dependencies, build output,
  `.gitignore`. That label was the only place the word "ignored" was ever
  explained.
- **A failure on disk says what happened.** Every I/O error used to collapse into
  "a file-system error occurred", with the OS's own words and the path thrown
  away. The errno now reaches the message — "permission denied", "it no longer
  exists", "that path is not a folder" — and anything without a phrase of its own
  quotes the system verbatim instead of paraphrasing it. In the tree the row
  names the folder and the cause, prints the path under it in mono, keeps the raw
  OS text on hover, and logs it.
- **One folder listing stops at 2,000 entries and says so**, rather than handing
  50,000 rows across to the interface (measured: 416 ms and 6.9 MB before, 84 ms
  and 275 KB after). The entries past the cap are still counted, so the row reads
  "Folder too large to list — documents found in the first 2,000 of 50,000
  entries" and a folder is never called empty on the strength of a prefix.
- The sidebar's filter keeps its index between searches. Clearing the box and
  typing a different word used to re-walk the whole workspace and put "Indexing…"
  in front of someone who had only backspaced.
- The type-to-jump buffer holds for a second instead of half of one, which is
  less time than it takes to type "CHANGELOG" while reading the rows.
- The sidebar header is down to four icon buttons: "Close folder" has a home in
  the File menu and the palette, so it no longer takes a permanent button too.

- The project is now **free and open source under the MIT licence**. There is no
  paid tier, no activation key and no EULA.
- **The status bar's left side now carries one control instead of six.** It is the
  view of the document — Source · Edit · Reading, ordered from the raw file to the
  finished page, each segment always labelled rather than an icon with a tooltip.
  The bar reports state that has to be seen; commands that already live in the
  View menu, the command palette and a keybinding no longer take a permanent
  button next to it.
- Arrow-key navigation across the view control now moves focus along with the
  selection. Previously focus stayed on the segment the user started from, so the
  third view could not be reached from the keyboard.
- The View menu lists the three views in the same order as the status bar.
- **Settings is three tabs and a footer, not five tabs.** Appearance, Editor &
  files, Shortcuts — and a band along the bottom, visible from every screen, for
  the things that belong to the app rather than to a document: language, the
  settings file, and the reset. "Files & saving" held two rows; "Advanced"
  contained the language switch of a product that promises Italian and English at
  parity. The Word reference template now sits under an Export heading in Editor &
  files, and the image, ignore and reveal settings sit with the files they affect.
- **The accent picker opens instead of unfolding.** At rest it shows one swatch —
  the live accent — and the eleven scales appear underneath only while you are
  choosing. No option was removed. The preset cards now carry an "Aa" set in that
  preset's own reading font and accent, which says more than the colour dot did
  and stops fifteen hues from sharing the screen that explains why colour is
  scarce here.
- **The shortcut list is grouped** — navigate, view, app — instead of fourteen
  rows in one scroll.
- **A shortcut conflict names the owner.** "Already in use" knew which action held
  the combination and would not say; it now reads "Already used by *Toggle
  outline*" and offers to move it. A combination the native menu owns is refused
  outright, naming the menu item, instead of being stored and then never firing.
- **Resetting all shortcuts asks first.** Fourteen bindings used to go on the
  first click, while the smaller "reset settings" button had a confirmation. That
  confirmation's text also now says what it keeps: language, recent files *and*
  keyboard shortcuts.
- **Export HTML no longer takes `Mod+Shift+E`.** Exporting is deliberate and
  occasional and stays in File ▸ Export and the command palette; that combination
  is the one this audience reaches for to get to the file tree — and the native
  menu was quietly winning it.

### Fixed

- The rows that report a state in the file tree — "empty folder", "no documents
  here", an unreadable folder, and the loading placeholder — could not be reached
  with the arrow keys and were invisible to assistive technology. They are proper
  tree items now, named and marked as having nothing behind them.
- `aria-current` on the open file reads `"true"` rather than `"page"`.
- **The workspace folder can no longer be moved to the trash from the file tree.**
  It rendered as an ordinary row, it is where `Mod+Shift+E` puts the keyboard, and
  `Delete` there was one confirmation — naming only the folder's own name — away
  from putting an entire repository in the trash. It is refused now, the
  confirmation says when it is a folder and everything in it, and the context
  menu offers "Close folder" there instead. Renaming the workspace folder moves
  the workspace with it rather than leaving the app pointed at a path that no
  longer exists.
- **One unreadable folder no longer costs the whole index.** A single permission
  error four levels down aborted the workspace walk, which removed the sidebar
  filter *and* quick-open from a workspace that was otherwise entirely readable.
  Unreadable folders are stepped over and counted, and the count is reported
  beside the match count. A failed index can be built again from its own row.
- The sidebar filter answers ArrowDown and Enter, like workspace search does:
  two characters found the file, and reaching it took three more Tabs.
- Two faded elements were below the WCAG floor once composited: the folder path
  on the current filtered row (3.42:1 on the default accent) and the resting
  button that reopens a hidden sidebar (2.52:1 against the 3:1 floor for
  controls). Neither fades any more.
- A symlink pointing back at its own folder was an infinitely expandable branch.
  Quick-open and search already refused to descend into one; the tree now flags
  it as what it is — not content.
- The sidebar's resize handle assumed the panel is always on the left, so in a
  right-to-left layout dragging and the arrow keys both worked backwards.
- **One shortcut row printed its own identifier.** "Focus file tree" rendered as
  the literal string `focusFileTree`, in both languages, because its label came
  from a list maintained by hand next to the list of actions. The labels are
  derived from the actions now, so the two cannot drift.
- **`Mod+Shift+E` for "Focus file tree" had never worked.** The native Export HTML
  accelerator claimed the keystroke before the window ever saw it.
- **Help ▸ Keyboard Shortcuts opened the wrong screen.** The app's only
  documentation entry point landed on Appearance.
- The settings tab rail was a list of links: no arrow keys, and nothing told
  assistive technology that a panel had changed. It is a tab list now, and a
  search with results announces how many it found — previously only the empty
  case spoke.
- While recording a shortcut, the panel captured every keystroke in the window,
  including a screen reader's own commands, and Tab could not get out. Recording
  is scoped to the button being recorded, and a keystroke it cannot use now says
  why instead of being dropped in silence.
- The Italian search field read "Cerca impostazio…", cut mid-word, and the
  Italian footer ran its buttons up against the edge of the panel.

### Removed

- The **"Files & saving" and "Advanced" settings tabs**. Nothing was dropped: two
  rows and four actions moved to the tabs and the footer that fit them.
- Licence activation (Settings ▸ License), the "Unregistered" title-bar badge,
  the launch-time nag dialog and the Ed25519 key verifier.
- **Focus mode and typewriter mode**, with their keybindings (`Mod+Shift+J`,
  `Mod+Shift+T`), menu items, palette commands and settings rows. They are
  long-form drafting aids: this editor is opened to read a README and fix a line,
  and typewriter centering additionally moved the page on the typing path.
- The **distraction-free button** in the status bar. The mode stays, reached from
  the View menu or `Mod+Shift+Enter` and left with `Esc` — but it hides the status
  bar, so the button could switch it on and never off, and reported itself as
  never pressed to assistive technology.

## [0.4.0] — 2026-06-20

> Reconstructed on 2026-08-17 from the 34 commits between `app-v0.3.1` and
> `app-v0.4.0`. The release was tagged and shipped without an entry here; this
> restores it rather than pretending the version never existed.

### Added

- **The keyboard reaches the panels.** The file tree became a navigable tree
  (arrow keys, type-to-jump, inline rename with visible errors, real loading and
  empty states), the outline gained roving focus and scrollspy that follows the
  document, and workspace search results became navigable with the match
  highlighted and the status announced.
- **The command palette groups its commands**, offers an accent page, lists
  recent files and shows each command's shortcut. "Toggle theme" is one of them.
- **Settings gained a search field**, helper captions under the options that
  need them, and one consistent set of controls across every tab.
- **Tabs got a context menu** (rename, close) and rename errors you can see
  rather than a silent failure.
- **Find & replace previews how many replacements it will make**, keeps Tab
  inside the panel, explains what is wrong with an invalid regular expression,
  announces replacements, and takes Enter from the replacement field.
- **Export reports progress**, prints on light paper whatever the active theme,
  embeds latin-ext font subsets in HTML output, and names the DOCX template it
  applied.
- **Import shows a progress toast that can be cancelled**, with clearer
  drop-overlay feedback.

### Changed

- The welcome screen's recent-file headings are sentence case, with roving
  keyboard navigation.
- File-tree multi-select was added and then removed again before the release:
  the single-file flow is the one this app is for.
- Find & replace controls were unified on the shared Button component with
  lucide icons.

### Fixed

- Recent files and folders that no longer exist are pruned instead of
  dead-ending when opened.
- The theme now syncs `color-scheme`, so native form controls and scrollbars
  match the active theme.
- The current match scrolls into view from the Find panel, a distinct
  "no matches" state is shown, and the replacement field gets its own row.
- The outline's scroll is bounded, so the last heading is no longer clipped.
- The status bar reads legibly: persistence state, leading word count, and
  controls consistent with the rest of the chrome.
- The `autoPairing` preference is persisted and included in exported settings.
- Editor polish against the design tokens: code-block preview label and chrome
  radii, selection colour and disclosure chevron across views, and a motion
  token for the reading-view measure transition.

## [0.3.1] — 2026-06-17

### Added

- **Find & replace** is now wired to live editor search: matches are located and
  highlighted in both the WYSIWYG (ProseMirror) and source (CodeMirror) modes,
  with replace and replace-all.

## [0.3.0] — 2026-06-17

### Added

- Reworked editor view model: a single **view mode** — Edit, Reading, or Source —
  replaces the previous independent source/reading toggles. A grouped segmented
  control in the status bar switches modes, and the writing aids (focus,
  typewriter) are gated to the modes where they apply.
- **Reading view**: a narrow, centered measure with reading typography and hidden
  editing chrome, for distraction-free review of the current document.
- **Typewriter mode** keeps the caret's line vertically centered, now with smooth
  spring-based scrolling (Motion); its animator is disposed cleanly on mode/view
  change and on unmount.
- **Custom title bar and window chrome:** frameless decorations with custom window
  controls on Windows/Linux, an in-window application menubar (Alt/F10 to focus),
  and a macOS overlay title strip that hosts the tabs; the chrome is selected per
  platform.
- **Show hidden files** toggle in the file-tree header — hidden entries are
  revealed and dimmed; off by default and persisted.

### Changed

- The native menu, command palette and keybindings are now driven from a single
  command registry and a declarative, localized menu spec serialized to the
  backend — one source of truth for actions across the whole app.

### Fixed

- The macOS title strip no longer leaves an inset gap in native fullscreen.
- Status-bar labels collapse responsively to avoid clipping at narrow widths.
- Shiki code-block previews are left-aligned.

## [0.2.1] — 2026-06-09

Release-engineering only. Limited the release matrix to Windows until macOS
signing is configured, dropped Linux temporarily, and bumped CI tooling. No
user-facing changes.

## [0.2.0] — 2026-06-09

### Added

- **Reference-style DOCX export:** point the exporter at a Word template and the
  generated document adopts its paragraph styles and theme. Includes a
  template picker with validation in Settings, persistence of the chosen
  template, and feedback when a template is skipped (showing its name).
- **XLSX import** on top of the existing drag-and-drop import flow.
- **Print** capability for the WebView.

### Changed

- Replies to the user are in Italian (project convention); code, comments and
  commits stay in English.

### Fixed

- The editor no longer scrolls horizontally from unbounded flex width.

## [0.1.0] — 2026-06-07

First tagged release — the pragmatic v1 release-prep baseline.

### Added

- Unsaved-changes guard: the app prompts to save before closing a window or
  quitting, instead of discarding unsaved edits.
- Detection of external file deletion: if the open file is removed on disk, you
  are notified instead of the change failing silently.
- Application logging (via `tauri-plugin-log`) with a thin frontend wrapper, to
  aid diagnostics.
- Root and editor-level error boundaries with a localized fallback UI, so a
  rendering error no longer blanks the window.
- A complete, localized native menu: Export, View toggles, Find, Settings, Help,
  and a user-triggered "Check for Updates" item; menu labels follow the active
  language.
- Find & replace: match navigation and single replace, honoring regex group
  references.
- Settings: schema version, reset-to-defaults, smart-punctuation export, and an
  in-app viewer for the bundled third-party notices.
- Drag-and-drop file import with a premium drop overlay that gives live
  valid/invalid feedback by file type (Markdown, PDF, …).
- Legal and project documentation: privacy policy, end-user license agreement,
  contributor guide, security policy, and this changelog.

### Changed

- Backend error messages shown to users are now localized rather than raw
  internal strings.
- The native menu drops accelerators already owned by the customizable keymap, so
  shortcuts no longer conflict.

### Fixed

- Auto-save failures are now surfaced with a rate-limited toast instead of failing
  silently.
- External-deletion detection no longer false-fires during atomic saves.
- The document language (`<html lang>`) now tracks the active UI locale at
  runtime and in HTML exports, so screen readers announce text with the correct
  pronunciation (WCAG 3.1.1).

### Known limitations (v1.1)

- Keyboard accessibility gaps deferred to v1.1: the file tree (`FileTree`), its
  context menu (`TreeContextMenu`), and workspace search (`WorkspaceSearch`) are
  not yet fully keyboard-navigable.
