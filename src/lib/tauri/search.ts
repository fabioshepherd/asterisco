import { invoke } from "@tauri-apps/api/core";

export interface SearchMatch {
  /** 1-based line number. */
  line: number;
  /** 1-based column of the first match on the line. */
  column: number;
  /** Trimmed line text for preview. */
  text: string;
}

export interface SearchFileResult {
  /** Path relative to the workspace root (display label). */
  name: string;
  /** Absolute path on disk. */
  path: string;
  matches: SearchMatch[];
}

export interface SearchResults {
  files: SearchFileResult[];
  /**
   * A limit stopped the scan: the 5000-file cap, the 2000-match cap, the
   * 100-per-file cap, a file too large to read, or an unreadable folder below
   * the root (an unreadable root is an error instead). The counts are then a
   * floor, and the summary must not print them as the total.
   */
  truncated: boolean;
}

/**
 * Full-text search of all markdown files under `root` (handled in Rust).
 * `showIgnored` mirrors the file tree's setting, so search reaches everything
 * the tree lists and nothing it hides.
 */
export function searchWorkspace(
  root: string,
  query: string,
  caseSensitive: boolean,
  showIgnored = false,
): Promise<SearchResults> {
  return invoke<SearchResults>("search_workspace", {
    root,
    query,
    caseSensitive,
    showIgnored,
  });
}
