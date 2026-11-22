export type DropPhase = "idle" | "valid";

export interface DropState {
  phase: DropPhase;
}

/** Extensions opened directly as text (mirrors file-ops' markdown filter). */
const MARKDOWN_EXTENSIONS = ["md", "markdown", "mdx", "txt"];

export type DropRoute = "open" | "ignore";

/**
 * Decide what to do with a file dropped on the window: open it as text
 * (markdown) or ignore it (anything else). Pure so the dispatch logic is
 * unit-tested without the drag-and-drop event plumbing.
 */
export function routeDroppedPath(path: string): DropRoute {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return MARKDOWN_EXTENSIONS.includes(ext) ? "open" : "ignore";
}
