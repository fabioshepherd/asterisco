/**
 * One-shot "jump to a line" request, set when opening a workspace-search result
 * and consumed by the source-mode editor when it next mounts.
 */
let pendingLine: number | null = null;

export function setPendingJumpLine(line: number | null): void {
  pendingLine = line;
}

export function consumePendingJumpLine(): number | null {
  const line = pendingLine;
  pendingLine = null;
  return line;
}
