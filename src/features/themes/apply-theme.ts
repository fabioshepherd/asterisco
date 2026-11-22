const USER_THEME_STYLE_ID = "asterisco-user-theme";

/** Find or create a `<style>` element (kept at the end of <head> so it wins). */
function ensureStyle(id: string): HTMLStyleElement {
  let el = document.getElementById(id) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = id;
    document.head.appendChild(el);
  }
  return el;
}

/**
 * Sanitize a user-supplied theme stylesheet before injecting it: strip `@import`
 * rules and remote `url(http…)` references so a custom theme can't pull in or
 * exfiltrate to the network (defense in depth on top of the CSP).
 */
export function sanitizeThemeCss(css: string): string {
  return css.replace(/@import[^;]*;?/gi, "").replace(/url\(\s*(['"]?)\s*https?:[^)]*\)/gi, "none");
}

/** Apply (or clear, with null) a user custom CSS theme. */
export function applyCustomThemeCss(css: string | null): void {
  ensureStyle(USER_THEME_STYLE_ID).textContent = css ? sanitizeThemeCss(css) : "";
}
