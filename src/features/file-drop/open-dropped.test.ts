import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDocuments } from "@/stores/document";
import { notify } from "@/stores/notifications";

vi.mock("@/stores/document", () => {
  const createDocument = vi.fn(() => "doc-1");
  const setActiveDocument = vi.fn();
  return { useDocuments: { getState: () => ({ createDocument, setActiveDocument }) } };
});
vi.mock("@/stores/notifications", () => ({ notify: { error: vi.fn() } }));

import { openDroppedFiles } from "./open-dropped";

const { createDocument, setActiveDocument } = useDocuments.getState();

// jsdom's File doesn't implement text(); stub a File-like with the members used.
function fakeFile(name: string, text = ""): File {
  return { name, text: () => Promise.resolve(text) } as unknown as File;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("openDroppedFiles", () => {
  it("opens a dropped markdown file as the active tab", async () => {
    await openDroppedFiles([fakeFile("notes.md", "# hi")]);
    expect(createDocument).toHaveBeenCalledWith({ markdown: "# hi" });
    expect(setActiveDocument).toHaveBeenCalledWith("doc-1");
    expect(notify.error).not.toHaveBeenCalled();
  });

  it("opens every markdown file and reports the rest in one toast", async () => {
    await openDroppedFiles([
      fakeFile("a.md", "# a"),
      fakeFile("b.txt", "b"),
      fakeFile("report.docx", "x"),
      fakeFile("photo.png", "x"),
    ]);
    expect(createDocument).toHaveBeenCalledTimes(2);
    expect(notify.error).toHaveBeenCalledTimes(1);
    expect(notify.error).toHaveBeenCalledWith(expect.stringContaining("2"));
  });

  it("names a single skipped file", async () => {
    await openDroppedFiles([fakeFile("data.csv", "a,b")]);
    expect(createDocument).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalledWith(expect.stringContaining("data.csv"));
  });
});
