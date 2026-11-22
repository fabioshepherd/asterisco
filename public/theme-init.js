// Pre-paint theme bootstrap. Keep in sync with src/stores/settings.ts
// (THEME_PREF_KEY, LANGUAGE_KEY), src/features/themes/accents.ts (ACCENT_KEY) and
// src/features/themes/neutrals.ts (NEUTRAL_KEY).
// Reads localStorage mirrors of the persisted theme preference, accent and
// neutral and applies them before React mounts, so there is no flash of the
// wrong palette:
//  - data-theme + the `.dark` class (the latter makes Radix dark scales resolve)
//  - data-accent (accents.css re-points the accent tokens; an unknown value
//    simply falls back to the :root default = orange)
//  - data-neutral (neutrals.css re-points the neutral tokens; an unknown value
//    simply falls back to the :root default = gray)
//  - lang (the mirrored UI language, so the page is not announced as English
//    to an Italian user before the settings store loads; WCAG 3.1.1)
(function () {
  var root = document.documentElement;
  try {
    var pref = localStorage.getItem("asterisco.theme-pref") || "system";
    var systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var dark = pref === "dark" || (pref === "system" && systemDark);
    root.dataset.theme = dark ? "dark" : "light";
    root.classList.toggle("dark", dark);
    root.dataset.accent = localStorage.getItem("asterisco.accent") || "orange";
    root.dataset.neutral = localStorage.getItem("asterisco.neutral") || "gray";
    var language = localStorage.getItem("asterisco.language");
    if (language === "it" || language === "en") root.lang = language;
  } catch {
    root.dataset.theme = "light";
    root.dataset.accent = "orange";
    root.dataset.neutral = "gray";
  }
})();
