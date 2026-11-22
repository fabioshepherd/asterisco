import { useEffect } from "react";

import { useSettings } from "@/stores/settings";
import { resolveTheme } from "@/stores/theme";

/**
 * Keep `<html data-theme>` in sync with the user's theme
 * preference and the live OS color scheme (when preference is "system").
 *
 * Also toggles a `.dark` class on <html>: the Radix colour scales (accents.css)
 * scope their dark values under `.dark`, so this class is what makes every
 * `var(--scale-N)` resolve to its dark variant. The `data-theme` attribute is
 * kept too — it drives Tailwind's `dark:` variant.
 */
export function useThemeSync(): void {
  const themePreference = useSettings((state) => state.themePreference);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = () => {
      const resolved = resolveTheme(themePreference, media.matches);
      const root = document.documentElement;
      root.dataset.theme = resolved;
      root.classList.toggle("dark", resolved === "dark");
    };

    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [themePreference]);
}
