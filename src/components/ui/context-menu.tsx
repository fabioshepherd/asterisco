import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

/** Viewport coordinates of the right-click that opened the menu. */
export interface ContextMenuPoint {
  x: number;
  y: number;
}

/** Gap kept between the menu and the viewport edge when clamping. */
const EDGE_MARGIN = 8;

const DismissContext = createContext<() => void>(() => undefined);

export interface ContextMenuProps {
  /** Where to open, or `null` when the menu is closed. */
  at: ContextMenuPoint | null;
  /** Accessible name for the menu (`aria-label`). */
  label: string;
  /** Called on Escape, Tab, outside click, and after an item is chosen. */
  onDismiss: () => void;
  /**
   * The element focus returns to when the menu closes. Captured when the menu
   * opens — by close time the caller has usually cleared its target, so a
   * callback read then would have nothing left to look for — but *invoked* at
   * close time, so a row that re-rendered in between is still found.
   */
  returnFocus?: () => HTMLElement | null | undefined;
  children: ReactNode;
}

/**
 * Right-click menu shared by the file tree and the tab strip.
 *
 * Deliberately not a Radix menu: `position: fixed` is what escapes the tab
 * strip's overflow clipping, and the focus-return contract below is specific to
 * this app — a right-click starts from a row or a tab, and that is where focus
 * has to land again. What it does provide is the behaviour both callers need and
 * used to carry separately: viewport clamping, Escape and outside-click
 * dismissal, roving arrow keys with Home/End, Tab closing the menu rather than
 * walking out of it, and focus returning to the element that opened it so a
 * keyboard user is never stranded on `document.body`.
 */
export function ContextMenu({ at, label, onDismiss, returnFocus, children }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const isOpen = at !== null;
  // The effects below depend on the coordinates, not the point object: a caller
  // re-rendering must not re-position or re-focus an already-open menu.
  const x = at?.x;
  const y = at?.y;

  const returnFocusRef = useRef(returnFocus);
  returnFocusRef.current = returnFocus;

  // Lets the close effect tell "the menu is gone" from "the menu moved to
  // another target", which re-runs the same effect.
  const atRef = useRef(at);
  atRef.current = at;

  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  // Close on Escape, wherever focus currently sits.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismissRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  // Hand focus back to whatever the menu was opened from, so a keyboard user is
  // never stranded on document.body.
  useEffect(() => {
    if (x === undefined) return;
    const openedFrom = returnFocusRef.current;
    return () => {
      // Re-targeting (a right-click on another row while this menu is open)
      // re-runs this effect; only a real close should move focus.
      if (atRef.current) return;
      openedFrom?.()?.focus();
    };
  }, [x, y]);

  // Clamp to the viewport so a right-click near an edge never opens off-screen,
  // then move keyboard focus to the first item.
  useLayoutEffect(() => {
    if (x === undefined || y === undefined) {
      setPos(null);
      return;
    }
    const menu = menuRef.current;
    if (!menu) return;
    const { width, height } = menu.getBoundingClientRect();
    const left = Math.min(x, window.innerWidth - width - EDGE_MARGIN);
    const top = Math.min(y, window.innerHeight - height - EDGE_MARGIN);
    setPos({ top: Math.max(EDGE_MARGIN, top), left: Math.max(EDGE_MARGIN, left) });
    menu.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [x, y]);

  if (!at) return null;

  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    );
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement as HTMLElement);
    const focusAt = (next: number) => {
      items[(next + items.length) % items.length]?.focus();
      event.preventDefault();
    };
    if (event.key === "ArrowDown") focusAt(index + 1);
    else if (event.key === "ArrowUp") focusAt(index - 1);
    else if (event.key === "Home") focusAt(0);
    else if (event.key === "End") focusAt(items.length - 1);
    // Tab used to walk out of the menu and leave it open behind the focus, with
    // no way back to it. A menu closes on Tab; the close effect hands focus back
    // to whatever it belongs to, exactly as Escape does.
    else if (event.key === "Tab") {
      event.preventDefault();
      onDismiss();
    }
  };

  return (
    // Full-screen catcher closes the menu on any outside interaction.
    <div
      className="fixed inset-0 z-30"
      onClick={onDismiss}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div
        ref={menuRef}
        role="menu"
        aria-label={label}
        style={{ top: pos?.top ?? at.y, left: pos?.left ?? at.x }}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onMenuKeyDown}
        className="fixed min-w-44 rounded-md border border-border bg-bg py-1 shadow-card"
      >
        <DismissContext.Provider value={onDismiss}>{children}</DismissContext.Provider>
      </div>
    </div>
  );
}

export interface ContextMenuItemProps {
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  /** Destructive action: tints the icon with the danger token. */
  danger?: boolean;
  /**
   * Present but not available right now — "Close others" with one tab open.
   * Greyed-out is the answer to "can I do this?"; hiding the row instead would
   * make the menu a different shape every time it opens. Stays focusable with
   * `aria-disabled` (the APG's advice for menus) so a keyboard walk still meets
   * it and hears why nothing happened.
   */
  disabled?: boolean;
}

/** One row of a {@link ContextMenu}. Dismisses the menu, then runs the action. */
export function ContextMenuItem({ label, icon, onSelect, danger, disabled }: ContextMenuItemProps) {
  const dismiss = useContext(DismissContext);
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      aria-disabled={disabled || undefined}
      onClick={() => {
        if (disabled) return;
        dismiss();
        onSelect();
      }}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors duration-(--motion-duration-fast) ease-snappy",
        disabled ? "text-muted-fg" : "text-fg hover:bg-muted",
      )}
    >
      <span className={cn("[&_svg]:size-4", danger && !disabled ? "text-danger" : "text-muted-fg")}>
        {icon}
      </span>
      {label}
    </button>
  );
}

/** Rule between groups of a {@link ContextMenu}. */
export function ContextMenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-border" />;
}
