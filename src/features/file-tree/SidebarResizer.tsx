import { useRef } from "react";
import { useTranslation } from "react-i18next";

import { clampSidebarWidth, SIDEBAR_WIDTH, useUi } from "@/stores/ui";

/** How far one arrow key moves the edge; Shift multiplies it. */
const STEP = 16;
const COARSE_STEP = 64;

/**
 * The sidebar's trailing edge, draggable and operable from the keyboard.
 *
 * The panel used to be a hardcoded `w-60` while the tree indents 0.75rem per
 * level, so a `docs/` folder three deep truncated every name and there was
 * nothing to do about it. This is the WAI-ARIA window-splitter pattern: a
 * focusable `separator` reporting its value, not a bare drag target that a
 * keyboard or a screen reader can't reach.
 *
 * It sits *inside* the panel's width because the layout clips the sidebar with
 * `overflow-hidden` to animate it open; an edge hanging outside would be cut.
 */
export function SidebarResizer({ controls }: { controls: string }) {
  const { t } = useTranslation("editor");
  const width = useUi((state) => state.sidebarWidth);
  const setSidebarWidth = useUi((state) => state.setSidebarWidth);
  const handleRef = useRef<HTMLDivElement>(null);

  const nudge = (delta: number) => setSidebarWidth(width + delta);

  /**
   * Which way the panel grows. Everything here used to assume the sidebar's
   * trailing edge is on the right: the drag measured from the panel's left edge
   * and ArrowRight always widened. In a right-to-left UI the panel sits on the
   * other side, `end-0` puts this strip on its left, and both were inverted.
   * Read from the nearest declared `dir` rather than from the active locale: a
   * direction can be set on the document or on any container above this one,
   * and the panel should follow the markup it is actually inside.
   */
  const isRtl = () => handleRef.current?.closest("[dir]")?.getAttribute("dir") === "rtl";

  return (
    <div
      ref={handleRef}
      role="separator"
      aria-orientation="vertical"
      aria-controls={controls}
      aria-label={t("fileTree.resize")}
      aria-valuenow={width}
      aria-valuemin={SIDEBAR_WIDTH.min}
      aria-valuemax={SIDEBAR_WIDTH.max}
      tabIndex={0}
      onPointerDown={(event) => {
        // Capture so the drag survives the pointer leaving the 6px strip — and
        // crossing the editor, which would otherwise swallow the move events.
        if (event.button !== 0) return;
        event.preventDefault();
        handleRef.current?.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!handleRef.current?.hasPointerCapture(event.pointerId)) return;
        const panel = handleRef.current.parentElement;
        if (!panel) return;
        const box = panel.getBoundingClientRect();
        const width = isRtl() ? box.right - event.clientX : event.clientX - box.left;
        setSidebarWidth(clampSidebarWidth(width));
      }}
      onPointerUp={(event) => handleRef.current?.releasePointerCapture(event.pointerId)}
      onDoubleClick={() => setSidebarWidth(SIDEBAR_WIDTH.default)}
      onKeyDown={(event) => {
        // The arrow that points away from the panel is the one that widens it.
        const step = (event.shiftKey ? COARSE_STEP : STEP) * (isRtl() ? -1 : 1);
        switch (event.key) {
          case "ArrowLeft":
            event.preventDefault();
            nudge(-step);
            break;
          case "ArrowRight":
            event.preventDefault();
            nudge(step);
            break;
          case "Home":
            event.preventDefault();
            setSidebarWidth(SIDEBAR_WIDTH.min);
            break;
          case "End":
            event.preventDefault();
            setSidebarWidth(SIDEBAR_WIDTH.max);
            break;
        }
      }}
      className="group absolute inset-y-0 end-0 z-10 flex w-1.5 cursor-col-resize justify-end outline-none"
    >
      {/* A hairline, not a bar: the edge only shows itself when you reach for
          it, and the ring has to be drawn here because the strip is 6px wide. */}
      <span
        aria-hidden
        className="h-full w-px bg-transparent transition-colors duration-(--motion-duration-fast) ease-snappy group-hover:bg-border group-focus-visible:w-0.5 group-focus-visible:bg-[var(--ring)]"
      />
    </div>
  );
}
