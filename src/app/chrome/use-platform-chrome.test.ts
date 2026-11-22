import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: vi.fn() }));
vi.mock("@tauri-apps/plugin-os", () => ({ platform: vi.fn() }));

import { isTauri } from "@tauri-apps/api/core";
import { platform } from "@tauri-apps/plugin-os";

import { usePlatformChrome } from "./use-platform-chrome";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("usePlatformChrome", () => {
  it("falls back to winlinux outside the Tauri runtime", () => {
    vi.mocked(isTauri).mockReturnValue(false);
    const { result } = renderHook(() => usePlatformChrome());
    expect(result.current.chrome).toBe("winlinux");
  });

  it("reports mac on macOS", () => {
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(platform).mockReturnValue("macos");
    const { result } = renderHook(() => usePlatformChrome());
    expect(result.current.chrome).toBe("mac");
  });

  it("reports winlinux on windows", () => {
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(platform).mockReturnValue("windows");
    const { result } = renderHook(() => usePlatformChrome());
    expect(result.current.chrome).toBe("winlinux");
  });
});
