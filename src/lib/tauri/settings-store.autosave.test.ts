import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A stand-in for the store plugin that models its documented auto-save
 * contract (2.5.x): with `autoSave: <ms>`, every modification (re)starts one
 * debounce timer and the file is written when it fires; `save()` writes now.
 */
const fake = vi.hoisted(() => {
  const state = { writes: 0, loadOptions: undefined as unknown, data: new Map<string, unknown>() };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const touch = (autoSave: unknown): void => {
    if (typeof autoSave !== "number" && autoSave !== true && autoSave !== undefined) return;
    const delay = typeof autoSave === "number" ? autoSave : 100;
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      state.writes += 1;
    }, delay);
  };
  const load = (_path: string, options: { autoSave?: boolean | number }) => {
    state.loadOptions = options;
    return Promise.resolve({
      get: (key: string) => Promise.resolve(state.data.get(key)),
      set: (key: string, value: unknown) => {
        state.data.set(key, value);
        touch(options.autoSave);
        return Promise.resolve();
      },
      delete: (key: string) => {
        state.data.delete(key);
        touch(options.autoSave);
        return Promise.resolve(true);
      },
      save: () => {
        state.writes += 1;
        return Promise.resolve();
      },
    });
  };
  return { state, load };
});

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => true }));
vi.mock("@tauri-apps/plugin-store", () => ({ load: fake.load }));

import { flushSettings, saveUiPrefs } from "./settings-store";

describe("settings store writes", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fake.state.writes = 0;
    fake.state.data.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces a burst of sidebar width changes into one file write", async () => {
    for (let i = 0; i < 50; i += 1) await saveUiPrefs({ sidebarWidth: 200 + i });
    await vi.runAllTimersAsync();
    expect(fake.state.writes).toBe(1);
    expect(fake.state.data.get("sidebarWidth")).toBe(249);
  });

  it("writes only the UI preference it is given", async () => {
    fake.state.data.set("outlineVisible", false);
    await saveUiPrefs({ sidebarWidth: 300 });
    expect(fake.state.data.get("outlineVisible")).toBe(false);
  });
});

describe("flushSettings", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fake.state.writes = 0;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes a change still inside the debounce window right away", async () => {
    await saveUiPrefs({ sidebarWidth: 321 });
    expect(fake.state.writes).toBe(0);
    await flushSettings();
    expect(fake.state.writes).toBe(1);
  });
});
