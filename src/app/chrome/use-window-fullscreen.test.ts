import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { isFullscreen, onResized } = vi.hoisted(() => ({
  isFullscreen: vi.fn(),
  onResized: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ isTauri: vi.fn() }));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ isFullscreen, onResized }),
}));

import { isTauri } from "@tauri-apps/api/core";

import { useWindowFullscreen } from "./use-window-fullscreen";

beforeEach(() => {
  vi.clearAllMocks();
  onResized.mockResolvedValue(() => {});
});

describe("useWindowFullscreen", () => {
  it("reports the window fullscreen state under Tauri", async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    isFullscreen.mockResolvedValue(true);

    const { result } = renderHook(() => useWindowFullscreen());

    await waitFor(() => expect(result.current).toBe(true));
  });

  it("stays false outside the Tauri runtime", () => {
    vi.mocked(isTauri).mockReturnValue(false);

    const { result } = renderHook(() => useWindowFullscreen());

    expect(result.current).toBe(false);
    expect(isFullscreen).not.toHaveBeenCalled();
  });
});
