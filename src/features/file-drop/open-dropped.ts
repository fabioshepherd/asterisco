import i18n from "@/i18n";
import { useDocuments } from "@/stores/document";
import { notify } from "@/stores/notifications";

import { routeDroppedPath } from "./drop";

/**
 * Open files dropped on the window via HTML5 drag-and-drop. The browser hands
 * us the bytes, not a path, so each Markdown/text file opens as a new untitled
 * tab (a dragged file carries no path to track for save-in-place — use
 * File ▸ Open for that). Anything else is skipped with one explicit toast, so
 * the drop always has a visible outcome.
 */
export async function openDroppedFiles(files: File[]): Promise<void> {
  const skipped: string[] = [];
  for (const file of files) {
    if (routeDroppedPath(file.name) === "ignore") {
      skipped.push(file.name);
      continue;
    }
    const markdown = await file.text();
    const id = useDocuments.getState().createDocument({ markdown });
    useDocuments.getState().setActiveDocument(id);
  }
  if (skipped.length > 0) {
    notify.error(i18n.t("drop.skipped", { ns: "editor", count: skipped.length, name: skipped[0] }));
  }
}
