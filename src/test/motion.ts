import { vi } from "vitest";

/**
 * Force `window.matchMedia` to report a chosen value for
 * `(prefers-reduced-motion: reduce)` (other queries stay `matches: false`).
 * Used to verify motion components reach their final visible state when the OS
 * asks for reduced motion. Shared across the motion-related test suites.
 */
export function mockReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("reduced-motion") ? reduce : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}
