import { useEffect, useState } from "react";

import type { DropState } from "@/features/file-drop/drop";
import { openDroppedFiles } from "@/features/file-drop/open-dropped";

const IDLE: DropState = { phase: "idle" };

/**
 * True only for OS file drags. The webview runs with `dragDropEnabled: false`
 * (so HTML5 drag-and-drop works — required for table column reordering), which
 * means we route file drops through DOM events instead of Tauri's native
 * handler. Internal editor drags (table column/row reorder, text) carry no files,
 * so `types` lacks "Files" and we ignore them entirely — never calling
 * preventDefault, leaving Milkdown's own drag-and-drop untouched.
 */
function isFileDrag(dt: DataTransfer | null): boolean {
  return !!dt && Array.from(dt.types).includes("Files");
}

/**
 * Route files dropped on the window and expose the live drag state so the shell
 * can render the drop overlay. HTML5 hands us file *bytes* (not paths), so the
 * overlay can't classify by extension before the drop — it just signals an
 * active file drag; the real routing happens on drop in {@link openDroppedFiles}.
 * Listeners run in the capture phase so a file drop is handled here and stopped
 * before the editor (ProseMirror) tries to insert it.
 */
export function useFileDrop(): DropState {
  const [drag, setDrag] = useState<DropState>(IDLE);

  useEffect(() => {
    // dragenter/dragleave fire for every nested element, so track depth and only
    // clear the overlay once the drag has truly left the window.
    let depth = 0;

    const onDragEnter = (e: DragEvent) => {
      if (!isFileDrag(e.dataTransfer)) return;
      e.preventDefault();
      depth += 1;
      setDrag({ phase: "valid" });
    };

    const onDragOver = (e: DragEvent) => {
      if (!isFileDrag(e.dataTransfer)) return;
      // Required: without it the browser blocks the drop and navigates to the file.
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };

    const onDragLeave = (e: DragEvent) => {
      if (!isFileDrag(e.dataTransfer)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDrag(IDLE);
    };

    const onDrop = (e: DragEvent) => {
      if (!isFileDrag(e.dataTransfer)) return;
      e.preventDefault();
      e.stopPropagation();
      depth = 0;
      setDrag(IDLE);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length > 0) void openDroppedFiles(files);
    };

    window.addEventListener("dragenter", onDragEnter, true);
    window.addEventListener("dragover", onDragOver, true);
    window.addEventListener("dragleave", onDragLeave, true);
    window.addEventListener("drop", onDrop, true);

    return () => {
      window.removeEventListener("dragenter", onDragEnter, true);
      window.removeEventListener("dragover", onDragOver, true);
      window.removeEventListener("dragleave", onDragLeave, true);
      window.removeEventListener("drop", onDrop, true);
    };
  }, []);

  return drag;
}
