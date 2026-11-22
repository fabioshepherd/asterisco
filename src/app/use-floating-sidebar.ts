import { useEffect, useRef, type KeyboardEvent, type RefObject } from "react";

import { returnFocus } from "@/lib/focus-return";
import { useUi } from "@/stores/ui";

export interface FloatingSidebar {
  /** The sidebar's column (docked or floating). */
  ref: RefObject<HTMLDivElement | null>;
  /** Escape inside the floating sidebar closes it. */
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}

/**
 * The sidebar as an overlay (a narrow window, see `use-reflow`): it covers the
 * document like a sheet, so it closes like one. Escape closes it and focus goes
 * back to where it was before it entered the sidebar (the active editor when
 * that is gone); closing it any other way while focus is inside it (its own
 * toggle, Ctrl+Shift+L) returns focus the same way, instead of leaving it on
 * `<body>` once the panel unmounts (WCAG 2.2 SC 2.1.2, 2.4.3). Docked, only
 * that close path applies (no Escape).
 */
export function useFloatingSidebar(floating: boolean, shown: boolean): FloatingSidebar {
  const ref = useRef<HTMLDivElement>(null);
  /** The last element focused outside the sidebar: the return target. */
  const origin = useRef<HTMLElement | null>(null);
  const wasShown = useRef(shown);

  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && !ref.current?.contains(target)) {
        origin.current = target;
      }
    };
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, []);

  // Closed, docked or floating: the panel is still on screen for its exit, so
  // focus can still be found inside it.
  useEffect(() => {
    if (wasShown.current && !shown) returnFocus(origin.current, ref.current);
    wasShown.current = shown;
  }, [shown]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!floating || event.key !== "Escape" || event.defaultPrevented) return;
    // Only from the sidebar itself: not from a dialog it portals elsewhere, and
    // not from its context menu, which closes on its own Escape.
    const target = event.target;
    if (!(target instanceof Element) || !event.currentTarget.contains(target)) return;
    if (target.closest('[role="menu"]')) return;
    event.preventDefault();
    const leaving = event.currentTarget;
    useUi.getState().toggleSidebar();
    returnFocus(origin.current, leaving);
  };

  return { ref, onKeyDown };
}
