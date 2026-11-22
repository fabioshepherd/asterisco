import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: string[] = [];
const download = vi.fn(() => {
  calls.push("download");
  return Promise.resolve();
});
const install = vi.fn(() => {
  calls.push("install");
  return Promise.resolve();
});

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => true }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ ask: vi.fn() }));
vi.mock("@tauri-apps/plugin-updater", () => ({
  check: vi.fn(() => Promise.resolve({ version: "9.9.9", download, install })),
}));
vi.mock("@/features/file-ops/close-window", () => ({ confirmCloseAllDirty: vi.fn() }));
vi.mock("@/lib/tauri/settings-store", () => ({ flushSettings: vi.fn() }));
vi.mock("@/stores/notifications", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));

import { ask } from "@tauri-apps/plugin-dialog";

import { confirmCloseAllDirty } from "@/features/file-ops/close-window";
import { flushSettings } from "@/lib/tauri/settings-store";

import { checkForUpdates } from "./check-updates";

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  vi.mocked(ask).mockResolvedValue(true);
  vi.mocked(confirmCloseAllDirty).mockImplementation(() => {
    calls.push("unsaved");
    return Promise.resolve(true);
  });
  vi.mocked(flushSettings).mockImplementation(() => {
    calls.push("flush");
    return Promise.resolve();
  });
});

describe("checkForUpdates", () => {
  it("runs one check at a time", async () => {
    let answer: (value: boolean) => void = () => undefined;
    vi.mocked(ask).mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          answer = resolve;
        }),
    );
    const first = checkForUpdates();
    await vi.waitFor(() => expect(ask).toHaveBeenCalledTimes(1));
    await checkForUpdates();
    expect(ask).toHaveBeenCalledTimes(1);
    answer(false);
    await first;
  });

  it("reports the end of the check before asking to install", async () => {
    const onChecked = vi.fn(() => calls.push("checked"));
    vi.mocked(ask).mockImplementation(() => {
      calls.push("ask");
      return Promise.resolve(false);
    });
    await checkForUpdates(onChecked);
    expect(calls).toEqual(["checked", "ask"]);
    expect(onChecked).toHaveBeenCalledTimes(1);
  });

  it("resolves unsaved documents and flushes settings after the download, before installing", async () => {
    await checkForUpdates();
    expect(calls).toEqual(["download", "unsaved", "flush", "install"]);
  });

  it("does not install when the user cancels the unsaved-changes prompt", async () => {
    vi.mocked(confirmCloseAllDirty).mockResolvedValue(false);
    await checkForUpdates();
    expect(download).toHaveBeenCalled();
    expect(install).not.toHaveBeenCalled();
    expect(flushSettings).not.toHaveBeenCalled();
  });

  it("does not prompt for unsaved changes when the install is declined", async () => {
    vi.mocked(ask).mockResolvedValue(false);
    await checkForUpdates();
    expect(confirmCloseAllDirty).not.toHaveBeenCalled();
    expect(download).not.toHaveBeenCalled();
    expect(install).not.toHaveBeenCalled();
  });
});
