/**
 * Focus return for surfaces that take focus and then go away (dialogs, the
 * command palette, the settings sheet). Without it focus falls to `<body>` on
 * close and the next keystroke goes nowhere (WCAG 2.2 SC 2.4.3; APG Dialog).
 */

/** The element focused right now, as a return target (null for `<body>`). */
export function focusOrigin(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const active = document.activeElement;
  return active instanceof HTMLElement && active !== document.body ? active : null;
}

/**
 * Put focus on the active document: the editing surface in Edit and Source
 * view, the scrollable panel in Reading view (it has no caret).
 */
export function focusActiveEditor(): void {
  const panel = document.getElementById("document-panel");
  if (!panel) return;
  const candidates =
    panel.dataset.view === "source"
      ? // The rich editor stays mounted (hidden) under Source view, code-block
        // CodeMirrors included: only the source editor's own surface counts.
        [...panel.querySelectorAll<HTMLElement>(".cm-content")].filter(
          (el) => !el.closest(".milkdown"),
        )
      : [...panel.querySelectorAll<HTMLElement>('.ProseMirror[contenteditable="true"]')];
  for (const target of [...candidates, panel]) {
    target.focus();
    if (document.activeElement === target) return;
  }
}

/**
 * Hand focus back after a surface closes: to `origin` if it can still take
 * it, otherwise to the active editor.
 *
 * Only when focus is stranded — on `<body>`, or still inside `leaving` (the
 * surface going away). Anything else means the action that closed the surface
 * put focus somewhere on purpose (a palette command that focuses the file
 * tree, a dialog that opens another one), and that wins.
 */
export function returnFocus(origin: HTMLElement | null, leaving?: Element | null): void {
  const active = document.activeElement;
  const stranded =
    !active || active === document.body || (leaving ? leaving.contains(active) : false);
  if (!stranded) return;
  if (origin?.isConnected && !leaving?.contains(origin)) {
    origin.focus();
    if (document.activeElement === origin) return;
  }
  focusActiveEditor();
}
