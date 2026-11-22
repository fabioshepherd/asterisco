import { useEffect, useState } from "react";

/**
 * Reflow at the minimum window × 200% zoom (WCAG 2.2 SC 1.4.10): 640 px at 2×
 * is 320 CSS px. Below these widths the docked columns would squeeze the
 * document to a sliver, so they float over it instead. The sidebar preference
 * itself is never touched.
 */
/** The narrowest document column worth docking a panel beside. */
export const MIN_MAIN_WIDTH = 400;
/** The Settings sheet's docked width (`w-96`). */
export const SETTINGS_WIDTH = 384;

export interface ReflowLayout {
  /** The sidebar floats over the document instead of docking beside it. */
  sidebarOverlay: boolean;
  /** The Settings sheet floats over the document instead of docking beside it. */
  settingsOverlay: boolean;
}

/**
 * Decide which panels dock and which float for a window `width` (CSS px).
 * The sidebar docks only if the document keeps {@link MIN_MAIN_WIDTH}; Settings
 * then docks only if it fits beside whatever is still docked.
 */
export function reflowLayout(
  width: number | null,
  sidebarWidth: number,
  sidebarShown: boolean,
): ReflowLayout {
  if (width === null) return { sidebarOverlay: false, settingsOverlay: false };
  const sidebarOverlay = width - sidebarWidth < MIN_MAIN_WIDTH;
  const docked = sidebarShown && !sidebarOverlay ? sidebarWidth : 0;
  return { sidebarOverlay, settingsOverlay: width - docked - SETTINGS_WIDTH < MIN_MAIN_WIDTH };
}

/**
 * The window's width in CSS px (zoom-aware), or `null` where `ResizeObserver`
 * is unavailable (e.g. jsdom without a stub) — everything then stays docked.
 */
export function useWindowWidth(): number | null {
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const root = document.documentElement;
    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0]?.contentRect.width ?? root.clientWidth);
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  return width;
}
