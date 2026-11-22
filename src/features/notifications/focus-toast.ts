/** Id of the toast stack's region. */
export const TOASTS_ID = "notifications";

/**
 * Put keyboard focus on the newest toast's first control (its action, else its
 * dismiss button; both are described by the message). Sticky toasts — errors,
 * Retry/Undo — wait for the user, and sit last in the DOM where forward Tab
 * never reaches them. Deferred a frame, like `focusFileTree`, so a closing
 * palette has let go of focus first.
 */
export function focusNewestToast(): void {
  requestAnimationFrame(() => {
    const toasts = document.getElementById(TOASTS_ID)?.querySelectorAll("[data-toast]");
    toasts?.[toasts.length - 1]?.querySelector<HTMLElement>("button")?.focus();
  });
}
