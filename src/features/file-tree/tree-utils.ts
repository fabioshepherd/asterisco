import type { DirEntry } from "@/lib/tauri/fs";
import type { MarkdownFile } from "@/lib/tauri/workspace";

/**
 * Extensions the app opens as documents — the one list, imported by the open
 * dialog (`file-ops.ts`) and by new-file naming (`file-actions.ts`). Mirrored in
 * `src-tauri/src/fs_policy.rs`, which pins the two together in a test: they used
 * to drift, so the dialog accepted files the tree could not show.
 */
export const MARKDOWN_EXTENSIONS = ["md", "markdown", "mdx", "txt"];

const MARKDOWN_RE = new RegExp(`\\.(${MARKDOWN_EXTENSIONS.join("|")})$`, "i");

export function isMarkdownFile(name: string): boolean {
  return MARKDOWN_RE.test(name);
}

/**
 * Keep only entries worth showing in the tree — directories and documents,
 * sorted with directories first, then alphabetically.
 *
 * *Which* directories count as noise is decided in Rust (`fs_policy`), which
 * flags each entry; this only applies the user's setting, so toggling it
 * re-filters in memory instead of re-reading the disk. The axis is "ignored",
 * not "hidden": `.github`, `.claude` and `.cursor` hold the agent files this
 * product exists for, so they are ordinary folders here, while `node_modules`
 * and `target` are not.
 */
export function visibleEntries(entries: DirEntry[], showIgnored = false): DirEntry[] {
  return entries
    .filter(
      (entry) => (showIgnored || !entry.ignored) && (entry.isDir || isMarkdownFile(entry.name)),
    )
    .sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

/**
 * What a document is *for*, as far as this panel can tell from its name.
 *
 * `fs_policy.rs` already refuses to hide `.claude`, `.github` and `.cursor`
 * because that is where the agent files live — the reason PRODUCT.md gives for
 * the product existing. Until now none of that reached the eye: `CLAUDE.md` and
 * `notes.txt` were the same row with the same glyph. This is the presentation
 * half of that judgment, and it stays on this side of the wire because it
 * changes an icon and a weight, never what is read, walked or opened.
 */
export type DocumentKind = "agent" | "readme" | "document";

/**
 * Briefs written for an AI agent rather than prose written for a person. The
 * names are the conventions the tools themselves read (`CLAUDE.md`,
 * `AGENTS.md`, a skill's `SKILL.md`, GitHub Copilot's instructions file).
 */
const AGENT_FILE =
  /^(claude|agents?|gemini|copilot-instructions|skill)(\.local)?\.(md|markdown|mdx)$/i;

/**
 * Folders that are agent instructions by construction: everything a tool keeps
 * in `.claude/` or `.cursor/` is addressed to it. `.github/` is deliberately not
 * here — most of it is issue templates and workflows, written for people.
 */
const AGENT_FOLDER = /[/\\]\.(claude|cursor)[/\\]/;

/** The door into a folder: the file you read first, and the one a repo advertises. */
const README = /^readme(\.|$)/i;

export function documentKind(name: string, path: string): DocumentKind {
  if (AGENT_FILE.test(name) || AGENT_FOLDER.test(path)) return "agent";
  if (README.test(name)) return "readme";
  return "document";
}

/** Row indent for a nesting depth — one ladder, so state rows line up with files. */
/**
 * A treeitem `<li>`: no outline of its own; the focus ring is drawn inset on its
 * direct row only. A `group-focus-visible` variant would ring every descendant
 * row too, because nested rows sit inside the same `<li>`.
 */
export const treeItemClass =
  "block outline-none [&:focus-visible>div]:outline-2 [&:focus-visible>div]:-outline-offset-2 [&:focus-visible>div]:outline-[var(--ring)]";

export function indentStyle(level: number): { paddingInlineStart: string } {
  return { paddingInlineStart: `${level * 0.75 + 0.5}rem` };
}

/**
 * A path as the panel talks about it: relative to the workspace, with the root
 * folder itself naming itself rather than collapsing to an empty string.
 */
export function relativeTo(root: string | null, path: string): string {
  if (!root || !path.startsWith(root)) return path;
  const rest = path.slice(root.length).replace(/^[/\\]/, "");
  return rest === "" ? baseName(root) : rest;
}

/** The file name of a workspace-relative document path. */
export function baseName(relativePath: string): string {
  return relativePath.split(/[/\\]/).pop() ?? relativePath;
}

/** The folders leading to a document, or "" for one sitting at the root. */
export function parentSegments(relativePath: string): string {
  const cut = Math.max(relativePath.lastIndexOf("/"), relativePath.lastIndexOf("\\"));
  return cut === -1 ? "" : relativePath.slice(0, cut + 1);
}

/**
 * How many filtered rows are rendered at once.
 *
 * Neither list here is virtualized, and that is a decision rather than an
 * omission: the tree only ever mounts the branches that are open, `read_dir`
 * caps one folder at 2,000 entries, and the workspace index behind this filter
 * caps at 5,000 documents. A windowing layer would buy nothing against those
 * bounds and would cost the two things this panel is built on — arrow
 * navigation and typeahead walk the rendered rows in DOM order, and the
 * WAI-ARIA tree contract computes level, position and set size from the DOM.
 *
 * The cap that remains is this one, and the summary reports what it left out
 * rather than hiding it.
 */
const FILTER_ROW_LIMIT = 200;

export interface DocumentMatches {
  rows: MarkdownFile[];
  /** Documents that matched, before the render cap. */
  total: number;
  /** `rows` is shorter than `total`. */
  capped: boolean;
}

/**
 * Narrow the workspace's documents to the ones whose relative path contains
 * `query`, case-insensitively.
 *
 * Plain substring, not fuzzy: this is a *filter*, and a filter that quietly
 * matches letters scattered across a path makes its own result hard to explain.
 * Name hits are listed before path-only hits, because someone typing "readme"
 * wants `README.md` before `docs/readme-assets/notes.md`.
 */
export function filterDocuments(
  files: MarkdownFile[],
  query: string,
  limit = FILTER_ROW_LIMIT,
): DocumentMatches {
  const needle = query.trim().toLowerCase();
  if (needle === "") return { rows: files.slice(0, limit), total: files.length, capped: false };

  const nameHits: MarkdownFile[] = [];
  const pathHits: MarkdownFile[] = [];
  for (const file of files) {
    if (baseName(file.name).toLowerCase().includes(needle)) nameHits.push(file);
    else if (file.name.toLowerCase().includes(needle)) pathHits.push(file);
  }
  const matched = nameHits.concat(pathHits);
  return {
    rows: matched.slice(0, limit),
    total: matched.length,
    capped: matched.length > limit,
  };
}
