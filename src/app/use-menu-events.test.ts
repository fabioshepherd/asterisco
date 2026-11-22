import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { runSpy, listeners } = vi.hoisted(() => ({
  runSpy: vi.fn(),
  listeners: new Map<string, (event: unknown) => void>(),
}));

vi.mock("@tauri-apps/api/core", () => ({ isTauri: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn((channel: string, cb: (event: unknown) => void) => {
    listeners.set(channel, cb);
    return Promise.resolve(() => listeners.delete(channel));
  }),
}));
vi.mock("@/app/menu/commands", () => ({
  COMMANDS: {
    "toggle-sidebar": { id: "toggle-sidebar", labelKey: "view.toggleSidebar", run: runSpy },
  },
}));

import { isTauri } from "@tauri-apps/api/core";

import { useMenuEvents } from "./use-menu-events";

beforeEach(() => {
  vi.clearAllMocks();
  listeners.clear();
  vi.mocked(isTauri).mockReturnValue(true);
});

describe("useMenuEvents", () => {
  it("dispatches a menu event to the matching command's run", () => {
    renderHook(() => useMenuEvents());

    const cb = listeners.get("menu://toggle-sidebar");
    expect(cb).toBeDefined();
    cb?.({});

    expect(runSpy).toHaveBeenCalledTimes(1);
  });

  it("does nothing outside the Tauri runtime", () => {
    vi.mocked(isTauri).mockReturnValue(false);

    renderHook(() => useMenuEvents());

    expect(listeners.size).toBe(0);
  });
});
