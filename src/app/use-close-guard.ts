import { useEffect } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { closeWindowIfConfirmed } from "@/features/file-ops/close-window";

/**
 * Intercept the native window-close request (title-bar X / window close) so
 * dirty documents get the unsaved-changes prompt before the window is
 * destroyed. Without this, the native close bypasses the prompt → silent data
 * loss. Cmd+Q is bound to the custom `quit` menu item and flows through
 * `menu://quit` instead, so it is handled separately by `useMenuEvents`.
 */
export function useCloseGuard(): void {
  useEffect(() => {
    if (!isTauri()) return;

    const unlisten = getCurrentWindow().onCloseRequested(async (event) => {
      event.preventDefault();
      await closeWindowIfConfirmed();
    });

    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);
}
