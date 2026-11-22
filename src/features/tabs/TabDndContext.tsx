import {
  type Announcements,
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";

import { documentDisplayName, useDocuments } from "@/stores/document";

import { resolveTabDrop } from "./tab-dnd";

/**
 * Pointer-first collision detection; falls back to rect intersection when the
 * pointer is outside every tab (keyboard / programmatic drags).
 */
const tabCollision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : rectIntersection(args);
};

/**
 * DndContext for reordering tabs within the strip by mouse drag. The keyboard
 * reorder is the `moveTabLeft` / `moveTabRight` commands (Mod+Shift+PageUp/Down)
 * and the context menu, so the sensors only ever see pointer drags in practice.
 */
export function TabDndContext({ children }: { children: ReactNode }) {
  const { t } = useTranslation("editor");
  const [activeTab, setActiveTab] = useState<{ name: string; dirty: boolean } | null>(null);

  // PointerSensor with a small distance so a plain click still selects a tab
  // (only a 4px drag activates).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const nameOf = (id: string): string => {
    const doc = useDocuments.getState().documents.find((d) => d.id === id);
    return documentDisplayName(doc, t("untitled"));
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => t("tabs.announce.lifted", { name: nameOf(String(active.id)) }),
    onDragOver: () => undefined,
    onDragEnd: ({ active }) => t("tabs.announce.dropped", { name: nameOf(String(active.id)) }),
    onDragCancel: () => t("tabs.announce.cancelled"),
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveTab(null);
    const { tabs, reorderTab } = useDocuments.getState();
    const id = String(active.id);
    const toIndex = resolveTabDrop(tabs, id, over ? String(over.id) : null);
    if (toIndex != null) reorderTab(id, toIndex);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={tabCollision}
      accessibility={{ announcements }}
      onDragStart={({ active }) => {
        const doc = useDocuments.getState().documents.find((d) => d.id === String(active.id));
        setActiveTab(
          doc ? { name: documentDisplayName(doc, t("untitled")), dirty: doc.isDirty } : null,
        );
      }}
      onDragCancel={() => setActiveTab(null)}
      onDragEnd={onDragEnd}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {activeTab ? (
          <div className="pointer-events-none flex items-center gap-1.5 rounded-md border border-border bg-bg px-3 py-1.5 text-sm text-fg shadow-card">
            <span className="max-w-44 truncate">{activeTab.name}</span>
            {activeTab.dirty ? (
              <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-primary" />
            ) : null}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
