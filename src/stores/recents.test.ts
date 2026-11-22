import { beforeEach, describe, expect, it } from "vitest";

import { useRecents } from "./recents";

beforeEach(() => {
  useRecents.setState({ recents: [], recentFolders: [] });
});

describe("recents store", () => {
  it("adds the most recent path to the front", () => {
    useRecents.getState().addRecent("/a.md");
    useRecents.getState().addRecent("/b.md");

    expect(useRecents.getState().recents).toEqual(["/b.md", "/a.md"]);
  });

  it("de-duplicates and promotes an existing path", () => {
    useRecents.getState().addRecent("/a.md");
    useRecents.getState().addRecent("/b.md");
    useRecents.getState().addRecent("/a.md");

    expect(useRecents.getState().recents).toEqual(["/a.md", "/b.md"]);
  });

  it("caps the list at eight entries", () => {
    for (let i = 0; i < 12; i += 1) {
      useRecents.getState().addRecent(`/file-${i}.md`);
    }

    expect(useRecents.getState().recents).toHaveLength(8);
    expect(useRecents.getState().recents[0]).toBe("/file-11.md");
  });
});

describe("recent folders", () => {
  it("adds the most recent folder to the front", () => {
    useRecents.getState().addRecentFolder("/projects/a");
    useRecents.getState().addRecentFolder("/projects/b");

    expect(useRecents.getState().recentFolders).toEqual(["/projects/b", "/projects/a"]);
  });

  it("de-duplicates and promotes an existing folder", () => {
    useRecents.getState().addRecentFolder("/projects/a");
    useRecents.getState().addRecentFolder("/projects/b");
    useRecents.getState().addRecentFolder("/projects/a");

    expect(useRecents.getState().recentFolders).toEqual(["/projects/a", "/projects/b"]);
  });

  it("caps the folder list at eight entries", () => {
    for (let i = 0; i < 12; i += 1) {
      useRecents.getState().addRecentFolder(`/folder-${i}`);
    }

    expect(useRecents.getState().recentFolders).toHaveLength(8);
    expect(useRecents.getState().recentFolders[0]).toBe("/folder-11");
  });

  it("keeps files and folders independent", () => {
    useRecents.getState().addRecent("/a.md");
    useRecents.getState().addRecentFolder("/projects/a");

    expect(useRecents.getState().recents).toEqual(["/a.md"]);
    expect(useRecents.getState().recentFolders).toEqual(["/projects/a"]);
  });
});
