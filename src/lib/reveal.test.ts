import { afterEach, describe, expect, it, vi } from "vitest";

import { nearestDelta, revealInScroller } from "./reveal";

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("nearestDelta", () => {
  it("does not move what is already in view", () => {
    expect(nearestDelta(20, 40, 0, 100)).toBe(0);
  });

  it("aligns the near edge of what sits above or below", () => {
    expect(nearestDelta(-30, -10, 0, 100)).toBe(-30);
    expect(nearestDelta(110, 130, 0, 100)).toBe(30);
  });

  it("aligns the leading edge of what is larger than the view", () => {
    expect(nearestDelta(50, 250, 0, 100)).toBe(50);
    expect(nearestDelta(-250, 50, 0, 100)).toBe(-50);
    expect(nearestDelta(-10, 150, 0, 100)).toBe(0);
  });
});

function rect(top: number, height: number, left = 0, width = 100): DOMRect {
  return DOMRect.fromRect({ x: left, y: top, width, height });
}

function mountList(): { scroller: HTMLElement; row: HTMLElement } {
  document.body.innerHTML =
    '<div id="scroller" style="overflow-y: auto"><div><div id="row"></div></div></div>';
  const scroller = document.getElementById("scroller") as HTMLElement;
  const row = document.getElementById("row") as HTMLElement;
  vi.spyOn(scroller, "clientHeight", "get").mockReturnValue(100);
  vi.spyOn(scroller, "getBoundingClientRect").mockReturnValue(rect(0, 100));
  return { scroller, row };
}

describe("revealInScroller", () => {
  it("scrolls the nearest scroll container by the least distance", () => {
    const { scroller, row } = mountList();
    vi.spyOn(row, "getBoundingClientRect").mockReturnValue(rect(130, 20));
    const scrollBy = vi.fn();
    scroller.scrollBy = scrollBy;

    revealInScroller(row, "y", "smooth");

    expect(scrollBy).toHaveBeenCalledWith({ top: 50, behavior: "smooth" });
  });

  it("leaves a visible element alone and never calls scrollIntoView", () => {
    const { scroller, row } = mountList();
    vi.spyOn(row, "getBoundingClientRect").mockReturnValue(rect(10, 20));
    const scrollBy = vi.fn();
    scroller.scrollBy = scrollBy;
    const scrollIntoView = vi.spyOn(row, "scrollIntoView");

    revealInScroller(row, "y");

    expect(scrollBy).not.toHaveBeenCalled();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("does nothing when no ancestor scrolls on that axis", () => {
    const { row } = mountList();
    expect(() => revealInScroller(row, "x")).not.toThrow();
  });
});
