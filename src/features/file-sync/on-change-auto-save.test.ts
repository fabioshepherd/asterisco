import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSettings } from "@/stores/settings";

import {
  cancelOnChangeSave,
  flushOnChangeNow,
  ON_CHANGE_DEBOUNCE_MS,
  scheduleOnChangeSave,
} from "./on-change-auto-save";

vi.mock("./toggle-auto-save", () => ({ flushDirtyDocuments: vi.fn() }));

import { flushDirtyDocuments } from "./toggle-auto-save";

const flushMock = vi.mocked(flushDirtyDocuments);

describe("on-change auto-save", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    flushMock.mockClear();
    useSettings.setState({ autoSave: true });
  });

  afterEach(() => {
    cancelOnChangeSave();
    vi.useRealTimers();
  });

  it("debounces a burst into a single flush after the window", () => {
    scheduleOnChangeSave();
    scheduleOnChangeSave();
    scheduleOnChangeSave();
    expect(flushMock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(ON_CHANGE_DEBOUNCE_MS);
    expect(flushMock).toHaveBeenCalledTimes(1);
  });

  it("flushOnChangeNow saves immediately and cancels the pending debounce", () => {
    scheduleOnChangeSave();
    flushOnChangeNow();
    expect(flushMock).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(ON_CHANGE_DEBOUNCE_MS);
    expect(flushMock).toHaveBeenCalledTimes(1);
  });

  it("is a no-op when auto-save is off", () => {
    useSettings.setState({ autoSave: false });
    scheduleOnChangeSave();
    flushOnChangeNow();
    vi.advanceTimersByTime(ON_CHANGE_DEBOUNCE_MS);
    expect(flushMock).not.toHaveBeenCalled();
  });

  it("re-arms after firing (a later edit triggers a second flush)", () => {
    scheduleOnChangeSave();
    vi.advanceTimersByTime(ON_CHANGE_DEBOUNCE_MS);
    expect(flushMock).toHaveBeenCalledTimes(1);
    scheduleOnChangeSave();
    vi.advanceTimersByTime(ON_CHANGE_DEBOUNCE_MS);
    expect(flushMock).toHaveBeenCalledTimes(2);
  });

  it("cancelOnChangeSave cancels a pending debounced save", () => {
    scheduleOnChangeSave();
    cancelOnChangeSave();
    vi.advanceTimersByTime(ON_CHANGE_DEBOUNCE_MS);
    expect(flushMock).not.toHaveBeenCalled();
  });
});
