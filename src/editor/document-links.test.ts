import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn(() => Promise.resolve()) }));
vi.mock("@/features/file-ops/file-ops", () => ({ openPath: vi.fn(() => Promise.resolve()) }));

import { openUrl } from "@tauri-apps/plugin-opener";

import { openPath } from "@/features/file-ops/file-ops";

import { classifyLink, handleDocumentLinkClick } from "./document-links";

const DOC = "/work/docs/guide.md";

describe("classifyLink", () => {
  it("sends web and mail links to the system browser", () => {
    expect(classifyLink("https://example.org/x", DOC)).toEqual({
      kind: "web",
      url: "https://example.org/x",
    });
    expect(classifyLink("HTTP://Example.org", DOC)).toEqual({
      kind: "web",
      url: "http://example.org/",
    });
    expect(classifyLink("https://", DOC)).toEqual({ kind: "none" });
    expect(classifyLink("mailto:a@example.org", DOC)).toEqual({
      kind: "web",
      url: "mailto:a@example.org",
    });
  });

  it("resolves a relative Markdown link against the document's folder", () => {
    expect(classifyLink("./notes.md", DOC)).toEqual({
      kind: "markdown",
      path: "/work/docs/notes.md",
    });
    expect(classifyLink("notes.md", DOC)).toEqual({
      kind: "markdown",
      path: "/work/docs/notes.md",
    });
    expect(classifyLink("../README.md#install", DOC)).toEqual({
      kind: "markdown",
      path: "/work/README.md",
    });
    expect(classifyLink("adr/My%20Decision.MD?x=1", DOC)).toEqual({
      kind: "markdown",
      path: "/work/docs/adr/My Decision.MD",
    });
  });

  it("keeps Windows separators", () => {
    expect(classifyLink("..\\specs\\a.md", "C:\\repo\\docs\\guide.md")).toEqual({
      kind: "markdown",
      path: "C:\\repo\\specs\\a.md",
    });
  });

  it("never climbs above the share of a UNC path", () => {
    expect(classifyLink("..\\..\\..\\evil\\share\\a.md", "\\\\srv\\share\\docs\\guide.md")).toEqual(
      {
        kind: "markdown",
        path: "\\\\srv\\share\\evil\\share\\a.md",
      },
    );
    expect(classifyLink("../../../evil/a.md", "//srv/share/guide.md")).toEqual({
      kind: "markdown",
      path: "//srv/share/evil/a.md",
    });
  });

  it("leaves same-document anchors to the page", () => {
    expect(classifyLink("#fn-1", DOC)).toEqual({ kind: "fragment" });
  });

  it("ignores everything else", () => {
    for (const href of [
      "javascript:alert(1)",
      "file:///etc/passwd",
      "tel:+39000",
      "ftp://example.org/a.md",
      "//example.org/a.md",
      "/abs/a.md",
      "C:/repo/a.md",
      "./image.png",
      "./folder/",
      "",
    ]) {
      expect(classifyLink(href, DOC), href).toEqual({ kind: "none" });
    }
  });

  it("cannot resolve a relative link in an untitled document", () => {
    expect(classifyLink("./notes.md", null)).toEqual({ kind: "none" });
  });
});

function clickLink(href: string, init: MouseEventInit = {}) {
  const container = document.createElement("div");
  const anchor = document.createElement("a");
  anchor.setAttribute("href", href);
  const inner = document.createElement("strong");
  inner.textContent = "link";
  anchor.append(inner);
  container.append(anchor);
  const event = new MouseEvent("click", { bubbles: true, cancelable: true, ...init });
  Object.defineProperty(event, "target", { value: inner });
  return { event, container };
}

describe("handleDocumentLinkClick", () => {
  beforeEach(() => vi.clearAllMocks());

  it("opens a web link in the system browser in Reading view", () => {
    const { event } = clickLink("https://example.org/x");
    handleDocumentLinkClick(event, { reading: true, docPath: DOC });
    expect(event.defaultPrevented).toBe(true);
    expect(openUrl).toHaveBeenCalledWith("https://example.org/x");
  });

  it("opens a relative Markdown link in a tab in Reading view", () => {
    const { event } = clickLink("./notes.md");
    handleDocumentLinkClick(event, { reading: true, docPath: DOC });
    expect(event.defaultPrevented).toBe(true);
    expect(openPath).toHaveBeenCalledWith("/work/docs/notes.md");
  });

  it("blocks other links without opening anything", () => {
    const { event } = clickLink("javascript:alert(1)");
    handleDocumentLinkClick(event, { reading: true, docPath: DOC });
    expect(event.defaultPrevented).toBe(true);
    expect(openUrl).not.toHaveBeenCalled();
    expect(openPath).not.toHaveBeenCalled();
  });

  it("lets a same-document anchor scroll", () => {
    const { event } = clickLink("#fn-1");
    handleDocumentLinkClick(event, { reading: true, docPath: DOC });
    expect(event.defaultPrevented).toBe(false);
  });

  it("leaves a plain click in the editor to the caret", () => {
    const { event } = clickLink("https://example.org/x");
    handleDocumentLinkClick(event, { reading: false, docPath: DOC });
    expect(event.defaultPrevented).toBe(false);
    expect(openUrl).not.toHaveBeenCalled();
  });

  it("opens a link on Ctrl- or Cmd-click while editing", () => {
    for (const modifier of [{ ctrlKey: true }, { metaKey: true }]) {
      const { event } = clickLink("https://example.org/x", modifier);
      handleDocumentLinkClick(event, { reading: false, docPath: DOC });
      expect(event.defaultPrevented).toBe(true);
    }
    expect(openUrl).toHaveBeenCalledTimes(2);
  });

  it("ignores clicks outside a link", () => {
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "target", { value: document.createElement("p") });
    handleDocumentLinkClick(event, { reading: true, docPath: DOC });
    expect(event.defaultPrevented).toBe(false);
  });
});
