import { ask } from "@tauri-apps/plugin-dialog";
import { beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/i18n";
import { readTextFile } from "@/lib/tauri/fs";
import { useDocuments } from "@/stores/document";
import { log } from "@/lib/log";
import { notify } from "@/stores/notifications";

import { handleExternalChange, handleExternalDelete } from "./use-file-watcher";

vi.mock("@/stores/notifications", () => ({
  notify: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

vi.mock("@/lib/log", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/tauri/fs", () => ({ readTextFile: vi.fn() }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ ask: vi.fn() }));

const errorMock = vi.mocked(notify.error);
const warnMock = vi.mocked(log.warn);

function seedDocs(docs: Array<{ id: string; path: string | null; isDirty: boolean }>) {
  // Only the fields handleExternalDelete touches are required here.
  useDocuments.setState({ documents: docs } as never);
}

describe("handleExternalDelete", () => {
  beforeEach(() => {
    errorMock.mockClear();
    warnMock.mockClear();
  });

  it("marks an open document dirty and toasts the localized message", () => {
    seedDocs([{ id: "a", path: "/notes/todo.md", isDirty: false }]);

    handleExternalDelete("/notes/todo.md");

    const doc = useDocuments.getState().documents.find((d) => d.id === "a");
    expect(doc?.isDirty).toBe(true);
    expect(errorMock).toHaveBeenCalledTimes(1);
    expect(errorMock).toHaveBeenCalledWith(
      i18n.t("notify.deletedExternal", { ns: "editor", name: "todo.md" }),
    );
    expect(warnMock).toHaveBeenCalledTimes(1);
  });

  it("does not close the tab — the document is kept", () => {
    seedDocs([{ id: "a", path: "/notes/todo.md", isDirty: false }]);

    handleExternalDelete("/notes/todo.md");

    expect(useDocuments.getState().documents).toHaveLength(1);
  });

  it("does nothing (no toast, no throw) for a path that is not open", () => {
    seedDocs([{ id: "a", path: "/notes/todo.md", isDirty: false }]);

    expect(() => handleExternalDelete("/other/unknown.md")).not.toThrow();

    expect(errorMock).not.toHaveBeenCalled();
    expect(warnMock).not.toHaveBeenCalled();
    const doc = useDocuments.getState().documents.find((d) => d.id === "a");
    expect(doc?.isDirty).toBe(false);
  });
});

describe("handleExternalChange", () => {
  const PATH = "/notes/todo.md";

  /** Seed a single open doc; overrides set the fields the reconciler reads. */
  function seed(
    over: Partial<{
      markdown: string;
      savedMarkdown: string;
      isDirty: boolean;
      format: { eol: "\n" | "\r\n"; bom: boolean; finalNewline: boolean };
    }>,
  ) {
    useDocuments.setState({
      documents: [
        {
          id: "a",
          path: PATH,
          markdown: "local",
          savedMarkdown: "disk",
          isDirty: false,
          baselineReady: true,
          ...over,
        },
      ],
    } as never);
  }

  beforeEach(() => {
    vi.mocked(readTextFile).mockReset();
    vi.mocked(ask).mockReset();
  });

  it("no-ops when the file content still equals the saved baseline", async () => {
    seed({ markdown: "disk", savedMarkdown: "disk", isDirty: false });
    vi.mocked(readTextFile).mockResolvedValue("disk");

    await handleExternalChange(PATH);

    expect(ask).not.toHaveBeenCalled();
    expect(useDocuments.getState().documents[0]?.markdown).toBe("disk");
  });

  it("auto-reloads a clean document without prompting", async () => {
    seed({ markdown: "disk", savedMarkdown: "disk", isDirty: false });
    vi.mocked(readTextFile).mockResolvedValue("new from disk");

    await handleExternalChange(PATH);

    expect(ask).not.toHaveBeenCalled();
    const doc = useDocuments.getState().documents[0];
    expect(doc?.markdown).toBe("new from disk");
    expect(doc?.savedMarkdown).toBe("new from disk");
    expect(doc?.isDirty).toBe(false);
  });

  it("prompts on a dirty document and reloads when the user accepts", async () => {
    seed({ markdown: "my edits", savedMarkdown: "disk", isDirty: true });
    vi.mocked(readTextFile).mockResolvedValue("new from disk");
    vi.mocked(ask).mockResolvedValue(true);

    await handleExternalChange(PATH);

    expect(ask).toHaveBeenCalledTimes(1);
    expect(useDocuments.getState().documents[0]?.markdown).toBe("new from disk");
  });

  it("keeps local edits when the user declines the reload (no data loss)", async () => {
    seed({ markdown: "my edits", savedMarkdown: "disk", isDirty: true });
    vi.mocked(readTextFile).mockResolvedValue("new from disk");
    vi.mocked(ask).mockResolvedValue(false);

    await handleExternalChange(PATH);

    const doc = useDocuments.getState().documents[0];
    expect(doc?.markdown).toBe("my edits");
    expect(doc?.isDirty).toBe(true);
  });

  it("no-ops when the file holds what the app wrote in the file's own format", async () => {
    const format = { eol: "\r\n" as const, bom: true, finalNewline: false };
    seed({ markdown: "# T\n\nline\n", savedMarkdown: "# T\n\nline\n", format });
    vi.mocked(readTextFile).mockResolvedValue("\uFEFF# T\r\n\r\nline");

    await handleExternalChange(PATH);

    expect(useDocuments.getState().documents[0]?.markdown).toBe("# T\n\nline\n");
  });

  it("reloads a CRLF file as LF text and remembers its format", async () => {
    seed({ markdown: "disk", savedMarkdown: "disk", isDirty: false });
    vi.mocked(readTextFile).mockResolvedValue("new\r\nfrom disk\r\n");

    await handleExternalChange(PATH);

    const doc = useDocuments.getState().documents[0];
    expect(doc?.markdown).toBe("new\nfrom disk\n");
    expect(doc?.format).toEqual({ eol: "\r\n", bom: false, finalNewline: true });
  });

  it("adopts the new format when a tool only re-encodes the file", async () => {
    const crlf = { eol: "\r\n" as const, bom: true, finalNewline: true };
    seed({ markdown: "a\nb\n", savedMarkdown: "a\nb\n", format: crlf });
    vi.mocked(readTextFile).mockResolvedValue("a\nb\n"); // CRLF -> LF, BOM stripped

    await handleExternalChange(PATH);

    const doc = useDocuments.getState().documents[0];
    expect(ask).not.toHaveBeenCalled();
    expect(doc?.markdown).toBe("a\nb\n");
    expect(doc?.isDirty).toBe(false);
    expect(doc?.format).toEqual({ eol: "\n", bom: false, finalNewline: true });
  });

  it("on Keep, measures the local version against the disk so a revert stays dirty", async () => {
    seed({ markdown: "my edits", savedMarkdown: "disk", isDirty: true });
    vi.mocked(readTextFile).mockResolvedValue("new from disk");
    vi.mocked(ask).mockResolvedValue(false);

    await handleExternalChange(PATH);
    useDocuments.getState().setMarkdown("a", "disk"); // user reverts to the old baseline

    const doc = useDocuments.getState().documents[0];
    expect(doc?.savedMarkdown).toBe("new from disk");
    expect(doc?.isDirty).toBe(true);
  });

  it("does nothing and does not throw when the file read fails", async () => {
    seed({ markdown: "my edits", savedMarkdown: "disk", isDirty: true });
    vi.mocked(readTextFile).mockRejectedValue(new Error("EIO"));

    await expect(handleExternalChange(PATH)).resolves.toBeUndefined();

    expect(ask).not.toHaveBeenCalled();
    expect(useDocuments.getState().documents[0]?.markdown).toBe("my edits");
  });

  it("ignores changes to a path that is not open", async () => {
    seed({});

    await handleExternalChange("/other/unknown.md");

    expect(readTextFile).not.toHaveBeenCalled();
  });
});
