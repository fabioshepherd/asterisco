import { FileDown } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useTranslation } from "react-i18next";

import { fadeMotion, overlayMotion } from "@/lib/motion";

import type { DropPhase } from "./drop";

interface DropOverlayProps {
  phase: DropPhase;
}

/**
 * Veil + centered card shown while files are dragged over the window (drag
 * moments 1+2). Decorative/status only — the drop is handled by the window-level
 * HTML5 handler in useFileDrop, so this stays pointer-events-none and never
 * intercepts the drop. HTML5 can't read file extensions before the drop, so the
 * overlay just signals "drop to open" without asserting a count it can't honor;
 * skipped files are reported on drop via toast.
 * Animates transform/opacity only; reduced motion is honored globally via
 * MotionConfig.
 */
export function DropOverlay({ phase }: DropOverlayProps) {
  const { t } = useTranslation("editor");

  return (
    <AnimatePresence>
      {phase === "valid" && (
        <m.div
          {...fadeMotion}
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-bg/70"
        >
          <m.div
            {...overlayMotion}
            className="flex w-72 max-w-[80vw] flex-col items-center gap-2 rounded-lg border-2 border-dashed border-accent bg-surface p-8 text-center shadow-card"
          >
            <FileDown className="size-8 text-accent" aria-hidden="true" />
            <p className="text-sm font-medium text-fg">{t("drop.title")}</p>
            <p className="text-xs text-muted-fg">{t("drop.subtitle")}</p>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
