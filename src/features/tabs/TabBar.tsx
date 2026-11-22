import { useDroppable } from "@dnd-kit/core";
import { horizontalListSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, X } from "lucide-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { closeTab, newFile } from "@/features/file-ops/file-ops";
import { tween } from "@/lib/motion";
import { revealInScroller } from "@/lib/reveal";
import { cn } from "@/lib/utils";
import { type EditorDocument, useDocuments } from "@/stores/document";
import { useUi } from "@/stores/ui";

import "./tab-bar.css";
import { flattenLabel, tabLabels } from "./tab-labels";
import { TabContextMenu, type TabMenuTarget } from "./TabContextMenu";
import { TAB_STRIP_END } from "./tab-dnd";
import { TabDndContext } from "./TabDndContext";
import { TabRenameInput } from "./TabRenameInput";
import { useTabRename, type TabRename } from "./useTabRename";

/** Empty strip space after the tabs: dropping a dragged tab here moves it to the end. */
function TabStripEnd() {
  const { setNodeRef } = useDroppable({ id: TAB_STRIP_END });
  return <div ref={setNodeRef} aria-hidden className="min-w-4 flex-1" />;
}

/** Props the parent strip passes to each sortable tab. */
interface SortableTabProps {
  doc: EditorDocument;
  index: number;
  selected: boolean;
  name: string;
  /** Folder suffix that tells this tab from another of the same name, if any. */
  context: string | null;
  /** Full path for the tooltip, or the name when the document is untitled. */
  title: string;
  rovingIndex: number;
  rename: TabRename;
  onSelect: (index: number) => void;
  onKeyDown: (event: React.KeyboardEvent, index: number) => void;
  onContextMenu: (event: React.MouseEvent, doc: EditorDocument) => void;
}

/**
 * One draggable tab. `useSortable` is called unconditionally at the top of this
 * component so the parent can render tabs via `.map` while keeping hooks legal.
 * All existing tab markup/behavior (rename input, unsaved dot, close button,
 * context menu, roving tabindex, motion width animation) lives here unchanged —
 * the whole tab body is the drag activator (it forwards `listeners.onPointerDown`),
 * so a press-and-drag reorders while a plain click still selects.
 */
