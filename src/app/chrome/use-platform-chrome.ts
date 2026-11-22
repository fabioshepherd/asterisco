import { currentPlatform } from "@/app/platform";

/** Which chrome layout a component should render. */
export type Chrome = "mac" | "winlinux";

/**
 * Collapse the OS into the two chrome layouts the app ships: the macOS overlay
 * title strip, or the custom Windows/Linux title bar. Lets components branch
 * once instead of repeating platform checks.
 */
export function usePlatformChrome(): { chrome: Chrome } {
  return { chrome: currentPlatform() === "mac" ? "mac" : "winlinux" };
}
