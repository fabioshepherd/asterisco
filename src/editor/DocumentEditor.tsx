import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { flushOnChangeNow } from "@/features/file-sync/on-change-auto-save";
import { EmptyState } from "@/features/welcome/EmptyState";
import { documentDisplayName, useDocuments } from "@/stores/document";
import { useUi } from "@/stores/ui";

import { CrepeEditor } from "./CrepeEditor";
import { handleDocumentLinkClick } from "./document-links";
import { SourceEditor } from "./SourceEditor";

/** Editor bound to a single document id; remounts when the id changes. */
function BoundEditor({ id }: { id: string }) {
  const setMarkdown = useDocuments((state) => state.setMarkdown);
  const setBaseline = useDocuments((state) => state.setBaseline);
  const viewMode = useUi((state) => state.viewMode);
  const { t } = useTranslation("editor");
  // Accessible name of both editors: the document's name (WCAG 4.1.2).
  const name = useDocuments((state) =>
    documentDisplayName(
      state.documents.find((doc) => doc.id === id),
      t("untitled"),
    ),
  );

  // Capture the document's markdown once: Crepe is uncontrolled after mount.
  const initialMarkdown = useRef(
    useDocuments.getState().documents.find((doc) => doc.id === id)?.markdown ?? "",
  ).current;

  // The Crepe editor stays mounted while in source mode (just hidden) so its
  // state survives the round-trip; SourceEditor pushes edits back into it.
  return (
    <>
      {/* Links open in the browser or a tab, never in the app window. */}
      <div
        className={viewMode === "source" ? "hidden" : undefined}
        onClickCapture={(event) =>
          handleDocumentLinkClick(event.nativeEvent, {
            reading: useUi.getState().viewMode === "reading",
            docPath: useDocuments.getState().documents.find((doc) => doc.id === id)?.path ?? null,
          })
        }
      >
        <CrepeEditor
          docId={id}
          ariaLabel={t("document.editorLabel", { name })}
          defaultValue={initialMarkdown}
          onReady={(markdown) => setBaseline(id, markdown)}
          onChange={(markdown) => setMarkdown(id, markdown)}
          onBlur={flushOnChangeNow}
        />
      </div>
      {viewMode === "source" ? (
        <SourceEditor id={id} ariaLabel={t("document.sourceLabel", { name })} />
      ) : null}
    </>
  );
}

/** Renders the active document in the editor, or nothing when none is open. */
export function DocumentEditor() {
  const activeId = useDocuments((s) => s.activeId);
  const viewMode = useUi((state) => state.viewMode);

  // Publish the live editor width as --editor-pane-w so the editor's wide blocks
  // (code/tables/images) can clamp their break-out to the real available width
  // without a CSS container — a container would re-root Crepe's fixed drag
  // drop-indicator. The var inherits into the Milkdown subtree below.
  const paneRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const pane = paneRef.current;
    if (!pane || typeof ResizeObserver === "undefined") return;
    // Defer the var-write to the next frame so it can't re-enter the observer
    // synchronously (the source of "ResizeObserver loop" notifications).
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        pane.style.setProperty("--editor-pane-w", `${pane.clientWidth}px`);
      });
    });
    observer.observe(pane);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  const tabpanelProps = activeId
    ? {
        role: "tabpanel" as const,
        id: "document-panel",
        "aria-labelledby": `tab-${activeId}`,
        // Reading view has no caret to scroll with: the panel itself takes focus
        // so the keyboard can scroll it (APG Tabs: a tabpanel without a focusable
        // child is focusable; WebKit scrollers are not).
        ...(viewMode === "reading" ? { tabIndex: 0 } : {}),
      }
    : {};

  return (
    <div
      {...tabpanelProps}
      ref={paneRef}
      data-editor-scroll
      data-view={viewMode}
      className="min-h-0 min-w-0 flex-1 overflow-auto focus-visible:-outline-offset-2"
    >
      {activeId ? <BoundEditor key={activeId} id={activeId} /> : <EmptyState />}
    </div>
  );
}
