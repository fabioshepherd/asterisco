import { invoke } from "@tauri-apps/api/core";

export interface MarkdownFile {
  /** Path relative to the workspace root (display label). */
  name: string;
  /** Absolute path on disk. */
  path: string;
}

export interface MarkdownIndex {
  files: MarkdownFile[];
  /**
   * The walk stopped at its 5000-file cap, so `files` is a prefix of the
   * workspace sorted to look like all of it. Anything rendering this list has
   * to say so — an A→Z list that quietly ends early is a false statement about
   * what the workspace contains.
   */
  truncated: boolean;
  /**
   * Folders the walk could not open. One of them used to abort the whole index,
   * so a single locked subdirectory removed filtering and quick-open from an
   * otherwise readable workspace. They are stepped over and counted now, and
   * the count has to be reported for the same reason `truncated` does.
   */
  skipped: number;
}

/**
 * Recursively list markdown files under a folder, for quick-open. `showIgnored`
 * mirrors the file tree's setting so the palette offers exactly what the tree
 * shows — agent files under `.github`/`.claude` included.
 */
export function listMarkdownFiles(root: string, showIgnored = false): Promise<MarkdownIndex> {
  return invoke<MarkdownIndex>("list_markdown_files", { root, showIgnored });
}

/**
 * The project a path belongs to (nearest ancestor with `.git`, `package.json`,
 * `Cargo.toml`, …), falling back to its own folder. Used when the app is
 * launched from a file so the sidebar isn't empty on the way in.
 */
export function findProjectRoot(path: string): Promise<string | null> {
  return invoke<string | null>("find_project_root", { path });
}
