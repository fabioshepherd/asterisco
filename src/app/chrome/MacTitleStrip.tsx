import { TabBar } from "@/features/tabs/TabBar";
import { cn } from "@/lib/utils";

import { useWindowFullscreen } from "./use-window-fullscreen";

/**
 * macOS overlay title strip. A draggable bar that reserves the left inset for
 * the native traffic lights (the window uses `TitleBarStyle::Overlay`) and hosts
 * the tab strip. The empty area drags the window and double-click zooms (handled
 * natively by Tauri's drag region). Rendered only on macOS and hidden in
 * distraction-free mode — see App.tsx.
 */
export function MacTitleStrip() {
  const fullscreen = useWindowFullscreen();
  return (
    <div
      data-tauri-drag-region
      className={cn(
        "flex shrink-0 items-stretch bg-surface",
        // In native fullscreen the traffic lights are gone, so drop the inset and
        // the reserved title-bar height — otherwise an empty band stays on top.
        !fullscreen && "min-h-(--titlebar-height) pl-(--titlebar-mac-inset)",
      )}
    >
      <TabBar />
      {/* Fills the remaining row so empty space stays draggable / double-click zooms. */}
      <div data-tauri-drag-region className="flex-1" />
    </div>
  );
}
