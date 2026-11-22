import { useEffect } from "react";
import { isTauri } from "@tauri-apps/api/core";

import { currentPlatform } from "@/app/platform";
import { useKeybindings } from "@/features/settings/keybindings";
import i18n from "@/i18n";
import { setAppMenu } from "@/lib/tauri/menu";
import { buildMenuSpec } from "@/lib/tauri/menu-spec";

/**
 * Keep the native menu in sync with the UI language and the keymap. Builds the
 * localized, platform-filtered spec from the menu model on mount and rebuilds it
 * on every language change and every keybinding change (the File/app items'
 * key-equivalents are keymap bindings). The startup menu (the minimal macOS bridge built in Rust) is
 * replaced as soon as this hook runs.
 *
 * macOS only. There the menu bar belongs to the OS, so a native menu is the only
 * way to have one; on Windows/Linux `src/app/chrome/AppMenubar` is the app menu
 * and a native one would both draw a second menu bar and register accelerators
 * that outrank the customizable in-app keymap. The backend refuses to install one
 * off macOS too (see `set_app_menu`) — this early return just saves the round
 * trip. No-op outside the Tauri runtime.
 */
export function useNativeMenu(): void {
  useEffect(() => {
    if (!isTauri()) return;
    if (currentPlatform() !== "mac") return;

    // labelKeys come from the menu model (validated by menu-model tests); the
    // strongly-typed getFixedT signature can't see they are valid menu keys.
    const t = i18n.getFixedT(null, "menu") as unknown as (key: string) => string;
    const push = () => void setAppMenu(buildMenuSpec("mac", t, useKeybindings.getState().bindings));
    push();
    i18n.on("languageChanged", push);
    const unsubscribe = useKeybindings.subscribe((state, previous) => {
      if (state.bindings !== previous.bindings) push();
    });
    return () => {
      i18n.off("languageChanged", push);
      unsubscribe();
    };
  }, []);
}