const SortableTab = memo(function SortableTab({
  doc,
  index,
  selected,
  name,
  context,
  title,
  rovingIndex,
  rename,
  onSelect,
  onKeyDown,
  onContextMenu,
}: SortableTabProps) {
  const { t } = useTranslation("editor");
  const reduceMotion = useReducedMotion();
  const { listeners, setNodeRef, transform, transition, isDragging, isOver, active } = useSortable({
    id: doc.id,
  });

  // Insertion bar on the leading edge when another tab is hovering this one.
  const showDropBefore = isOver && active != null && active.id !== doc.id;
  // The folder suffix is decoration in the strip but identity to a screen
  // reader, which never sees the two spans side by side: it is spoken as part of
  // the tab's name, and hidden from the tree where it is rendered.
  const fullName = flattenLabel({ name, context });

  return (
    <m.div
      ref={setNodeRef}
      id={`tab-${doc.id}`}
      role="tab"
      aria-selected={selected}
      aria-controls="document-panel"
      aria-label={doc.isDirty ? t("tabs.unsavedName", { name: fullName }) : fullName}
      aria-keyshortcuts="Delete"
      tabIndex={index === rovingIndex ? 0 : -1}
      onClick={() => onSelect(index)}
      onKeyDown={(event) => onKeyDown(event, index)}
      onContextMenu={(event) => onContextMenu(event, doc)}
      // Middle-click closes, as it does in every browser, Notepad++ and VS Code.
      onAuxClick={(event) => {
        if (event.button !== 1) return;
        event.preventDefault();
        void closeTab(doc.id);
      }}
      onMouseDown={(event) => {
        // Chromium starts its autoscroll on middle-press; suppress it before it
        // leaves a scroll cursor stranded over the strip.
        if (event.button === 1) event.preventDefault();
      }}
      initial={{ opacity: 0, width: 0 }}
      animate={{ opacity: 1, width: "auto" }}
      exit={{ opacity: 0, width: 0 }}
      transition={tween.fast}
      style={{
        transform: isDragging ? undefined : CSS.Translate.toString(transform),
        transition: reduceMotion ? undefined : transition,
      }}
      className={cn(
        "group relative shrink-0 overflow-hidden",
        isDragging && "z-(--z-floating) opacity-40",
      )}
    >
      {/* Quiet insertion bar (2px, step 11 for 3:1), no glow — marks where the drop lands. */}
      {showDropBefore ? (
        <span aria-hidden className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-primary" />
      ) : null}
      {/* Intrinsic-width content (w-max): the wrapper animates width and
        clips this, so it never squishes — and following tabs and the +
        button reflow continuously via normal flow (no layout transforms,
        nothing to snap on unmount). The bottom border carries the active
        state; transparent on the rest keeps the row from shifting. */}
      <div
        // The whole tab body is the drag activator: forward only the pointer
        // listener (not dnd-kit's a11y `attributes`, which would clobber the
        // tab's role/aria). The PointerSensor's 4px threshold keeps a plain
        // click a select; we bail on non-primary buttons and while renaming.
        onPointerDown={(event) => {
          if (event.button !== 0 || rename.editingId === doc.id) return;
          listeners?.onPointerDown?.(event);
        }}
        className={cn(
          "flex w-max select-none items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors duration-(--motion-duration-fast) ease-snappy",
          selected
            ? "border-primary bg-bg text-fg"
            : "border-transparent text-muted-fg hover:bg-bg/60 hover:text-fg",
        )}
      >
        {rename.editingId === doc.id ? (
          <TabRenameInput
            value={rename.draft}
            error={rename.error}
            ariaLabel={t("tabs.rename.aria")}
            onChange={rename.setDraft}
            onCommit={() => void rename.commit()}
            onCancel={rename.cancel}
          />
        ) : (
          <span
            className="flex min-w-0 max-w-64 items-baseline gap-1.5"
            title={title}
            onDoubleClick={(event) => {
              event.stopPropagation();
              rename.beginEdit(doc);
            }}
          >
            <span className="min-w-0 truncate">{name}</span>
            {/* Machine data, so mono per the type tokens. Recessed with the
                muted token rather than an opacity, which would drop it under AA
                (the same trap `.cmdk-hint` documents). */}
            {context ? (
              <span
                aria-hidden
                className="min-w-0 max-w-32 truncate font-mono text-xs text-muted-fg"
              >
                {context}
              </span>
            ) : null}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          // Not a Tab stop: the tab is the one stop of the strip (APG Tabs), and
          // Delete/Backspace on it or its context menu close it from the keyboard.
          tabIndex={-1}
          aria-label={t("tabs.close", { name: fullName })}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            void closeTab(doc.id);
          }}
          // A 24×24 target (WCAG 2.5.8) around a 14px icon. It also holds the
          // unsaved dot, so the first keystroke never widens the tab: the dot
          // shows at rest and the × replaces it on tab hover or keyboard focus.
          className={cn(
            "ml-1 size-6 shrink-0 text-muted-fg transition-[color,background-color,opacity,transform] [&_svg]:size-3.5",
            !doc.isDirty &&
              "opacity-0 focus-visible:opacity-100 group-hover:opacity-100 group-focus-visible:opacity-100",
          )}
        >
          {doc.isDirty ? (
            // Decorative — the unsaved state is announced via the tab's
            // accessible name (aria-label above), not a nested live region.
            <span
              aria-hidden
              data-unsaved-dot
              className="size-1.5 rounded-full bg-primary group-hover:hidden group-focus-visible:hidden"
            />
          ) : null}
          <X
            className={cn(
              "size-3.5",
              doc.isDirty && "hidden group-hover:block group-focus-visible:block",
            )}
          />
        </Button>
      </div>
    </m.div>
  );
});

