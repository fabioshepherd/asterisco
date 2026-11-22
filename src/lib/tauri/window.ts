import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow, Window } from "@tauri-apps/api/window";

/** Toggle native window fullscreen (no-op outside the Tauri runtime). */
export async function setWindowFullscreen(value: boolean): Promise<void> {
  if (!isTauri()) return;
  try {
    await getCurrentWindow().setFullscreen(value);
  } catch {
    // Best-effort: distraction-free still hides the in-app chrome.
  }
}

/** Toggle native window fullscreen (no-op outside the Tauri runtime). */
export async function toggleWindowFullscreen(): Promise<void> {
  if (!isTauri()) return;
  try {
    const win = getCurrentWindow();
    await win.setFullscreen(!(await win.isFullscreen()));
  } catch {
    // Best-effort: the menu item simply does nothing.
  }
}

/** Minimize the window (no-op outside the Tauri runtime). */
export async function minimizeWindow(): Promise<void> {
  if (!isTauri()) return;
  try {
    await getCurrentWindow().minimize();
  } catch {
    // Best-effort: the custom title bar control simply does nothing.
  }
}

/** Toggle maximize/restore the window (no-op outside the Tauri runtime). */
export async function toggleMaximizeWindow(): Promise<void> {
  if (!isTauri()) return;
  try {
    await getCurrentWindow().toggleMaximize();
  } catch {
    // Best-effort: the custom title bar control simply does nothing.
  }
}

/** Close the window (no-op outside the Tauri runtime). Honors the close guard
 *  because the Rust side intercepts the close-requested event. */
export async function closeWindow(): Promise<void> {
  if (!isTauri()) return;
  try {
    await getCurrentWindow().close();
  } catch {
    // Best-effort: the custom title bar control simply does nothing.
  }
}

/**
 * Open a print window on the app's print page (`index.html?print=1`) and
 * return its label. Rust creates it, so the frontend holds no permission to
 * open a webview on any other page.
 */
export function openPrintWindow(title: string): Promise<string> {
  return invoke<string>("open_print_window", { title });
}

/** Close a window by label, if it still exists (best-effort). */
export async function closeWindowByLabel(label: string): Promise<void> {
  try {
    await (await Window.getByLabel(label))?.close();
  } catch {
    // Already gone, or outside the Tauri runtime.
  }
}
