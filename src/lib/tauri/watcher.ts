import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

interface FileChangedPayload {
  path: string;
}

/** Start watching a single file for external changes (replaces any previous). */
export function startWatch(path: string): Promise<void> {
  return invoke<void>("start_watch", { path });
}

/** Stop watching. */
export function stopWatch(): Promise<void> {
  return invoke<void>("stop_watch");
}

/** Subscribe to external file-change events. */
export function onFileChanged(handler: (path: string) => void): Promise<UnlistenFn> {
  return listen<FileChangedPayload>("file-changed", (event) => handler(event.payload.path));
}

/** Subscribe to external file-deletion events (file removed/renamed away). */
export function onFileDeleted(handler: (path: string) => void): Promise<UnlistenFn> {
  return listen<FileChangedPayload>("file-deleted", (event) => handler(event.payload.path));
}
