import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDocuments } from "@/stores/document";
import { useSettings } from "@/stores/settings";

// Mock the debounce controller so we can spy on the wiring without exercising
// the real flush/debounce (that has its own tests).
vi.mock("./on-change-auto-save", () => ({
  scheduleOnChangeSave: vi.fn(),
  cancelOnChangeSave: vi.fn(),
}));

import { cancelOnChangeSave, scheduleOnChangeSave } from "./on-change-auto-save";
import { useAutoSave } from "./use-auto-save";

const scheduleMock = vi.mocked(scheduleOnChangeSave);
const cancelMock = vi.mocked(cancelOnChangeSave);

const DOC_ID = "doc-1";

/** Seed one saved-on-disk document so a `setMarkdown` mutation changes state. */
function seedDocument(): void {
  useDocuments.setState({
    documents: [
      {
        id: DOC_ID,
        path: "/a.md",
        markdown: "hello",
        savedMarkdown: "hello",
        isDirty: false,
        baselineReady: true,
      },
    ],
    activeId: DOC_ID,
  });
}

/** Mutate the document store so the hook's subscription fires (if subscribed). */
function editDocument(text: string): void {
  useDocuments.getState().setMarkdown(DOC_ID, text);
}

describe("useAutoSave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    scheduleMock.mockClear();
    cancelMock.mockClear();
    // Reset the module-singleton stores to a known baseline for each test.
    useSettings.setState({ autoSave: false });
    useDocuments.setState({ documents: [], activeId: null });
    seedDocument();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("does nothing while auto-save is off", () => {
    renderHook(() => useAutoSave());

    editDocument("changed");

    expect(scheduleMock).not.toHaveBeenCalled();
  });

  it("schedules a save on each edit when auto-save is on", () => {
    useSettings.setState({ autoSave: true });
    renderHook(() => useAutoSave());

    expect(scheduleMock).not.toHaveBeenCalled();
    editDocument("changed once");
    editDocument("changed twice");

    expect(scheduleMock).toHaveBeenCalledTimes(2);
  });

  it("cancels the pending save and unsubscribes on unmount", () => {
    useSettings.setState({ autoSave: true });
    const { unmount } = renderHook(() => useAutoSave());

    editDocument("first edit");
    expect(scheduleMock).toHaveBeenCalledTimes(1);

    unmount();
    expect(cancelMock).toHaveBeenCalledTimes(1);

    // After unmount the subscription is gone: further edits schedule nothing.
    scheduleMock.mockClear();
    editDocument("after unmount");
    expect(scheduleMock).not.toHaveBeenCalled();
  });
});
