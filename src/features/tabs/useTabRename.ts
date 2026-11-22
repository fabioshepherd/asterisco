import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { saveDocumentAs } from "@/features/file-ops/file-ops";
import { localizeAppError } from "@/lib/tauri/localize-error";
import { renamePath } from "@/lib/tauri/fs";
import { documentDisplayName, type EditorDocument, useDocuments } from "@/stores/document";
import { notify } from "@/stores/notifications";
import { useWorkspace } from "@/stores/workspace";

import { buildTargetPath, mapRenameError, splitName, validateStem } from "./tab-rename";

interface EditTarget {
  id: string;
  oldPath: string;
  originalStem: string;
  ext: string;
}

export interface TabRename {
  editingId: string | null;
  draft: string;
  error: string | null;
  /** Saved doc → start inline edit. Unsaved doc → open Save As (no inline edit). */
  beginEdit: (doc: EditorDocument) => void;
  setDraft: (value: string) => void;
  commit: () => Promise<void>;
  cancel: () => void;
}

export function useTabRename(): TabRename {
  const { t } = useTranslation("editor");
  const [target, setTarget] = useState<EditTarget | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setTarget(null);
    setDraft("");
    setError(null);
  }, []);

  const beginEdit = useCallback(
    (doc: EditorDocument) => {
      if (doc.path === null) {
        // No file on disk yet — naming it is a Save As.
        void saveDocumentAs(doc.id).catch((e) =>
          notify.error(t("notify.saveFailed", { error: localizeAppError(e) })),
        );
        return;
      }
      const fileName = documentDisplayName(doc, "");
      const { stem, ext } = splitName(fileName);
      setTarget({ id: doc.id, oldPath: doc.path, originalStem: stem, ext });
      setDraft(stem);
      setError(null);
    },
    [t],
  );

  const commit = useCallback(async () => {
    if (!target) return;
    const problem = validateStem(draft, target.originalStem);
    if (problem === "unchanged") {
      reset();
      return;
    }
    if (problem) {
      // Keep the field open (ring + describedby) and surface the reason visibly:
      // the tab strip clips any inline popover, so the toast is the visible channel.
      const message = t(`tabs.rename.${problem}`);
      setError(message);
      notify.error(message);
      return;
    }

    const to = buildTargetPath(target.oldPath, draft, target.ext);
    try {
      await renamePath(target.oldPath, to);
      useDocuments.getState().updatePath(target.oldPath, to);
      useWorkspace.getState().refreshTree();
      reset();
    } catch (e) {
      const { key, keepOpen } = mapRenameError(e);
      const name = `${draft.trim()}${target.ext}`;
      if (keepOpen) {
        const message = t(key, { name });
        setError(message);
        notify.error(message);
      } else {
        notify.error(t(key, { name }));
        reset();
      }
    }
  }, [draft, reset, t, target]);

  // Stable identity while idle (target/draft/error unchanged) so the TabBar can
  // pass this to memoized tabs without re-rendering them on every keystroke.
  return useMemo(
    () => ({
      editingId: target?.id ?? null,
      draft,
      error,
      beginEdit,
      setDraft,
      commit,
      cancel: reset,
    }),
    [target?.id, draft, error, beginEdit, commit, reset],
  );
}
