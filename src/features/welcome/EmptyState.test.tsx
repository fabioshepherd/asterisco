import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import "@/i18n";
import { MotionProvider } from "@/app/MotionProvider";
import { mockReducedMotion } from "@/test/motion";
import { useDocuments } from "@/stores/document";
import { useRecents } from "@/stores/recents";

import { resetDocumentHistory } from "./document-history";
import { EmptyState } from "./EmptyState";

beforeEach(() => {
  mockReducedMotion(true);
  useRecents.setState({ recents: [] });
});

describe("EmptyState", () => {
  it("paints the quick actions in their final state on the very first frame", () => {
    // This is the first frame of a cold launch: DESIGN.md §5 forbids an entrance
    // here, so the actions must be present and visible with no animation to wait
    // out — under reduced motion and, identically, without it.
    render(
      <MotionProvider>
        <EmptyState />
      </MotionProvider>,
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3);
    buttons.forEach((button) => {
      expect(button).toBeVisible();
      expect(button.style.opacity).toBe("");
      expect(button.style.transform).toBe("");
    });
  });

  it("stays un-animated when the OS does not ask for reduced motion", () => {
    mockReducedMotion(false);
    const { container } = render(
      <MotionProvider>
        <EmptyState />
      </MotionProvider>,
    );

    // No inline opacity/transform anywhere: nothing is mid-entrance.
    const animating = container.querySelectorAll<HTMLElement>(
      "[style*='opacity'],[style*='transform']",
    );
    expect(animating).toHaveLength(0);
  });

  describe("the mark (A1)", () => {
    let animate: ReturnType<typeof vi.fn>;
    beforeEach(() => {
      mockReducedMotion(false);
      animate = vi.fn(() => ({ cancel: vi.fn() }) as unknown as Animation);
      Element.prototype.animate = animate as unknown as typeof Element.prototype.animate;
    });
    afterEach(() => {
      useDocuments.setState({ documents: [], tabs: [], activeId: null });
      resetDocumentHistory();
    });

    it("stays still at a cold launch", () => {
      render(
        <MotionProvider>
          <EmptyState />
        </MotionProvider>,
      );
      expect(animate).not.toHaveBeenCalled();
    });

    it("comes back with A1 after the last document closes", () => {
      const id = useDocuments.getState().createDocument();
      useDocuments.setState({ documents: [], tabs: [], activeId: null });
      expect(id).toBeTruthy();
      render(
        <MotionProvider>
          <EmptyState />
        </MotionProvider>,
      );
      expect(animate).toHaveBeenCalled();
    });

    it("plays A1 once: a later remount with no documents stays still", () => {
      useDocuments.getState().createDocument();
      useDocuments.setState({ documents: [], tabs: [], activeId: null });
      const first = render(
        <MotionProvider>
          <EmptyState />
        </MotionProvider>,
      );
      first.unmount();
      animate.mockClear();
      render(
        <MotionProvider>
          <EmptyState />
        </MotionProvider>,
      );
      expect(animate).not.toHaveBeenCalled();
    });
  });
});
