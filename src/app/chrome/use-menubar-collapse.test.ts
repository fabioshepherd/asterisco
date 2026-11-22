import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMenubarCollapse } from "./use-menubar-collapse";

let triggerResize: (width: number) => void;

class ResizeObserverStub {
  private readonly cb: ResizeObserverCallback;
  constructor(cb: ResizeObserverCallback) {
    this.cb = cb;
    triggerResize = (width: number) => {
      this.cb([{ contentRect: { width } } as ResizeObserverEntry], this);
    };
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useMenubarCollapse", () => {
  it("collapses below the width threshold and expands above it", () => {
    const { result } = renderHook(() => useMenubarCollapse(720));
    expect(result.current).toBe(false);

    act(() => triggerResize(500));
    expect(result.current).toBe(true);

    act(() => triggerResize(900));
    expect(result.current).toBe(false);
  });
});
