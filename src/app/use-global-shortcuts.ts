import { useEffect } from "react";

import { COMMANDS } from "@/app/menu/commands";
import { currentPlatform } from "@/app/platform";
import { actionForCombo, eventToCombo } from "@/features/settings/keybindings";

/**
 * Browser accelerators WebView2 acts on by itself ("save page", "print page",
 * which would print the app's own chrome). Suppressed off macOS whatever the
 * keymap holds, so unbinding or reassigning Save or Print never lets them through.
 */
const WEBVIEW_PAGE_COMBOS = new Set(["mod+s", "mod+p"]);

/**
 * The one window-level dispatcher for the customizable keymap, File/app
 * shortcuts (New, Open, Save, Print, Close Tab, Quit, …) included.
 *
 * Off macOS there is no native menu, so this is the only place those keys fire;
 * `preventDefault` also stops WebView2 from treating Ctrl+S / Ctrl+P as "save
 * page" / "print page". On macOS the native menu registers the same bindings as
 * key-equivalents and consumes them before the webview, so nothing double-fires.
 * Only combos with a modifier (mod/alt) fire, so plain typing never triggers one.
 */
export function useGlobalShortcuts(): void {
  useEffect(() => {
    const suppressPageKeys = currentPlatform() !== "mac";
    const handler = (event: KeyboardEvent) => {
      const combo = eventToCombo(event);
      if (!combo || (!combo.includes("mod") && !combo.includes("alt"))) return;
      if (suppressPageKeys && WEBVIEW_PAGE_COMBOS.has(combo)) event.preventDefault();
      const action = actionForCombo(combo);
      if (action) {
        event.preventDefault();
        void COMMANDS[action.command].run();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
