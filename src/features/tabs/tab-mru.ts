/**
 * Most-recently-used ordering for tab cycling.
 *
 * `Ctrl+Tab` walks this order rather than the strip order, Alt+Tab style: the
 * two documents you are working between stay one keystroke apart however many
 * tabs happen to sit between them. Pure functions; the hold-and-release gesture
 * that drives them lives in `use-tab-shortcuts.ts`.
 */

/** Move `id` to the front of a most-recently-used list. */
export function promote(order: readonly string[], id: string): string[] {
  return [id, ...order.filter((other) => other !== id)];
}

/**
 * The walk order for the tab strip: its tabs, most recently used first.
 *
 * Tabs never activated in this session have no place in the MRU list, so they
 * follow in strip order — which is also the whole order on a cold start, making
 * the first `Ctrl+Tab` of a session behave like a plain "next tab". The active
 * document is forced to index 0: it is where the walk starts from, so step 1 is
 * always "the one before this".
 */
export function cycleOrder(
  mru: readonly string[],
  tabs: readonly string[],
  activeId: string | null,
): string[] {
  const recent = mru.filter((id) => tabs.includes(id));
  const order = [...recent, ...tabs.filter((id) => !recent.includes(id))];
  if (activeId === null || !order.includes(activeId)) return order;
  return [activeId, ...order.filter((id) => id !== activeId)];
}
