import { isAppError } from "@/lib/tauri/errors";

/** Reason a typed stem is not committable, or null when it is valid. */
export type StemProblem = "empty" | "invalidChars" | "unchanged";

/** Characters disallowed in file names across the platforms we support. */
const ILLEGAL_CHARS = /[/\\:*?"<>|]/;

/** Split a file name into stem + extension at the LAST dot. A leading-dot
 *  dotfile (".gitignore") and an extension-less name are all stem. */
export function splitName(fileName: string): { stem: string; ext: string } {
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0) return { stem: fileName, ext: "" };
  return { stem: fileName.slice(0, dot), ext: fileName.slice(dot) };
}

/** Validate a typed stem against the original. Returns the problem, or null. */
export function validateStem(draft: string, originalStem: string): StemProblem | null {
  const trimmed = draft.trim();
  if (trimmed.length === 0) return "empty";
  if (ILLEGAL_CHARS.test(trimmed)) return "invalidChars";
  if (trimmed === originalStem) return "unchanged";
  return null;
}

function separator(path: string): string {
  return path.includes("\\") ? "\\" : "/";
}

/** Directory portion of a path (everything before the last separator). */
function dirname(path: string): string {
  return path.replace(/[/\\][^/\\]*$/, "");
}

/** Rebuild a sibling path: same directory, new (trimmed) stem, original ext. */
export function buildTargetPath(oldPath: string, newStem: string, ext: string): string {
  const dir = dirname(oldPath);
  return `${dir}${separator(oldPath)}${newStem.trim()}${ext}`;
}

/** i18n keys (under the `editor` namespace) a backend rename failure maps to. */
type RenameErrorKey = "tabs.rename.exists" | "tabs.rename.notFound" | "tabs.rename.failed";

/** Map a rename failure to an i18n key and whether to keep the field open. */
export function mapRenameError(error: unknown): { key: RenameErrorKey; keepOpen: boolean } {
  if (isAppError(error)) {
    if (error.kind === "alreadyExists") return { key: "tabs.rename.exists", keepOpen: true };
    if (error.kind === "notFound") return { key: "tabs.rename.notFound", keepOpen: false };
  }
  return { key: "tabs.rename.failed", keepOpen: false };
}
