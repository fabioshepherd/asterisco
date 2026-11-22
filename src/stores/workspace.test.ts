import { beforeEach, describe, expect, it, vi } from "vitest";

import { ancestorsWithin, parentFolder, useWorkspace, workspaceName } from "./workspace";

vi.mock("@/lib/tauri/settings-store", () => ({
  saveWorkspaceRoot: vi.fn().mockResolvedValue(undefined),
}));

import { saveWorkspaceRoot } from "@/lib/tauri/settings-store";

beforeEach(() => {
  vi.clearAllMocks();
  useWorkspace.setState({ rootPath: null, revealPaths: new Set(), revealToken: 0 });
});

describe("workspace store", () => {
  it("opens and closes a workspace folder", () => {
    useWorkspace.getState().setRoot("/Users/me/notes");
    expect(useWorkspace.getState().rootPath).toBe("/Users/me/notes");

    useWorkspace.getState().closeWorkspace();
    expect(useWorkspace.getState().rootPath).toBeNull();
  });

  it("persists the open folder, and clears it on close", () => {
    // Sessions are short and frequent; re-picking the folder every launch is a
    // tax on the common case.
    useWorkspace.getState().setRoot("/Users/me/notes");
    expect(saveWorkspaceRoot).toHaveBeenCalledWith("/Users/me/notes");

    useWorkspace.getState().closeWorkspace();
    expect(saveWorkspaceRoot).toHaveBeenLastCalledWith(null);
  });
});

describe("revealPath", () => {
  it("publishes the folders leading to a file, and bumps the token", () => {
    useWorkspace.getState().setRoot("/root");
    useWorkspace.getState().revealPath("/root/docs/adr/0007.md");

    const { revealPaths, revealToken } = useWorkspace.getState();
    expect([...revealPaths].sort()).toEqual([
      "/root",
      "/root/docs",
      "/root/docs/adr",
      "/root/docs/adr/0007.md",
    ]);
    expect(revealToken).toBe(1);

    // Revealing the same file again must still trigger the tree.
    useWorkspace.getState().revealPath("/root/docs/adr/0007.md");
    expect(useWorkspace.getState().revealToken).toBe(2);
  });

  it("ignores a path outside the workspace instead of publishing phantoms", () => {
    useWorkspace.getState().setRoot("/root");
    useWorkspace.getState().revealPath("/elsewhere/a.md");

    expect(useWorkspace.getState().revealPaths.size).toBe(0);
    expect(useWorkspace.getState().revealToken).toBe(0);
  });

  it("does nothing without a workspace or a path", () => {
    useWorkspace.getState().revealPath("/root/a.md");
    expect(useWorkspace.getState().revealToken).toBe(0);

    useWorkspace.getState().setRoot("/root");
    useWorkspace.getState().revealPath(null);
    expect(useWorkspace.getState().revealToken).toBe(0);
  });
});

describe("ancestorsWithin", () => {
  it("returns the root and every folder down to the file", () => {
    expect([...ancestorsWithin("/root/a/b.md", "/root")].sort()).toEqual([
      "/root",
      "/root/a",
      "/root/a/b.md",
    ]);
  });

  it("matches on a separator boundary, not a raw prefix", () => {
    // `/x/proj` must not claim `/x/project2/a.md`.
    expect(ancestorsWithin("/x/project2/a.md", "/x/proj").size).toBe(0);
    expect(ancestorsWithin("/abcde/foo", "/root").size).toBe(0);
  });

  it("handles the root itself, a trailing separator, and Windows paths", () => {
    expect([...ancestorsWithin("/root", "/root")]).toEqual(["/root"]);
    expect([...ancestorsWithin("/root/a.md", "/root/")].sort()).toEqual(["/root/", "/root/a.md"]);
    expect([...ancestorsWithin("C:\\work\\docs\\a.md", "C:\\work")].sort()).toEqual([
      "C:\\work",
      "C:\\work\\docs",
      "C:\\work\\docs\\a.md",
    ]);
  });
});

describe("parentFolder", () => {
  it("returns the containing folder", () => {
    expect(parentFolder("/Users/me/work/api")).toBe("/Users/me/work");
    expect(parentFolder("/Users/me/work/api/")).toBe("/Users/me/work");
    expect(parentFolder("C:\\work\\api")).toBe("C:\\work");
  });

  it("returns null at the filesystem root or with no path", () => {
    expect(parentFolder("/root")).toBeNull();
    expect(parentFolder(null)).toBeNull();
  });
});

describe("workspaceName", () => {
  it("returns the last path segment", () => {
    expect(workspaceName("/Users/me/notes")).toBe("notes");
    expect(workspaceName("/Users/me/notes/")).toBe("notes");
  });

  it("returns null for no path", () => {
    expect(workspaceName(null)).toBeNull();
  });
});
