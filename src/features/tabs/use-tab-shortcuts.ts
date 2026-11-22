import { useEffect, useRef } from "react";

import { actionForCombo, eventToCombo } from "@/features/settings/keybindings";
import { useDocuments } from "@/stores/document";

import { cycleOrder, promote } from "./tab-mru";

/** A walk in progress: the order snapshotted when it began, and how far in. */
interface Cycle {
  order: string[];
  step: number;
}

/**
 * Keyboard navigation between the open tabs.
 *
 * `Ctrl+Tab` walks the tabs' most-recently-used order, Alt+Tab style: hold the
 * modifier and press Tab again to go further back, release it to commit. Only
 * the commit reorders the MRU list, which is what makes a walk repeatable — go
 * three back, release, and `Ctrl+Tab` returns you to where you started.
 * `Ctrl+Shift+Tab` walks the other way. There is no select-by-position:
 * `mod+1…6` set Heading 1–6, and one combo has one owner.
 *
 * Deliberately not part of the customizable keymap: that dispatcher fires one
 * action per keystroke, and the walk needs the whole press-hold-release gesture
 * to know when it ended. These combos are declared in `fixed-shortcuts.ts`, so
 * the settings list prints them and the recorder refuses them. The keymap is
 * still consulted first, as a guard: should a user binding ever hold one of
 * these combos, it must win rather than be silently shadowed here.
 */
export function useTabShortcuts(): void {
  const mru = useRef<string[]>([]);
  const cycle = useRef<Cycle | null>(null);

  // Record every activation, except the intermediate steps of a walk.
  useEffect(() => {
    const seed = useDocuments.getState().activeId;
    if (seed) mru.current = promote(mru.current, seed);
    return useDocuments.subscribe((state, previous) => {
      if (cycle.current || !state.activeId || state.activeId === previous.activeId) return;
      mru.current = promote(mru.current, state.activeId);
    });
  }, []);

  useEffect(() => {
    // Releasing the modifier ends the walk and commits wherever it landed.
    const endCycle = () => {
      if (!cycle.current) return;
      cycle.current = null;
      const { activeId } = useDocuments.getState();
      if (activeId) mru.current = promote(mru.current, activeId);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const combo = eventToCombo(event);
      if (!combo || actionForCombo(combo)) return; // an explicit user binding wins
      const { tabs, activeId, setActiveDocument } = useDocuments.getState();
      if (combo !== "mod+tab" && combo !== "mod+shift+tab") return;
      if (tabs.length < 2) return;
      event.preventDefault();
      const walk: Cycle = cycle.current ?? {
        order: cycleOrder(mru.current, tabs, activeId),
        step: 0,
      };
      const step = (walk.step + (event.shiftKey ? -1 : 1) + walk.order.length) % walk.order.length;
      cycle.current = { order: walk.order, step };
      const id = walk.order[step];
      if (id) setActiveDocument(id);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) endCycle();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    // A modifier released while the window is not focused never reaches us; the
    // walk must not survive into the next visit as a stale snapshot.
    window.addEventListener("blur", endCycle);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", endCycle);
    };
  }, []);
}
