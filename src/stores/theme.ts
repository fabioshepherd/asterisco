export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

/**
 * Resolve the effective theme from the user's preference and the OS color scheme.
 * Pure and synchronous so it can be unit-tested and reused by the pre-paint bootstrap.
 */
export function resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
  if (preference === "system") {
    return systemDark ? "dark" : "light";
  }
  return preference;
}
