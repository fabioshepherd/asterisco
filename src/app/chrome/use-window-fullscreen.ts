import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

/**
 * Track whether the OS window is in native fullscreen. macOS hides the title bar
 * (and the traffic lights) in fullscreen, so the overlay title strip must drop
 * its traffic-light inset and reserved height. Re-checks on every resize (the
 * event fullscreen toggles emit). Always `false` outside the Tauri runtime.
 */
export function useWindowFullscreen(): boolean {
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    const win = getCurrentWindow();
    let active = true;
    let unlisten: (() => void) | undefined;

    const sync = () => {
      void win
        .isFullscreen()
        .then((value) => {
          if (active) setFullscreen(value);
        })
        .catch(() => {
          // Best-effort: leave the last known state on failure.
        });
    };

    sync();
    void win.onResized(sync).then((un) => {
      if (active) unlisten = un;
      else un();
    });

    return () => {
      active = false;
      unlisten?.();
    };
  }, []);

  return fullscreen;
}
