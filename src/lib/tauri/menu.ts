import { invoke } from "@tauri-apps/api/core";
import type { SpecSection } from "./menu-spec";

/** Rebuild and swap the native application menu from a localized spec. */
export function setAppMenu(spec: SpecSection[]): Promise<void> {
  return invoke<void>("set_app_menu", { spec });
}
