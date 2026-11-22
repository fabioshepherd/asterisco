import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
  save: vi.fn(),
}));
vi.mock("@/lib/tauri/fs", () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  pathExists: vi.fn(),
}));
vi.mock("@/editor/flush-editor", () => ({ flushActiveEditor: vi.fn() }));
vi.mock("./use-unsaved-prompt", () => ({
  requestUnsavedDecision: vi.fn(),
}));

import { open, save } from "@tauri-apps/plugin-dialog";

import { flushActiveEditor } from "@/editor/flush-editor";
import { pathExists, readTextFile, writeTextFile } from "@/lib/tauri/fs";
import { useDocuments } from "@/stores/document";

import {
  closeTab,
  closeTabs,
  newFile,
  openFile,
  openPath,
  saveActiveDocument,
  saveActiveDocumentAs,
  saveDocument,
} from "./file-ops";
import { requestUnsavedDecision } from "./use-unsaved-prompt";

beforeEach(() => {
  useDocuments.setState({ documents: [], activeId: null });
  vi.clearAllMocks();
  vi.mocked(writeTextFile).mockResolvedValue(undefined);
  vi.mocked(pathExists).mockResolvedValue(true);
});

describe("newFile", () => {
  it("opens a new untitled tab", () => {
    useDocuments.getState().createDocument();

    newFile();

    expect(useDocuments.getState().documents).toHaveLength(2);
  });
});

describe("saveDocument", () => {
  it("flushes the editor before reading the markdown to write", async () => {
    const id = useDocuments.getState().createDocument({ path: "/tmp/a.md", markdown: "x" });
    vi.mocked(flushActiveEditor).mockImplementationOnce((docId) =>
      useDocuments.getState().setMarkdown(docId, "typed"),
    );

    await saveDocument(id);

    expect(writeTextFile).toHaveBeenCalledWith("/tmp/a.md", "typed");
  });

  it("writes overlapping saves of one document in order, newest last", async () => {
    // Writes run off the main thread, so two saves in flight can finish in
    // either order. Model a disk where the write that completes last wins, and
    // complete the newest pending write first — the order that used to leave
    // the older snapshot on disk while the tab said "saved".
    let disk = "";
    const pending: { contents: string; resolve: () => void }[] = [];
    vi.mocked(writeTextFile).mockImplementation(
      (_path, contents) =>
        new Promise<void>((resolve) => {
          pending.push({ contents, resolve });
        }),
    );
    const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

    const id = useDocuments.getState().createDocument({ path: "/tmp/a.md", markdown: "v1" });
    useDocuments.getState().setMarkdown(id, "v2");
    const older = saveDocument(id); // e.g. an auto-save
    await settle();
    useDocuments.getState().setMarkdown(id, "v3");
    const newer = saveDocument(id); // e.g. Ctrl+S while it is in flight
    await settle();

    while (pending.length > 0) {
      const write = pending.pop();
      if (!write) break;
      disk = write.contents;
      write.resolve();
      await settle();
    }
    await Promise.all([older, newer]);

    expect(vi.mocked(writeTextFile).mock.calls.map(([, contents]) => contents)).toEqual([
      "v2",
      "v3",
    ]);
    expect(disk).toBe("v3");
    expect(useDocuments.getState().documents[0]?.isDirty).toBe(false);
  });

  it("still saves after an earlier save of the same document failed", async () => {
    const id = useDocuments.getState().createDocument({ path: "/tmp/a.md", markdown: "v1" });
    useDocuments.getState().setMarkdown(id, "v2");
    vi.mocked(writeTextFile).mockRejectedValueOnce(new Error("disk full"));

    const failed = saveDocument(id);
    const next = saveDocument(id);

    await expect(failed).rejects.toThrow("disk full");
    await expect(next).resolves.toBe(true);
    expect(writeTextFile).toHaveBeenLastCalledWith("/tmp/a.md", "v2");
  });
});

