import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tauri/fs", () => ({
  createFile: vi.fn().mockResolvedValue(undefined),
  moveToTrash: vi.fn().mockResolvedValue(undefined),
  renamePath: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ confirm: vi.fn().mockResolvedValue(true) }));
vi.mock("@/features/file-ops/file-ops", () => ({ openPath: vi.fn() }));
vi.mock("@/lib/tauri/settings-store", () => ({ saveWorkspaceRoot: vi.fn() }));

import { confirm } from "@tauri-apps/plugin-dialog";

import "@/i18n";
import { moveToTrash, renamePath } from "@/lib/tauri/fs";
import { useWorkspace } from "@/stores/workspace";

import { deleteEntry, useFileActions } from "./file-actions";

beforeEach(() => {
  vi.clearAllMocks();
  useWorkspace.setState({ rootPath: "/work/acme" });
  useFileActions.setState({ prompt: null, name: "", error: null, busy: false });
});

describe("deleteEntry", () => {
  /**
   * The root renders as an ordinary row, it is where `Mod+Shift+E` puts the
   * keyboard, and `Delete` there was one confirm away from the whole repository.
   */
  it("refuses the workspace root outright", async () => {
    await deleteEntry("/work/acme", true);

    expect(confirm).not.toHaveBeenCalled();
    expect(moveToTrash).not.toHaveBeenCalled();
  });

  it("says whether it is about to move a file or a folder full of things", async () => {
    await deleteEntry("/work/acme/docs", true);
    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining("everything in it"),
      expect.anything(),
    );

    await deleteEntry("/work/acme/README.md", false);
    expect(confirm).toHaveBeenLastCalledWith("Move “README.md” to the trash?", expect.anything());
    expect(moveToTrash).toHaveBeenCalledTimes(2);
  });
});

describe("renaming the workspace folder", () => {
  it("moves the workspace with it instead of leaving the app on a dead path", async () => {
    useFileActions.getState().startRename("/work/acme");
    useFileActions.getState().setName("acme-docs");
    await useFileActions.getState().submit();

    expect(renamePath).toHaveBeenCalledWith("/work/acme", "/work/acme-docs");
    expect(useWorkspace.getState().rootPath).toBe("/work/acme-docs");
  });

  it("leaves the workspace alone when something else is renamed", async () => {
    useFileActions.getState().startRename("/work/acme/notes.md");
    useFileActions.getState().setName("todo.md");
    await useFileActions.getState().submit();

    expect(useWorkspace.getState().rootPath).toBe("/work/acme");
  });
});
