import { describe, expect, it } from "vitest";

import { flattenLabel, tabLabels } from "./tab-labels";

const UNTITLED = "Untitled";

describe("tabLabels", () => {
  it("leaves a unique file name alone", () => {
    const labels = tabLabels([{ id: "a", path: "/repo/docs/notes.md" }], UNTITLED);
    expect(labels.get("a")).toEqual({ name: "notes.md", context: null });
  });

  it("adds the distinguishing folder only to the names that collide", () => {
    const labels = tabLabels(
      [
        { id: "a", path: "/repo/docs/README.md" },
        { id: "b", path: "/repo/api/README.md" },
        { id: "c", path: "/repo/CHANGELOG.md" },
      ],
      UNTITLED,
    );
    expect(labels.get("a")).toEqual({ name: "README.md", context: "docs" });
    expect(labels.get("b")).toEqual({ name: "README.md", context: "api" });
    expect(labels.get("c")).toEqual({ name: "CHANGELOG.md", context: null });
  });

  it("widens the folder suffix until the tabs read differently", () => {
    // One segment is "docs" for both; two segments separate them.
    const labels = tabLabels(
      [
        { id: "a", path: "/repo/v1/docs/README.md" },
        { id: "b", path: "/repo/v2/docs/README.md" },
      ],
      UNTITLED,
    );
    expect(labels.get("a")?.context).toBe("v1/docs");
    expect(labels.get("b")?.context).toBe("v2/docs");
  });

  it("widens no further than the segments that actually differ", () => {
    const labels = tabLabels(
      [
        { id: "a", path: "/one/two/three/CLAUDE.md" },
        { id: "b", path: "/four/five/six/CLAUDE.md" },
      ],
      UNTITLED,
    );
    expect(labels.get("a")?.context).toBe("three");
    expect(labels.get("b")?.context).toBe("six");
  });

  it("separates files at different depths", () => {
    const labels = tabLabels(
      [
        { id: "a", path: "/repo/AGENTS.md" },
        { id: "b", path: "/repo/packages/core/AGENTS.md" },
      ],
      UNTITLED,
    );
    expect(labels.get("a")?.context).toBe("repo");
    expect(labels.get("b")?.context).toBe("core");
  });

  it("handles Windows separators", () => {
    const labels = tabLabels(
      [
        { id: "a", path: "C:\\repo\\docs\\README.md" },
        { id: "b", path: "C:\\repo\\api\\README.md" },
      ],
      UNTITLED,
    );
    expect(labels.get("a")).toEqual({ name: "README.md", context: "docs" });
    expect(labels.get("b")).toEqual({ name: "README.md", context: "api" });
  });

  it("leaves a lone untitled document unnumbered", () => {
    const labels = tabLabels([{ id: "a", path: null }], UNTITLED);
    expect(labels.get("a")).toEqual({ name: "Untitled", context: null });
  });

  it("numbers untitled documents in open order once there are several", () => {
    const labels = tabLabels(
      [
        { id: "a", path: null },
        { id: "b", path: "/repo/notes.md" },
        { id: "c", path: null },
      ],
      UNTITLED,
    );
    expect(labels.get("a")?.name).toBe("Untitled 1");
    expect(labels.get("c")?.name).toBe("Untitled 2");
    expect(labels.get("b")?.name).toBe("notes.md");
  });

  it("labels every document it is given", () => {
    const docs = [
      { id: "a", path: "/x/README.md" },
      { id: "b", path: "/y/README.md" },
      { id: "c", path: null },
      { id: "d", path: "/z/notes.md" },
    ];
    const labels = tabLabels(docs, UNTITLED);
    expect([...labels.keys()].sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("returns an empty map for no documents", () => {
    expect(tabLabels([], UNTITLED).size).toBe(0);
  });
});

describe("flattenLabel", () => {
  it("joins a name and its context into one phrase", () => {
    expect(flattenLabel({ name: "README.md", context: "docs" })).toBe("README.md — docs");
  });

  it("is just the name when there is no context", () => {
    expect(flattenLabel({ name: "README.md", context: null })).toBe("README.md");
  });
});
