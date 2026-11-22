/** Droppable id of the empty strip space after the last tab. */
export const TAB_STRIP_END = "tab-strip-end";

/**
 * Resolve a drag end into the tab's new index, or null for a no-op: dropped
 * outside the strip, on itself, or on a tab that is no longer open. Dropping
 * on the empty strip space moves the tab to the end.
 */
export function resolveTabDrop(
  tabs: readonly string[],
  activeId: string,
  overId: string | null,
): number | null {
  if (overId == null || overId === activeId) return null;
  const from = tabs.indexOf(activeId);
  if (from < 0) return null;
  if (overId === TAB_STRIP_END) return from === tabs.length - 1 ? null : tabs.length - 1;
  const to = tabs.indexOf(overId);
  if (to < 0) return null;
  return to;
}
