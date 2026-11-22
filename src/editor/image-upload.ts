import { convertFileSrc, isTauri } from "@tauri-apps/api/core";

import i18n from "@/i18n";
import type { AppErrorKind } from "@/lib/tauri/errors";
import { saveImageAsset } from "@/lib/tauri/fs";
import { localizeAppError } from "@/lib/tauri/localize-error";
import { selectActiveDocument, useDocuments } from "@/stores/document";
import { notify } from "@/stores/notifications";

/**
 * Image handling for the Crepe ImageBlock feature.
 *
 * `onUpload` copies a dropped/pasted image into an `assets/` folder next to the
 * current document and links it **relatively** (`./assets/name.png`) so the
 * markdown stays portable. Untitled documents (no path yet) and non-Tauri
 * runtimes fall back to an inline base64 data URI. `proxyDomURL` resolves a
 * stored relative/local path to an `asset:`-protocol URL the WebView can
 * actually display, leaving remote/data URLs untouched.
 */

const REMOTE_OR_INLINE = /^(data:|https?:|asset:|blob:|ipc:)/i;

/** Whether a URL is already loadable as-is (remote, data, asset, blob). */
export function isRemoteOrInline(url: string): boolean {
  return REMOTE_OR_INLINE.test(url);
}

function separator(path: string): string {
  return path.includes("\\") ? "\\" : "/";
}
function dirname(path: string): string {
  return path.replace(/[/\\][^/\\]*$/, "");
}

/** Resolve a relative image path against the document directory to an absolute path. */
export function toAbsolutePath(url: string, docPath: string): string {
  const clean = url.replace(/^\.\//, "");
  const isAbsolute = clean.startsWith("/") || /^[a-zA-Z]:[/\\]/.test(clean);
  return isAbsolute ? clean : `${dirname(docPath)}${separator(docPath)}${clean}`;
}

function activeDocPath(): string | null {
  return selectActiveDocument(useDocuments.getState())?.path ?? null;
}

async function fileToDataUri(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:${file.type || "image/png"};base64,${btoa(binary)}`;
}

/**
 * Largest image copied into `assets/` (25 MiB), as `MAX_IMAGE_BYTES` in
 * `src-tauri/src/commands/assets.rs`. Checked here too, so a huge file is
 * refused before its bytes are serialized for IPC.
 */
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

/**
 * Crepe ImageBlock onUpload: copy into `assets/`, or inline when the doc has no path yet.
 *
 * Crepe only logs a rejected upload, so a failure is reported here as a toast,
 * then rethrown: the image block keeps its placeholder.
 */
export async function uploadImage(file: File): Promise<string> {
  const docPath = activeDocPath();
  if (!isTauri() || !docPath) return fileToDataUri(file);

  try {
    if (file.size > MAX_IMAGE_BYTES) {
      // An Error that also has the AppError shape, so it localizes like the
      // Rust command's own refusal.
      throw Object.assign(
        new Error(`image is ${file.size} bytes; the limit is ${MAX_IMAGE_BYTES}`),
        { kind: "imageTooLarge" satisfies AppErrorKind },
      );
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const relative = await saveImageAsset(docPath, file.name || "image.png", bytes);
    return `./${relative}`;
  } catch (error) {
    notify.error(
      i18n.t("notify.imageSaveFailed", { ns: "editor", error: localizeAppError(error) }),
    );
    throw error;
  }
}

/** Crepe ImageBlock proxyDomURL: make a stored local path displayable. */
export function resolveImageSrc(url: string): string {
  if (!url || isRemoteOrInline(url) || !isTauri()) return url;
  const docPath = activeDocPath();
  if (!docPath) return url;
  return convertFileSrc(toAbsolutePath(url, docPath));
}
