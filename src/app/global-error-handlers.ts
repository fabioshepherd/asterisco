import { log } from "@/lib/log";

let installed = false;

/**
 * Registers global listeners for uncaught errors and unhandled promise
 * rejections so failures outside React's render path are still surfaced
 * (instead of silently lost). Idempotent: safe to call more than once.
 */
export function installGlobalErrorHandlers(): void {
  if (installed) return;
  installed = true;

  window.addEventListener("error", (event) => {
    // Benign browser signal: the engine deferred ResizeObserver callbacks to the
    // next frame. It self-heals and is not catchable per-observer, so ignore it
    // instead of surfacing it as an uncaught error.
    if (event.message?.startsWith("ResizeObserver loop")) return;
    log.error("[global] uncaught error", event.error ?? event.message);
  });

  window.addEventListener("unhandledrejection", (event) => {
    log.error("[global] unhandled promise rejection", event.reason);
  });
}
