import { useRef, useState, type KeyboardEvent } from "react";

/**
 * Roving-tabindex keyboard navigation for a vertical list of buttons: Up/Down
 * move focus, Home/End jump to the ends. Attach `refs` to each item, give the
 * item at `tabbable` `tabIndex={0}` (the rest -1) and wire `onKeyDown(event, i)`.
 * `tabbable` is clamped to `count`, so exactly one item stays in the tab order
 * even if the list shrinks.
 */
export function useRovingFocus(count: number) {
  const [focusIndex, setFocusIndex] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    let next: number;
    if (event.key === "ArrowDown") next = Math.min(count - 1, index + 1);
    else if (event.key === "ArrowUp") next = Math.max(0, index - 1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = count - 1;
    else return;
    event.preventDefault();
    setFocusIndex(next);
    refs.current[next]?.focus();
  };

  return { refs, setFocusIndex, tabbable: Math.min(focusIndex, count - 1), onKeyDown };
}
