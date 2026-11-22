import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tauri/fs", () => ({ renamePath: vi.fn() }));
vi.mock("@/features/file-ops/file-ops", () => ({ saveDocumentAs: vi.fn() }));

import "@/i18n";
import { saveDocumentAs } from "@/features/file-ops/file-ops";
import type { AppError } from "@/lib/tauri/errors";
import { renamePath } from "@/lib/tauri/fs";
import { useDocuments } from "@/stores/document";

import { useTabRename } from "./useTabRename";

const docOf = (id: string) => useDocuments.getState().documents.find((d) => d.id === id);

beforeEach(() => {
  useDocuments.setState({ documents: [], activeId: null });
  vi.clearAllMocks();
  vi.mocked(renamePath).mockResolvedValue(undefined);
  vi.mocked(saveDocumentAs).mockResolvedValue(true);
});

describe("useTabRename", () => {
  it("renames a saved file and re-points the open document", async () => {
    const id = useDocuments.getState().createDocument({ path: "/docs/notes.md", markdown: "x" });
    const { result } = renderHook(() => useTabRename());

    act(() => result.current.beginEdit(docOf(id)!));
    expect(result.current.editingId).toBe(id);
    expect(result.current.draft).toBe("notes"); // stem only, no extension

    act(() => result.current.setDraft("ideas"));
    await act(async () => {
      await result.current.commit();
    });

    expect(renamePath).toHaveBeenCalledWith("/docs/notes.md", "/docs/ideas.md");
    expect(docOf(id)?.path).toBe("/docs/ideas.md");
    expect(result.current.editingId).toBeNull();
  });

  it("cancels silently when the name is unchanged (no IPC)", async () => {
    const id = useDocuments.getState().createDocument({ path: "/docs/notes.md", markdown: "x" });
    const { result } = renderHook(() => useTabRename());

    act(() => result.current.beginEdit(docOf(id)!));
    await act(async () => {
      await result.current.commit();
    });

    expect(renamePath).not.toHaveBeenCalled();
    expect(result.current.editingId).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("shows an error and keeps the field open on an empty name", async () => {
    const id = useDocuments.getState().createDocument({ path: "/docs/notes.md", markdown: "x" });
    const { result } = renderHook(() => useTabRename());

    act(() => result.current.beginEdit(docOf(id)!));
    act(() => result.current.setDraft("   "));
    await act(async () => {
      await result.current.commit();
    });

    expect(renamePath).not.toHaveBeenCalled();
    expect(result.current.editingId).toBe(id);
    expect(result.current.error).toBe("Name cannot be empty");
  });

  it("keeps the field open with an error when the target already exists", async () => {
    const err: AppError = { kind: "alreadyExists", message: "exists" };
    vi.mocked(renamePath).mockRejectedValue(err);
    const id = useDocuments.getState().createDocument({ path: "/docs/notes.md", markdown: "x" });
    const { result } = renderHook(() => useTabRename());

    act(() => result.current.beginEdit(docOf(id)!));
    act(() => result.current.setDraft("ideas"));
    await act(async () => {
      await result.current.commit();
    });

    expect(result.current.editingId).toBe(id);
    expect(result.current.error).toBe('A file named "ideas.md" already exists');
  });

  it("opens Save As for an unsaved document instead of editing inline", () => {
    const id = useDocuments.getState().createDocument({ markdown: "x" }); // path === null
    const { result } = renderHook(() => useTabRename());

    act(() => {
      result.current.beginEdit(docOf(id)!);
    });

    expect(saveDocumentAs).toHaveBeenCalledWith(id);
    expect(result.current.editingId).toBeNull();
    expect(renamePath).not.toHaveBeenCalled();
  });

  it("cancel() clears edit state without side effects", () => {
    const id = useDocuments.getState().createDocument({ path: "/docs/notes.md", markdown: "x" });
    const { result } = renderHook(() => useTabRename());

    act(() => result.current.beginEdit(docOf(id)!));
    act(() => result.current.cancel());

    expect(result.current.editingId).toBeNull();
    expect(renamePath).not.toHaveBeenCalled();
  });
});
