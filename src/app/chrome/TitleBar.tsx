import { toggleMaximizeWindow } from "@/lib/tauri/window";

import { AppMenubar } from "./AppMenubar";
import { WindowControls } from "./WindowControls";

/**
 * Custom title bar for the frameless Windows/Linux window: the app menubar on
 * the left, a draggable spacer in the middle, and the window controls on the
 * right. Rendered only on Windows/Linux and hidden in distraction-free mode —
 * see App.tsx.
 */
export function TitleBar() {
  return (
    <div
      data-tauri-drag-region
      className="flex min-h-(--titlebar-height) shrink-0 items-stretch border-b border-border bg-surface"
    >
      <div className="flex items-center px-1">
        <AppMenubar />
      </div>
      {/* Empty space drags the window; double-click toggles maximize. If Tauri's
          native drag-region double-click also fires (double-toggle), drop this handler. */}
      <div
        data-tauri-drag-region
        className="flex-1"
        onDoubleClick={() => void toggleMaximizeWindow()}
      />
      <WindowControls />
    </div>
  );
}
