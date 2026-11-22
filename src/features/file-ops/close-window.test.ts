import { beforeEach, describe, expect, it, vi } from "vitest";

const destroy = vi.fn();
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ destroy }),
}));
vi.mock("@/editor/flush-editor", () => ({ flushActiveEditor: vi.fn() }));
vi.mock("./use-unsaved-prompt", () => ({
  requestUnsavedDecision: vi.fn(),
}));
vi.mock("./file-ops", () => ({
  saveWithFeedback: vi.fn(),
}));
vi.mock("@/lib/log", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { flushActiveEditor } from "@/editor/flush-editor";
import { log } from "@/lib/log";
import { useDocuments } from "@/stores/document";

import { closeWindowIfConfirmed, confirmCloseAllDirty } from "./close-window";
import { saveWithFeedback } from "./file-ops";
import { requestUnsavedDecision } from "./use-unsaved-prompt";

beforeEach(() => {
  useDocuments.setState({ documents: [], activeId: null });
  vi.clearAllMocks();
});

describe("confirmCloseAllDirty", () => {
  it("flushes the active editor before looking for dirty documents", async () => {
    const id = useDocuments.getState().createDocument({ path: "/tmp/a.md", markdown: "x" });
    vi.mocked(flushActiveEditor).mockImplementationOnce((docId) =>
      useDocuments.getState().setMarkdown(docId, "typed"),
    );
    vi.mocked(requestUnsavedDecision).mockResolvedValue("cancel");

    expect(await confirmCloseAllDirty()).toBe(false);
    expect(flushActiveEditor).toHaveBeenCalledWith(id);
  });

  it("prompts for every dirty document and resolves true when all are handled", async () => {
    const first = useDocuments.getState().createDocument({ path: "/tmp/a.md", markdown: "x" });
    useDocuments.getState().setMarkdown(first, "edited a");
    const second = useDocuments.getState().createDocument({ path: "/tmp/b.md", markdown: "y" });
    useDocuments.getState().setMarkdown(second, "edited b");

    vi.mocked(requestUnsavedDecision)
      .mockResolvedValueOnce("save")
      .mockResolvedValueOnce("discard");
    vi.mocked(saveWithFeedback).mockResolvedValue(true);

    const result = await confirmCloseAllDirty();

    expect(result).toBe(true);
    expect(requestUnsavedDecision).toHaveBeenCalledTimes(2);
    expect(saveWithFeedback).toHaveBeenCalledTimes(1);
    expect(saveWithFeedback).toHaveBeenCalledWith(first);
  });

  it("aborts early and stops iterating when the user cancels", async () => {
    const first = useDocuments.getState().createDocument({ path: "/tmp/a.md", markdown: "x" });
    useDocuments.getState().setMarkdown(first, "edited a");
    const second = useDocuments.getState().createDocument({ path: "/tmp/b.md", markdown: "y" });
    useDocuments.getState().setMarkdown(second, "edited b");

    vi.mocked(requestUnsavedDecision).mockResolvedValueOnce("cancel");

    const result = await confirmCloseAllDirty();

    expect(result).toBe(false);
    expect(requestUnsavedDecision).toHaveBeenCalledTimes(1);
    expect(saveWithFeedback).not.toHaveBeenCalled();
  });

  it("aborts when a requested save fails", async () => {
    const first = useDocuments.getState().createDocument({ path: "/tmp/a.md", markdown: "x" });
    useDocuments.getState().setMarkdown(first, "edited a");

    vi.mocked(requestUnsavedDecision).mockResolvedValue("save");
    vi.mocked(saveWithFeedback).mockResolvedValue(false);

    const result = await confirmCloseAllDirty();

    expect(result).toBe(false);
    expect(saveWithFeedback).toHaveBeenCalledTimes(1);
  });
});

describe("closeWindowIfConfirmed", () => {
  it("destroys the window when every dirty document is handled", async () => {
    // No dirty documents → confirmCloseAllDirty resolves true.
    await closeWindowIfConfirmed();

    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("does not destroy the window when the user cancels", async () => {
    const id = useDocuments.getState().createDocument({ path: "/tmp/a.md", markdown: "x" });
    useDocuments.getState().setMarkdown(id, "edited a");
    vi.mocked(requestUnsavedDecision).mockResolvedValue("cancel");

    await closeWindowIfConfirmed();

    expect(destroy).not.toHaveBeenCalled();
  });

  it("swallows errors so they never become unhandled rejections", async () => {
    destroy.mockRejectedValueOnce(new Error("boom"));

    // No dirty documents → proceeds to destroy(), which rejects.
    await expect(closeWindowIfConfirmed()).resolves.toBeUndefined();
    expect(log.error).toHaveBeenCalled();
  });
});
