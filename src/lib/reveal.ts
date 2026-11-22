/**
 * Passive "reveal" scrolling: keep an element in view inside its scroll
 * container while the app follows some state (the active file in the tree, the
 * active tab in the strip, the current heading in the outline).
 *
 * `Element.scrollIntoView` is not used for this on purpose. Chromium (WebView2
 * on Windows, and the Chromium the e2e suite runs) also moves the *sequential
 * focus navigation starting point* to the element it scrolls to. With focus on
 * `<body>` — right after launch, for one — the next Tab then starts from the
 * revealed row instead of from the top of the window, and skips the menubar,
 * the window controls and the sidebar header (WCAG 2.4.3). Scrolling the
 * container itself leaves the starting point where it was.
 */

/** The closest ancestor of `el` that scrolls on `axis`, or null. */
function scrollParent(el: HTMLElement, axis: "x" | "y"): HTMLElement | null {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const overflow = getComputedStyle(node)[axis === "x" ? "overflowX" : "overflowY"];
    if (overflow === "auto" || overflow === "scroll") return node;
  }
  return null;
}

/**
 * How far to scroll so that [start, end] sits inside [viewStart, viewEnd] with
 * the least movement — the CSSOM "nearest" alignment `scrollIntoView` uses.
 */
export function nearestDelta(
  start: number,
  end: number,
  viewStart: number,
  viewEnd: number,
): number {
  const fits = end - start <= viewEnd - viewStart;
  if (start < viewStart && end > viewEnd) return 0;
  if (start < viewStart) return fits ? start - viewStart : end - viewEnd;
  if (end > viewEnd) return fits ? end - viewEnd : start - viewStart;
  return 0;
}

/**
 * Scroll `el`'s scroll container(s) by the least distance that brings `el`
 * into view on `axis` (`"y"` for lists, `"x"` for the tab strip). A no-op when
 * it is already visible or nothing scrolls.
 */
export function revealInScroller(
  el: HTMLElement,
  axis: "x" | "y",
  behavior: ScrollBehavior = "auto",
): void {
  const scroller = scrollParent(el, axis);
  if (!scroller) return;
  const box = el.getBoundingClientRect();
  const view = scroller.getBoundingClientRect();
  const delta =
    axis === "y"
      ? nearestDelta(
          box.top,
          box.bottom,
          view.top + scroller.clientTop,
          view.top + scroller.clientTop + scroller.clientHeight,
        )
      : nearestDelta(
          box.left,
          box.right,
          view.left + scroller.clientLeft,
          view.left + scroller.clientLeft + scroller.clientWidth,
        );
  if (delta === 0) return;
  scroller.scrollBy(axis === "y" ? { top: delta, behavior } : { left: delta, behavior });
}