describe("saveDocument: what is on disk stays as the file spelled it", () => {
  it("does not write a document that has no unsaved changes", async () => {
    const id = useDocuments.getState().createDocument({ path: "/tmp/a.md", markdown: "x" });

    await expect(saveDocument(id)).resolves.toBe(true);

    expect(writeTextFile).not.toHaveBeenCalled();
  });

  it("writes a clean document whose file is no longer on disk (the tab is the only copy)", async () => {
    const id = useDocuments.getState().createDocument({ path: "/tmp/a.md", markdown: "x" });
    vi.mocked(pathExists).mockResolvedValue(false);

    await expect(saveDocument(id)).resolves.toBe(true);

    expect(pathExists).toHaveBeenCalledWith("/tmp/a.md");
    expect(writeTextFile).toHaveBeenCalledWith("/tmp/a.md", "x");
  });

  it("still writes a clean document whose file was deleted outside the app", async () => {
    const id = useDocuments.getState().createDocument({ path: "/tmp/a.md", markdown: "x" });
    useDocuments.getState().markExternallyDeleted(id);

    await saveDocument(id);

    expect(writeTextFile).toHaveBeenCalledWith("/tmp/a.md", "x");
  });

  it("re-applies the CRLF endings, BOM and missing final newline the file was opened with", async () => {
    vi.mocked(readTextFile).mockResolvedValue("\uFEFF# T\r\n\r\nline");
    await openPath("/tmp/win.md");
    const doc = useDocuments.getState().documents[0];
    expect(doc?.markdown).toBe("# T\n\nline");
    useDocuments.getState().setMarkdown(doc!.id, "# T\n\nedited line\n");

    await saveDocument(doc!.id);

    expect(writeTextFile).toHaveBeenCalledWith("/tmp/win.md", "\uFEFF# T\r\n\r\nedited line");
    expect(useDocuments.getState().documents[0]?.isDirty).toBe(false);
  });

  it("keeps the file's format when saving it under a new name", async () => {
    vi.mocked(readTextFile).mockResolvedValue("a\r\n");
    vi.mocked(save).mockResolvedValue("/tmp/copy.md");
    await openPath("/tmp/win.md");
    const id = useDocuments.getState().documents[0]!.id;

    await saveActiveDocumentAs();

    expect(writeTextFile).toHaveBeenCalledWith("/tmp/copy.md", "a\r\n");
    expect(useDocuments.getState().documents.find((d) => d.id === id)?.path).toBe("/tmp/copy.md");
  });
});

describe("saveActiveDocument", () => {
  it("writes to the existing path and clears the dirty flag", async () => {
    const id = useDocuments.getState().createDocument({ path: "/tmp/a.md", markdown: "x" });
    useDocuments.getState().setMarkdown(id, "edited");

    const ok = await saveActiveDocument();

    expect(ok).toBe(true);
    expect(writeTextFile).toHaveBeenCalledWith("/tmp/a.md", "edited");
    expect(useDocuments.getState().documents[0]?.isDirty).toBe(false);
  });

  it("does not mark edits typed during the async write as saved (save-race)", async () => {
    const id = useDocuments.getState().createDocument({ path: "/tmp/a.md", markdown: "v1" });
    useDocuments.getState().setMarkdown(id, "v2"); // this is what we write

    let resolveWrite: () => void = () => {};
    vi.mocked(writeTextFile).mockImplementation(
      () => new Promise<void>((res) => (resolveWrite = res)),
    );

    const savePromise = saveActiveDocument();
    // User keeps typing while the disk write is in flight.
    useDocuments.getState().setMarkdown(id, "v3");
    resolveWrite();
    await savePromise;

    expect(writeTextFile).toHaveBeenCalledWith("/tmp/a.md", "v2");
    const doc = useDocuments.getState().documents[0];
    expect(doc?.markdown).toBe("v3");
    expect(doc?.savedMarkdown).toBe("v2");
    expect(doc?.isDirty).toBe(true); // newer edit not yet persisted
  });

  it("delegates to a save dialog when the document has no path", async () => {
    vi.mocked(save).mockResolvedValue("/tmp/new.md");
    useDocuments.getState().createDocument({ markdown: "hello" });

    const ok = await saveActiveDocument();

    expect(ok).toBe(true);
    expect(save).toHaveBeenCalledOnce();
    expect(writeTextFile).toHaveBeenCalledWith("/tmp/new.md", "hello");
    const doc = useDocuments.getState().documents[0];
    expect(doc?.path).toBe("/tmp/new.md");
    expect(doc?.isDirty).toBe(false);
  });
});

describe("saveActiveDocumentAs", () => {
  it("returns false and writes nothing when the dialog is cancelled", async () => {
    vi.mocked(save).mockResolvedValue(null);
    useDocuments.getState().createDocument({ markdown: "x" });

    const ok = await saveActiveDocumentAs();

    expect(ok).toBe(false);
    expect(writeTextFile).not.toHaveBeenCalled();
  });
});

