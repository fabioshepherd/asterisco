import { invoke } from "@tauri-apps/api/core";

// Typed bridge to the custom Rust filesystem commands (src-tauri/src/commands/fs.rs).
// The frontend never touches the filesystem directly; everything flows through here.

export interface DirEntry {
  name: string;
  path: string;
  isDir: boolean;
  /**
   * Generated/vendored folder per the shared policy (`src-tauri/src/fs_policy.rs`).
   * Hidden by default; reported rather than dropped so the tree can tell an
   * empty folder from one holding nothing but build output.
   */
  ignored?: boolean;
}

export function readTextFile(path: string): Promise<string> {
  return invoke<string>("read_text_file", { path });
}

export function writeTextFile(path: string, contents: string): Promise<void> {
  return invoke<void>("write_text_file", { path, contents });
}

export function pathExists(path: string): Promise<boolean> {
  return invoke<boolean>("path_exists", { path });
}

/** One folder, plus what it took to list it (src-tauri/src/commands/fs.rs). */
export interface DirListing {
  /** What is in the folder, up to the cap. */
  entries: DirEntry[];
  /** Everything on disk here — what "empty folder" is measured against. */
  total: number;
  /** How many of `total` were examined; below it, `entries` is a prefix. */
  scanned: number;
}

/**
 * List a folder for the file tree. Generated/vendored entries — and anything
 * the repository's `.gitignore` excludes — come back flagged (`ignored`), for
 * the client to filter; see the Rust command for why.
 *
 * A folder too large to examine in one go reports `scanned < total` rather than
 * handing back a prefix that looks complete.
 *
 * `root` is the workspace folder, needed to assemble the `.gitignore` files
 * between it and `path`. Omitting it means only `path`'s own file applies,
 * which is right for a folder browsed outside a workspace.
 */
export function readDir(path: string, root?: string | null): Promise<DirListing> {
  return invoke<DirListing>("read_dir", { path, root: root ?? null });
}

/** Move a file/folder to the OS trash. Never hard-deletes (CLAUDE.md constraint). */
export function moveToTrash(path: string): Promise<void> {
  return invoke<void>("move_to_trash", { path });
}

/** Create a new empty file. Rejects if the path already exists. */
export function createFile(path: string): Promise<void> {
  return invoke<void>("create_file", { path });
}

/** Rename/move a file or folder. Rejects if the target already exists. */
export function renamePath(from: string, to: string): Promise<void> {
  return invoke<void>("rename_path", { from, to });
}

/**
 * Save an image into an `assets/` folder next to a document. Returns the
 * relative link (`assets/<name>`) to store in the markdown.
 */
export function saveImageAsset(
  docPath: string,
  fileName: string,
  bytes: Uint8Array,
): Promise<string> {
  return invoke<string>("save_image_asset", { docPath, fileName, bytes: Array.from(bytes) });
}
