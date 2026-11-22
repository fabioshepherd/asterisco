import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { revealInScroller } from "@/lib/reveal";
import { useRovingFocus } from "@/lib/use-roving-focus";
import { cn } from "@/lib/utils";
import { selectActiveDocument, useDocuments } from "@/stores/document";

import { extractHeadings } from "./outline-utils";

/**
 * Rendered heading elements of the WYSIWYG editor, in document order. Scoped to
 * the document panel's editable so Crepe's slash/block-edit menu — which also
 * renders heading tags — isn't mistaken for a document heading.
 */
function headingElements(): HTMLElement[] {
  const panel = document.getElementById("document-panel");
  if (!panel) return [];
  return Array.from(panel.querySelectorAll<HTMLElement>(".ProseMirror :is(h1,h2,h3,h4,h5,h6)"));
}

/** Document outline: the active document's headings, navigable + scroll-synced. */
export function Outline() {
  const { t } = useTranslation("editor");
  const markdown = useDocuments((state) => selectActiveDocument(state)?.markdown ?? "");
  const activeId = useDocuments((state) => state.activeId);
  const headings = useMemo(() => extractHeadings(markdown), [markdown]);
  const [activeIndex, setActiveIndex] = useState(0);
  // Mirrors the file tree / view mode control: one tab stop, arrows move within.
  const { refs, setFocusIndex, tabbable, onKeyDown } = useRovingFocus(headings.length);

  // Reset the roving focus target when the document changes.
  useEffect(() => {
    setFocusIndex(0);
  }, [activeId, setFocusIndex]);

  // Highlight the heading nearest the top of the editor viewport as it scrolls.
  // The work is coalesced into one rAF per frame so a fast scroll over a long
  // document never runs the O(n) measure more than once per paint.
  useEffect(() => {
    const scroller = document.getElementById("document-panel");
    if (!scroller) return;

    let frame = 0;
    const measure = () => {
      const top = scroller.getBoundingClientRect().top;
      let current = 0;
      headingElements().forEach((el, i) => {
        if (el.getBoundingClientRect().top - top <= 12) current = i;
      });
      setActiveIndex(current);
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };

    measure();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [activeId, headings.length]);

  // Follow the editor: keep the active heading visible inside the outline as the
  // document scrolls. Only the outline's own scroll container moves (and not at
  // all when the item is already visible), so the page itself never does — nor
  // the Tab starting point, which `scrollIntoView` would move in Chromium.
  useEffect(() => {
    const item = refs.current[activeIndex];
    if (item) revealInScroller(item, "y");
  }, [activeIndex, refs]);

  const goTo = (index: number) => {
    headingElements()[index]?.scrollIntoView({ block: "start", behavior: "smooth" });
    setActiveIndex(index);
    setFocusIndex(index);
  };

  if (headings.length === 0) {
    return <p className="px-3 py-2 text-xs text-muted-fg">{t("outline.empty")}</p>;
  }

  return (
    <nav aria-label={t("outline.label")} className="py-1">
      <ul>
        {headings.map((heading, i) => {
          const active = activeIndex === heading.index;
          return (
            <li key={heading.index}>
              <button
                ref={(el) => {
                  refs.current[i] = el;
                }}
                type="button"
                onClick={() => goTo(heading.index)}
                onKeyDown={(event) => onKeyDown(event, i)}
                tabIndex={tabbable === i ? 0 : -1}
                aria-current={active ? "location" : undefined}
                title={heading.text}
                style={{ paddingInlineStart: `${0.5 + (heading.level - 1) * 0.75}rem` }}
                className={cn(
                  "block w-full truncate rounded-md py-1.5 pr-2 text-left text-sm transition-colors duration-(--motion-duration-fast) ease-snappy hover:bg-muted hover:text-fg",
                  heading.level === 1 ? "font-medium" : "font-normal",
                  active ? "bg-muted text-fg" : "text-muted-fg",
                )}
              >
                {heading.text}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
