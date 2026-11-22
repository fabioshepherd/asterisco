import { describe, expect, it, vi } from "vitest";

// Records when the export module is evaluated: it must stay out of the startup
// graph (marked, the export CSS and font inlining load on the first export).
const loaded = vi.hoisted(() => ({ value: false }));
const ops = vi.hoisted(() => ({
  copyActiveDocumentAsHtml: vi.fn(),
  copyActiveDocumentAsMarkdown: vi.fn(),
  exportActiveDocumentHtml: vi.fn(),
  printActiveDocument: vi.fn(),
}));
vi.mock("@/features/export/export-ops", () => {
  loaded.value = true;
  return ops;
});

import { COMMANDS } from "./commands";

describe("export commands", () => {
  it("load the export code only when one runs", async () => {
    expect(loaded.value).toBe(false);
    COMMANDS["export-html"].run();
    await vi.waitFor(() => expect(ops.exportActiveDocumentHtml).toHaveBeenCalledOnce());
    expect(loaded.value).toBe(true);
  });

  it.each([
    ["print", "printActiveDocument"],
    ["copy-html", "copyActiveDocumentAsHtml"],
    ["copy-markdown", "copyActiveDocumentAsMarkdown"],
  ] as const)("%s runs %s", async (id, fn) => {
    COMMANDS[id].run();
    await vi.waitFor(() => expect(ops[fn]).toHaveBeenCalledOnce());
  });
});

describe("export commands when the export code fails to load", () => {
  it("report the failure instead of dropping it", async () => {
    vi.resetModules();
    vi.doMock("@/features/export/export-ops", () => {
      throw new Error("chunk missing");
    });
    const { COMMANDS: fresh } = await import("./commands");
    const { useNotifications } = await import("@/stores/notifications");
    const { default: i18n } = await import("@/i18n");

    fresh["export-html"].run();

    await vi.waitFor(() => {
      const last = useNotifications.getState().notifications.at(-1);
      expect(last?.kind).toBe("error");
      expect(last?.message).toContain(
        i18n.t("notify.exportFailed", { ns: "editor", error: "" }).trim(),
      );
    });
  });
});
