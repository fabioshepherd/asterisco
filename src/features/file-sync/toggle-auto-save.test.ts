import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/i18n";
import { useDocuments } from "@/stores/document";
import { notify } from "@/stores/notifications";
import { useSettings } from "@/stores/settings";

import { flushDirtyDocuments, toggleAutoSave } from "./toggle-auto-save";

vi.mock("@/features/file-ops/file-ops", () => ({
  saveDocument: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("@/stores/notifications", () => ({
  notify: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

import { saveDocument } from "@/features/file-ops/file-ops";

const saveMock = vi.mocked(saveDocument);
const errorMock = vi.mocked(notify.error);

/** Let queued promise callbacks (the saveDocument().catch handler) settle. */
async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function seedDocs(docs: Array<{ id: string; isDirty: boolean; path: string | null }>) {
  // Only the fields the flush loop reads are required here.
  useDocuments.setState({ documents: docs } as never);
}

describe("flushDirtyDocuments", () => {
  beforeEach(() => {
    saveMock.mockClear();
    useSettings.setState({ autoSave: false });
  });

  it("saves dirty documents that have a path", () => {
    seedDocs([{ id: "a", isDirty: true, path: "/a.md" }]);
    flushDirtyDocuments();
    expect(saveMock).toHaveBeenCalledWith("a");
  });

  it("skips clean documents and untitled (no path) documents", () => {
    seedDocs([
      { id: "clean", isDirty: false, path: "/c.md" },
      { id: "untitled", isDirty: true, path: null },
    ]);
    flushDirtyDocuments();
    expect(saveMock).not.toHaveBeenCalled();
  });
});

describe("flushDirtyDocuments auto-save failure surfacing", () => {
  // The rate-limit timestamp is module-scoped, so each test starts from a base
  // far past the previous test's last toast (> 30s apart) to avoid cross-test
  // suppression; `now()` advances time deterministically within a test.
  let clock = 0;
  const now = (ms: number) => vi.spyOn(Date, "now").mockReturnValue(ms);

  beforeEach(() => {
    saveMock.mockClear();
    errorMock.mockClear();
    saveMock.mockResolvedValue(true);
    useSettings.setState({ autoSave: false });
    clock += 10_000_000; // jump well beyond the throttle window between tests
    now(clock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("surfaces a localized error toast when a save rejects", async () => {
    saveMock.mockRejectedValue(new Error("disk full"));
    seedDocs([{ id: "a", isDirty: true, path: "/a.md" }]);

    flushDirtyDocuments();
    await flushMicrotasks();

    expect(errorMock).toHaveBeenCalledTimes(1);
    expect(errorMock).toHaveBeenCalledWith(i18n.t("notify.autoSaveFailed", { ns: "editor" }));
  });

  it("rate-limits the toast to once per 30s window across consecutive flushes", async () => {
    saveMock.mockRejectedValue(new Error("disk full"));
    seedDocs([{ id: "a", isDirty: true, path: "/a.md" }]);

    flushDirtyDocuments();
    await flushMicrotasks();
    // Second flush a few seconds later — still inside the 30s window.
    now(clock + 5_000);
    flushDirtyDocuments();
    await flushMicrotasks();

    expect(errorMock).toHaveBeenCalledTimes(1);
  });

  it("does not toast (error or success) when the save succeeds", async () => {
    saveMock.mockResolvedValue(true);
    seedDocs([{ id: "a", isDirty: true, path: "/a.md" }]);

    flushDirtyDocuments();
    await flushMicrotasks();

    expect(errorMock).not.toHaveBeenCalled();
    expect(notify.success).not.toHaveBeenCalled();
  });
});

describe("flushDirtyDocuments in-flight guard", () => {
  beforeEach(() => {
    saveMock.mockClear();
    useSettings.setState({ autoSave: false });
  });
  afterEach(() => {
    // Restore the benign default impl for any later suite.
    saveMock.mockReset();
    saveMock.mockResolvedValue(true);
  });

  it("does not start a second concurrent save for a doc already saving", async () => {
    const resolvers: Array<(v: boolean) => void> = [];
    saveMock.mockImplementation(() => new Promise<boolean>((res) => resolvers.push(res)));
    seedDocs([{ id: "a", isDirty: true, path: "/a.md" }]);

    flushDirtyDocuments(); // starts the (pending) write
    flushDirtyDocuments(); // doc still dirty but in flight → must skip
    expect(saveMock).toHaveBeenCalledTimes(1);

    resolvers[0]?.(true);
    await flushMicrotasks();
    await flushMicrotasks(); // let the .finally clear the in-flight marker

    // Once the prior write settles, a later flush is free to save again.
    flushDirtyDocuments();
    expect(saveMock).toHaveBeenCalledTimes(2);

    // Drain the second write so the in-flight set is empty for later suites.
    resolvers[1]?.(true);
    await flushMicrotasks();
    await flushMicrotasks();
  });
});

describe("toggleAutoSave", () => {
  beforeEach(() => {
    saveMock.mockClear();
    useSettings.setState({ autoSave: false });
    seedDocs([{ id: "a", isDirty: true, path: "/a.md" }]);
  });

  it("turns autosave on and flushes dirty docs immediately", () => {
    toggleAutoSave();
    expect(useSettings.getState().autoSave).toBe(true);
    expect(saveMock).toHaveBeenCalledWith("a");
  });

  it("turns autosave off without flushing", () => {
    useSettings.setState({ autoSave: true });
    toggleAutoSave();
    expect(useSettings.getState().autoSave).toBe(false);
    expect(saveMock).not.toHaveBeenCalled();
  });
});