/** Tab strip for the open documents. One tab per document; click to switch. */
export function TabBar() {
  const { t } = useTranslation("editor");
  const allDocs = useDocuments((s) => s.documents);
  const tabs = useDocuments((s) => s.tabs);
  const activeId = useDocuments((s) => s.activeId);
  const setActiveDocument = useDocuments((s) => s.setActiveDocument);
  const sidebarVisible = useUi((state) => state.sidebarVisible);
  // The open documents, in tab order.
  const documents = useMemo(
    () =>
      tabs
        .map((id) => allDocs.find((d) => d.id === id))
        .filter((d): d is EditorDocument => d != null),
    [tabs, allDocs],
  );
  const untitled = t("untitled");
  // The values reach the memoized tabs as plain strings, so a re-run here does
  // not re-render a tab whose own label is unchanged.
  const labels = useMemo(() => tabLabels(allDocs, untitled), [allDocs, untitled]);
  const rename = useTabRename();
  const reduceMotion = useReducedMotion();
  const tablistRef = useRef<HTMLDivElement>(null);
  // Roving focus index. Manual activation: arrows move focus only; Enter/Space
  // (or a click) commits the document switch. Re-syncs to the active tab when
  // selection changes elsewhere (click, command palette, opening a file).
  const [rovingIndex, setRovingIndex] = useState(0);
  const [edges, setEdges] = useState({ start: false, end: false });
  // Right-click menu target (rename / close) — null when closed.
  const [menu, setMenu] = useState<TabMenuTarget | null>(null);

  const activeIndex = documents.findIndex((doc) => doc.id === activeId);

  useEffect(() => {
    if (activeIndex >= 0) setRovingIndex(activeIndex);
  }, [activeIndex]);

  // Keep the active tab in view when it changes (an arrow commit, the command
  // palette, a freshly created tab) — the strip scrolls horizontally. Not
  // `scrollIntoView`: it would move Chromium's Tab starting point to the tab.
  useEffect(() => {
    const active = tablistRef.current?.querySelector<HTMLElement>(
      '[role="tab"][aria-selected="true"]',
    );
    if (active) revealInScroller(active, "x", reduceMotion ? "auto" : "smooth");
  }, [activeId, reduceMotion]);

  // Fade whichever edge has tabs scrolled off-screen, so it reads as "more tabs
  // this way" instead of a hard clip.
  useEffect(() => {
    const el = tablistRef.current;
    if (!el) return;
    const update = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      setEdges({
        start: scrollLeft > 1,
        end: Math.ceil(scrollLeft + clientWidth) < scrollWidth - 1,
      });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [documents.length]);

  // Handlers are stabilized (useCallback) and read tab ids from `tabs`
  // (stable across markdown edits) rather than the markdown-bearing `documents`
  // array, so memoized tabs don't re-render on every keystroke. The roving
  // tabindex/focus is driven off the live DOM, so it needs no doc data either.
  const focusTab = useCallback((index: number) => {
    setRovingIndex(index);
    tablistRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[index]?.focus();
  }, []);

  const selectTab = useCallback(
    (index: number) => {
      const id = tabs[index];
      if (!id) return;
      setActiveDocument(id);
      setRovingIndex(index);
    },
    [tabs, setActiveDocument],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, index: number) => {
      const id = tabs[index];
      if (!id) return;
      const last = tabs.length - 1;
      switch (event.key) {
        case "ArrowRight":
          event.preventDefault();
          focusTab(index === last ? 0 : index + 1);
          break;
        case "ArrowLeft":
          event.preventDefault();
          focusTab(index === 0 ? last : index - 1);
          break;
        case "Home":
          event.preventDefault();
          focusTab(0);
          break;
        case "End":
          event.preventDefault();
          focusTab(last);
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          setActiveDocument(id);
          break;
        case "F2": {
          event.preventDefault();
          const doc = useDocuments.getState().documents.find((d) => d.id === id);
          if (doc) rename.beginEdit(doc);
          break;
        }
        case "Delete":
        case "Backspace": {
          // The APG's close gesture for a tab list. The closed tab takes focus
          // with it, so it is handed to whatever slid into its place — a
          // keyboard user closing four tabs never has to find the strip again.
          event.preventDefault();
          void closeTab(id).then(() => {
            requestAnimationFrame(() => {
              const remaining = useDocuments.getState().tabs;
              if (remaining.length > 0) focusTab(Math.min(index, remaining.length - 1));
            });
          });
          break;
        }
      }
    },
    [tabs, setActiveDocument, rename, focusTab],
  );

  const handleContextMenu = useCallback((event: React.MouseEvent, doc: EditorDocument) => {
    event.preventDefault();
    setMenu({ id: doc.id, x: event.clientX, y: event.clientY });
  }, []);

  if (documents.length === 0) return null;

  return (
    <TabDndContext>
      {/* "New tab" sits after the tablist, which may own only tabs. */}
      <div className="flex min-w-0 items-stretch bg-surface">
        <div
          ref={tablistRef}
          role="tablist"
          aria-label={t("tabs.label")}
          data-overflow-start={edges.start || undefined}
          data-overflow-end={edges.end || undefined}
          className={cn(
            "tab-strip flex min-w-0 items-stretch overflow-x-auto",
            !sidebarVisible && "pl-10",
          )}
        >
          <SortableContext items={tabs} strategy={horizontalListSortingStrategy}>
            <AnimatePresence initial={false}>
              {documents.map((doc, index) => (
                <SortableTab
                  key={doc.id}
                  doc={doc}
                  index={index}
                  selected={doc.id === activeId}
                  name={labels.get(doc.id)?.name ?? untitled}
                  context={labels.get(doc.id)?.context ?? null}
                  title={doc.path ?? labels.get(doc.id)?.name ?? untitled}
                  rovingIndex={rovingIndex}
                  rename={rename}
                  onSelect={selectTab}
                  onKeyDown={handleKeyDown}
                  onContextMenu={handleContextMenu}
                />
              ))}
            </AnimatePresence>
          </SortableContext>
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          aria-label={t("tabs.new")}
          title={t("tabs.new")}
          onClick={() => newFile()}
          className="m-1 shrink-0 text-muted-fg"
        >
          <Plus className="size-4" />
        </Button>
        <TabStripEnd />
      </div>
      <TabContextMenu
        target={menu}
        onDismiss={() => setMenu(null)}
        onRename={() => {
          const doc = documents.find((d) => d.id === menu?.id);
          if (doc) rename.beginEdit(doc);
        }}
        onClose={() => {
          if (menu) void closeTab(menu.id);
        }}
      />
    </TabDndContext>
  );
}
