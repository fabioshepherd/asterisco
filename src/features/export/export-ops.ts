import { emit, once } from "@tauri-apps/api/event";
import { writeHtml, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { save } from "@tauri-apps/plugin-dialog";

import { flushActiveEditor } from "@/editor/flush-editor";
import i18n from "@/i18n";
import { writeTextFile } from "@/lib/tauri/fs";
import { localizeAppError } from "@/lib/tauri/localize-error";
import { closeWindowByLabel, openPrintWindow } from "@/lib/tauri/window";
import {
  documentDisplayName,
  type EditorDocument,
  selectActiveDocument,
  useDocuments,
} from "@/stores/document";
import { type NotificationKind, notify } from "@/stores/notifications";

import { inlineExportFonts } from "./embed-fonts";
import { wrapStandaloneHtml } from "./render-html";
import { renderClipboardRichHtml, renderRichContentHtml } from "./render-rich";
import { buildExportCss, snapshotExportTheme } from "./theme-snapshot";

/** A print window that never signals ready (failed load) is abandoned after this. */
const PRINT_READY_TIMEOUT_MS = 10_000;

/** Export keys currently running, so a second invocation is ignored (no double export). */
const inFlight = new Set<string>();

type ExportOutcome = { kind: NotificationKind; message: string } | null;

/** The active document, after flushing pending editor edits into the store. */
function activeDocument(): EditorDocument | undefined {
  const { activeId } = useDocuments.getState();
  if (activeId) flushActiveEditor(activeId);
  return selectActiveDocument(useDocuments.getState());
}

/** Export base name: the document name without its extension. */
function exportTitle(doc: EditorDocument): string {
  return documentDisplayName(doc, i18n.t("untitled", { ns: "editor" })).replace(/\.[^./\\]+$/, "");
}

/**
 * Run the slow phase of an export under a sticky "in progress" toast with a
 * re-entrancy guard. Shows `pendingMessage`, runs `work`, then resolves the same
 * toast to its terminal state — or dismisses it when `work` returns null (the
 * print flow, whose save-vs-cancel outcome the OS dialog hides from us). A second
 * call with the same `key` while one is in flight is ignored.
 */
async function withExportFeedback(
  key: string,
  pendingMessage: string,
  work: () => Promise<ExportOutcome>,
  /** Re-runs the whole export, offered as "Retry" on any failure. */
  retry?: () => void,
): Promise<void> {
  if (inFlight.has(key)) return;
  inFlight.add(key);
  const retryAction = retry && { label: i18n.t("notify.retry", { ns: "editor" }), onAction: retry };
  const toastId = notify.pending(pendingMessage);
  try {
    const outcome = await work();
    if (outcome) {
      notify.update(
        toastId,
        outcome.kind,
        outcome.message,
        outcome.kind === "error" ? retryAction : undefined,
      );
    } else notify.dismiss(toastId);
  } catch (error) {
    notify.update(
      toastId,
      "error",
      i18n.t("notify.exportFailed", { ns: "editor", error: localizeAppError(error) }),
      retryAction,
    );
  } finally {
    inFlight.delete(key);
  }
}

/** Export the active document as a standalone HTML file. */
export async function exportActiveDocumentHtml(): Promise<void> {
  const doc = activeDocument();
  if (!doc) return;

  const title = exportTitle(doc);
  const path = await save({
    defaultPath: `${title}.html`,
    filters: [{ name: i18n.t("export.htmlFilter", { ns: "editor" }), extensions: ["html"] }],
  });
  if (typeof path !== "string") return;

  await withExportFeedback(
    "html",
    i18n.t("notify.exporting", { ns: "editor" }),
    async () => {
      // Exports default to light "paper": the artifact is for sharing and printing,
      // so it should not inherit the editor's dark theme.
      const theme = snapshotExportTheme("light");
      const [content, fontFaces] = await Promise.all([
        renderRichContentHtml(doc.markdown),
        inlineExportFonts(),
      ]);
      const html = wrapStandaloneHtml(content, title, buildExportCss(theme), fontFaces);
      await writeTextFile(path, html);
      return {
        kind: "success",
        message: i18n.t("notify.exported", {
          ns: "editor",
          name: path.split(/[/\\]/).pop() ?? path,
        }),
      };
    },
    () => void exportActiveDocumentHtml(),
  );
}

/**
 * Print via the OS print dialog (which also offers "Save as PDF"): open a
 * separate print window, hand it the sanitized content, and let it call
 * window.print() (Tauri 2 has no native print-to-PDF API).
 */
export async function printActiveDocument(): Promise<void> {
  const doc = activeDocument();
  if (!doc) return;

  await withExportFeedback(
    "print",
    i18n.t("notify.preparingPrint", { ns: "editor" }),
    async () => {
      const css = buildExportCss(snapshotExportTheme("light"));
      const payload = { contentHtml: await renderRichContentHtml(doc.markdown), css };

      // Listen before the window exists, so its "ready" cannot be missed.
      let label: string | null = null;
      let settled = false;
      let unlisten: Array<() => void> = [];
      let resolveOutcome: (outcome: ExportOutcome) => void = () => {};
      const outcome = new Promise<ExportOutcome>((resolve) => (resolveOutcome = resolve));
      // Ends the print exactly once: stops listening (a stale "ready" would
      // answer the next print's window), and closes the window if it has one.
      const settle = (value: ExportOutcome, closeWindow: boolean) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(readyTimer);
        for (const stop of unlisten) stop();
        if (closeWindow && label) void closeWindowByLabel(label);
        resolveOutcome(value);
      };
      // Guard a print window that never becomes ready (failed load): close it and
      // surface an error instead of leaving the pending toast spinning forever.
      const readyTimer = window.setTimeout(() => {
        settle(
          { kind: "error", message: i18n.t("notify.printWindowFailed", { ns: "editor" }) },
          true,
        );
      }, PRINT_READY_TIMEOUT_MS);
      unlisten = await Promise.all([
        once("print:ready", () => {
          window.clearTimeout(readyTimer);
          void emit("print:content", payload);
        }),
        // The OS print dialog hides whether the user saved or cancelled, so we
        // don't claim "exported" — just clear the pending toast.
        once("print:done", () => settle(null, true)),
      ]);
      if (settled) for (const stop of unlisten) stop();

      openPrintWindow(exportTitle(doc)).then(
        (opened) => {
          label = opened;
          // Opened after the print already ended (timed out): nothing will use it.
          if (settled) void closeWindowByLabel(opened);
        },
        (error: unknown) =>
          settle(
            {
              kind: "error",
              message: i18n.t("notify.exportFailed", {
                ns: "editor",
                error: localizeAppError(error),
              }),
            },
            false,
          ),
      );
      return await outcome;
    },
    () => void printActiveDocument(),
  );
}

/** Copy the active document's Markdown to the clipboard. */
export async function copyActiveDocumentAsMarkdown(): Promise<void> {
  const doc = activeDocument();
  if (!doc) return;
  try {
    await writeText(doc.markdown);
    notify.success(i18n.t("notify.copiedMarkdown", { ns: "editor" }));
  } catch (error) {
    notify.error(i18n.t("notify.exportFailed", { ns: "editor", error: localizeAppError(error) }), {
      label: i18n.t("notify.retry", { ns: "editor" }),
      onAction: () => void copyActiveDocumentAsMarkdown(),
    });
  }
}

/** Copy the active document as rich HTML (with a Markdown plain-text fallback). */
export async function copyActiveDocumentAsHtml(): Promise<void> {
  const doc = activeDocument();
  if (!doc) return;
  await withExportFeedback(
    "copy-html",
    i18n.t("notify.copying", { ns: "editor" }),
    async () => {
      const html = await renderClipboardRichHtml(doc.markdown);
      await writeHtml(html, doc.markdown);
      return { kind: "success", message: i18n.t("notify.copiedHtml", { ns: "editor" }) };
    },
    () => void copyActiveDocumentAsHtml(),
  );
}
