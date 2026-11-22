import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isTauri } from "@tauri-apps/api/core";
import { error as pluginError, warn as pluginWarn } from "@tauri-apps/plugin-log";

import { log } from "./log";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: vi.fn() }));
vi.mock("@tauri-apps/plugin-log", () => ({
  debug: vi.fn(() => Promise.resolve()),
  info: vi.fn(() => Promise.resolve()),
  warn: vi.fn(() => Promise.resolve()),
  error: vi.fn(() => Promise.resolve()),
}));

const isTauriMock = vi.mocked(isTauri);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("log wrapper", () => {
  it("falls back to console.* outside Tauri", () => {
    isTauriMock.mockReturnValue(false);
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

    log.warn("x");

    expect(consoleWarn).toHaveBeenCalledWith("x");
    expect(pluginWarn).not.toHaveBeenCalled();
  });

  it("forwards to the plugin inside Tauri", () => {
    isTauriMock.mockReturnValue(true);
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

    log.warn("x");

    expect(pluginWarn).toHaveBeenCalledWith("x");
    expect(consoleWarn).not.toHaveBeenCalled();
  });

  it("stringifies extra args into the single plugin message", () => {
    isTauriMock.mockReturnValue(true);

    log.error("boom", new Error("disk full"), { code: 5 });

    expect(pluginError).toHaveBeenCalledTimes(1);
    const line = vi.mocked(pluginError).mock.calls[0]?.[0] ?? "";
    expect(line).toContain("boom");
    expect(line).toContain("disk full");
    expect(line).toContain('{"code":5}');
  });

  it("swallows plugin rejections so logging never throws", async () => {
    isTauriMock.mockReturnValue(true);
    vi.mocked(pluginWarn).mockRejectedValueOnce(new Error("plugin down"));

    expect(() => log.warn("x")).not.toThrow();
    // Let the rejected promise's .catch settle without an unhandled rejection.
    await Promise.resolve();
  });
});
