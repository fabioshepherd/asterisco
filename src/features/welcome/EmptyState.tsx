import { FilePlus, FileText, FolderOpen, type LucideIcon } from "lucide-react";
import { useId, useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { AppMark } from "@/components/brand/AppMark";
import { playEmptyStateReturn } from "@/components/brand/app-mark-motion";
import { Button } from "@/components/ui/button";
import { newFile, openFile, openPath } from "@/features/file-ops/file-ops";
import { openFolder, openRecentFolder } from "@/features/file-tree/workspace-ops";
import { useRovingFocus } from "@/lib/use-roving-focus";
import { cn } from "@/lib/utils";
import { useRecents } from "@/stores/recents";

import { consumeLastDocumentClosed } from "./document-history";

function baseName(path: string): string {
  return path.split(/[/\\]/).pop() ?? path;
}

/**
 * A labelled list of recent paths with roving keyboard navigation (Up/Down/
 * Home/End move focus, Enter opens) — the same pattern as the file tree and
 * outline, so the whole app navigates the same way. The heading is sentence
 * case (never a tracked uppercase eyebrow).
 */
function RecentList({
  label,
  items,
  icon: Icon,
  onSelect,
}: {
  label: string;
  items: string[];
  icon: LucideIcon;
  onSelect: (path: string) => void;
}) {
  const labelId = useId();
  const { refs, tabbable, onKeyDown } = useRovingFocus(items.length);

  return (
    <nav aria-labelledby={labelId} className="w-full max-w-sm">
      <h3 id={labelId} className="mb-2 text-xs font-medium text-muted-fg">
        {label}
      </h3>
      <ul className="flex flex-col gap-1">
        {items.map((path, i) => (
          <li key={path}>
            <button
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              tabIndex={tabbable === i ? 0 : -1}
              title={path}
              onClick={() => onSelect(path)}
              onKeyDown={(event) => onKeyDown(event, i)}
              className={cn(
                "flex w-full items-center gap-2 truncate rounded px-2 py-1 text-left text-sm text-muted-fg",
                "transition-colors duration-(--motion-duration-fast) ease-snappy hover:bg-muted hover:text-fg",
                "focus-visible:bg-muted focus-visible:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              )}
            >
              <Icon className="size-3.5 shrink-0" />
              <span className="truncate">{baseName(path)}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Welcoming screen shown when no document is open.
 *
 * Deliberately un-animated. This is the first frame of a cold launch, and
 * DESIGN.md §5 is explicit: "nothing animates at launch — 'open and see' means
 * the first frame is the document, not an entrance." The buttons used to fade
 * and rise on a 30ms stagger; that is choreography the user has to sit through
 * before the app is usable, which is the opposite of the product's first
 * principle. Motion here is earned by interaction (hover, press), not by arrival.
 * The one exception is the mark's return after the last document closes (A1,
 * DESIGN.md §5 "The logo exception"): a state change the user caused, never the
 * cold launch.
 */
export function EmptyState() {
  const { t } = useTranslation("editor");
  const recents = useRecents((state) => state.recents);
  const recentFolders = useRecents((state) => state.recentFolders);
  const markRef = useRef<SVGSVGElement>(null);

  // A1: the mark comes back only when the last document has just closed. At a
  // cold launch it is simply there. Layout effect, so its first frame is the
  // animation's first frame.
  useLayoutEffect(() => {
    if (consumeLastDocumentClosed()) playEmptyStateReturn(markRef.current);
  }, []);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-col items-center text-center">
        {/* Decorative. Static at launch (DESIGN.md §5); A1 after the last document closes. */}
        <AppMark ref={markRef} className="mb-4 size-10 text-muted-fg" />
        <h2 className="text-lg font-medium">{t("welcome.title")}</h2>
        <p className="mt-1 text-sm text-muted-fg">{t("welcome.subtitle")}</p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={() => newFile()}>
          <FilePlus className="size-4" />
          {t("welcome.newFile")}
        </Button>
        <Button variant="outline" onClick={() => void openFile()}>
          <FileText className="size-4" />
          {t("welcome.openFile")}
        </Button>
        <Button variant="outline" onClick={() => void openFolder()}>
          <FolderOpen className="size-4" />
          {t("welcome.openFolder")}
        </Button>
      </div>

      {recents.length > 0 ? (
        <RecentList
          label={t("welcome.recents")}
          items={recents}
          icon={FileText}
          onSelect={(path) => void openPath(path)}
        />
      ) : null}

      {recentFolders.length > 0 ? (
        <RecentList
          label={t("welcome.recentFolders")}
          items={recentFolders}
          icon={FolderOpen}
          onSelect={(path) => void openRecentFolder(path)}
        />
      ) : null}
    </div>
  );
}
