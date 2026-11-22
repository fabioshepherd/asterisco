import { openUrl } from "@tauri-apps/plugin-opener";

import { openPath } from "@/features/file-ops/file-ops";
import { isMarkdownFile } from "@/features/file-tree/tree-utils";
import { log } from "@/lib/log";

/**
 * Link clicks in a document. Left alone, a click on an `<a href>` navigates the
 * app window itself (a web page loads inside the app, a relative link reloads
 * it, unsaved edits are lost). Instead, on an explicit click:
 * - `http(s):` and `mailto:` open in the system browser / mail app;
 * - a relative link to a Markdown file opens that file in a tab;
 * - a same-document `#anchor` is left to the page (it only scrolls);
 * - anything else does nothing.
 * The Rust navigation guard (src-tauri/src/navigation.rs) is the backstop.
 */

export type LinkTarget =
  | { kind: "web"; url: string }
  | { kind: "markdown"; path: string }
  | { kind: "fragment" }
  | { kind: "none" };

const WEB_SCHEMES = new Set(["http", "https", "mailto"]);
const SCHEME = /^([a-z][a-z\d+.-]*):/i;
const DRIVE = /^[a-z]:[/\\]/i;

function resolveRelative(docPath: string, relative: string): string {
  const separator = docPath.includes("\\") ? "\\" : "/";
  const parts = docPath.split(/[/\\]/).slice(0, -1);
  // `..` never climbs above the root: `/` (or `C:`), or for a UNC path
  // (`\\server\share`) the share itself, so a link cannot reach another host.
  const root = /^[/\\]{2}[^/\\]/.test(docPath) ? 4 : 1;
  for (const segment of relative.split(/[/\\]/)) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (parts.length > root) parts.pop();
    } else {
      parts.push(segment);
    }
  }
  return parts.join(separator);
}

/** Decide what a click on `href` (the raw attribute) in the document at `docPath` does. */
export function classifyLink(href: string, docPath: string | null): LinkTarget {
  const raw = href.trim();
  if (raw.startsWith("#")) return { kind: "fragment" };

  const scheme = SCHEME.exec(raw)?.[1]?.toLowerCase();
  if (scheme && !DRIVE.test(raw)) {
    if (!WEB_SCHEMES.has(scheme)) return { kind: "none" };
    // Normalized (lower-case scheme, …): the opener's URL scope is case-sensitive.
    try {
      return { kind: "web", url: new URL(raw).href };
    } catch {
      return { kind: "none" };
    }
  }

  // A path: only relative ones, resolved against the document's folder.
  if (!docPath || raw.startsWith("/") || raw.startsWith("\\") || DRIVE.test(raw)) {
    return { kind: "none" };
  }
  let relative = raw.replace(/[?#].*$/, "");
  try {
    relative = decodeURIComponent(relative);
  } catch {
    // Not percent-encoded after all: use it as written.
  }
  if (!isMarkdownFile(relative)) return { kind: "none" };
  return { kind: "markdown", path: resolveRelative(docPath, relative) };
}

interface LinkClickContext {
  /** Reading view: a plain click follows the link. */
  reading: boolean;
  /** The document's own path; `null` while it is untitled. */
  docPath: string | null;
}

/**
 * Click handler for the document area. While editing, a plain click only
 * places the caret; Ctrl/Cmd-click follows the link, as in Reading view.
 */
export function handleDocumentLinkClick(event: MouseEvent, context: LinkClickContext): void {
  if (!(event.target instanceof Element)) return;
  const anchor = event.target.closest("a[href]");
  if (!anchor) return;
  if (!context.reading && !event.ctrlKey && !event.metaKey) return;

  const target = classifyLink(anchor.getAttribute("href") ?? "", context.docPath);
  if (target.kind === "fragment") return;
  // Also keeps the opener plugin's own link handler from acting on it.
  event.preventDefault();

  if (target.kind === "web") {
    openUrl(target.url).catch((error: unknown) => log.warn("Failed to open link", error));
  } else if (target.kind === "markdown") {
    void openPath(target.path);
  }
}