describe("openFile", () => {
  it("opens the chosen file in a new active tab, keeping existing tabs", async () => {
    vi.mocked(open).mockResolvedValue("/tmp/doc.md");
    vi.mocked(readTextFile).mockResolvedValue("# From disk");
    const oldId = useDocuments.getState().createDocument();

    await openFile();

    const state = useDocuments.getState();
    expect(state.documents).toHaveLength(2);
    const doc = state.documents.find((d) => d.path === "/tmp/doc.md");
    expect(doc?.markdown).toBe("# From disk");
    expect(state.activeId).toBe(doc?.id);
    expect(state.documents.some((d) => d.id === oldId)).toBe(true);
  });

  it("does nothing when the open dialog is cancelled", async () => {
    vi.mocked(open).mockResolvedValue(null);
    useDocuments.getState().createDocument();

    await openFile();

    expect(useDocuments.getState().documents).toHaveLength(1);
  });
});

describe("openPath", () => {
  it("focuses an already-open document instead of reopening it", async () => {
    const id = useDocuments.getState().createDocument({ path: "/tmp/a.md", markdown: "x" });
    useDocuments.getState().createDocument();

    await openPath("/tmp/a.md");

    expect(useDocuments.getState().activeId).toBe(id);
    expect(useDocuments.getState().documents).toHaveLength(2);
    expect(readTextFile).not.toHaveBeenCalled();
  });
});

describe("closeTab", () => {
  it("flushes the editor first, so a just-typed edit still prompts", async () => {
    vi.mocked(requestUnsavedDecision).mockResolvedValue("cancel");
    const id = useDocuments.getState().createDocument({ path: "/tmp/a.md", markdown: "x" });
    vi.mocked(flushActiveEditor).mockImplementationOnce((docId) =>
      useDocuments.getState().setMarkdown(docId, "typed"),
    );

    await closeTab(id);

    expect(flushActiveEditor).toHaveBeenCalledWith(id);
    expect(requestUnsavedDecision).toHaveBeenCalledTimes(1);
    expect(useDocuments.getState().documents).toHaveLength(1);
  });

  it("closes a clean document without prompting", async () => {
    const id = useDocuments.getState().createDocument();

    await closeTab(id);

    expect(useDocuments.getState().documents).toHaveLength(0);
    expect(requestUnsavedDecision).not.toHaveBeenCalled();
  });

  it("keeps the document open when the user cancels", async () => {
    vi.mocked(requestUnsavedDecision).mockResolvedValue("cancel");
    const id = useDocuments.getState().createDocument();
    useDocuments.getState().setMarkdown(id, "edited");

    await closeTab(id);

    expect(useDocuments.getState().documents).toHaveLength(1);
  });

  it("saves before closing when the user chooses save", async () => {
    vi.mocked(requestUnsavedDecision).mockResolvedValue("save");
    const id = useDocuments.getState().createDocument({ path: "/tmp/a.md", markdown: "x" });
    useDocuments.getState().setMarkdown(id, "edited");

    await closeTab(id);

    expect(writeTextFile).toHaveBeenCalledWith("/tmp/a.md", "edited");
    expect(useDocuments.getState().documents).toHaveLength(0);
  });

  it("discards changes when the user chooses not to save", async () => {
    vi.mocked(requestUnsavedDecision).mockResolvedValue("discard");
    const id = useDocuments.getState().createDocument();
    useDocuments.getState().setMarkdown(id, "edited");

    await closeTab(id);

    expect(writeTextFile).not.toHaveBeenCalled();
    expect(useDocuments.getState().documents).toHaveLength(0);
  });
});

describe("closeTabs", () => {
  it("closes every clean tab it is given", async () => {
    const first = useDocuments.getState().createDocument();
    const second = useDocuments.getState().createDocument();

    await closeTabs([first, second]);

    expect(useDocuments.getState().documents).toHaveLength(0);
  });

  it("stops at the tab the user declines to close", async () => {
    vi.mocked(requestUnsavedDecision).mockResolvedValue("cancel");
    const first = useDocuments.getState().createDocument();
    const dirty = useDocuments.getState().createDocument();
    const third = useDocuments.getState().createDocument();
    useDocuments.getState().setMarkdown(dirty, "edited");

    await closeTabs([first, dirty, third]);

    // Cancelling means "not this batch": the third tab is untouched, not
    // skipped over and shut anyway.
    const open = useDocuments.getState().documents.map((doc) => doc.id);
    expect(open).toEqual([dirty, third]);
  });
});
