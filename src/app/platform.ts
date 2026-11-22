import { isTauri } from "@tauri-apps/api/core";
import { platform } from "@tauri-apps/plugin-os";

import type { Platform } from "@/app/menu/menu-model";

/**
 * The current OS as the menu model's {@link Platform}. Outside the Tauri runtime
 * (web preview, unit tests, Playwright) it resolves to `"linux"` so the custom
 * Windows/Linux chrome path is exercised rather than the macOS one.
 */
export function currentPlatform(): Platform {
  if (!isTauri()) return "linux";
  const p = platform();
  return p === "macos" ? "mac" : p === "windows" ? "win" : "linux";
}
