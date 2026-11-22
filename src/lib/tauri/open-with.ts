import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

/**
 * Files the OS handed the app: a double click, an "Open with", a path on the
 * command line, or a second launch while a window is already open.
 *
 * Rust queues them (see `commands/open_with.rs`) because they can arrive before
 * the webview exists. The event carries no payload — it only says "there is
 * something to drain" — so the queue stays the single source of truth and the
 * same code path handles a cold launch and a later double-click.
 */
export async function takePendingFiles(): Promise<string[]> {
  if (!isTauri()) return [];
  try {
    return await invoke<string[]>("take_pending_files");
  } catch {
    return [];
  }
}

/** Subscribe to "the OS handed us files"; the handler drains the queue. */
export function onFilesPending(handler: () => void): Promise<UnlistenFn> {
  // Outside the Tauri runtime (browser dev, tests) there is nothing to listen
  // to; hand back a no-op so callers can unsubscribe unconditionally.
  if (!isTauri()) return Promise.resolve(() => {});
  return listen("files-pending", () => handler());
}
