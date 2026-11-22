import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import "@/i18n";
import { MotionProvider } from "@/app/MotionProvider";
import { mockReducedMotion } from "@/test/motion";
import { useNotifications } from "@/stores/notifications";

import { focusNewestToast } from "./focus-toast";
import { Toaster } from "./Toaster";

// Run the toast suite under reduced motion so AnimatePresence enter/exit resolve
// to their final state instantly (jsdom does not run real animations); this also
// directly exercises the prefers-reduced-motion fallback path.
beforeEach(() => {
  mockReducedMotion(true);
  useNotifications.getState().clearAll();
});

// clearAll also tears down any auto-dismiss timers a test left armed, so a stray
// real-timer callback can't fire into a later test.
afterEach(() => {
  useNotifications.getState().clearAll();
});

function renderToaster() {
  return render(
    <MotionProvider>
      <Toaster />
    </MotionProvider>,
  );
}

describe("Toaster", () => {
  it("renders no toast when there are no notifications", () => {
    renderToaster();
    // The persistent (empty) live regions are always mounted; what's absent is any
    // visible toast — i.e. no dismiss/action buttons.
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows a notification and dismisses it on click", async () => {
    const user = userEvent.setup();
    renderToaster();

    act(() => {
      useNotifications.getState().notify("success", "Document saved");
    });
    // Two copies: the visible toast plus the polite live-region announcement.
    expect(await screen.findAllByText("Document saved")).not.toHaveLength(0);

    await user.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(screen.queryByText("Document saved")).not.toBeInTheDocument();
  });

  it("announces errors through the assertive live region", () => {
    act(() => {
      useNotifications.getState().notify("error", "Boom");
    });
    renderToaster();
    expect(screen.getByRole("alert")).toHaveTextContent("Boom");
  });

  it("escalates a resolved pending toast to the assertive region", () => {
    let id = "";
    renderToaster();
    act(() => {
      id = useNotifications.getState().notify("pending", "Working…");
    });
    // Polite while in progress, not yet an error.
    expect(screen.getByRole("status")).toHaveTextContent("Working…");
    expect(screen.getByRole("alert")).not.toHaveTextContent("Working…");

    act(() => {
      useNotifications.getState().update(id, "error", "It failed");
    });
    expect(screen.getByRole("alert")).toHaveTextContent("It failed");
  });

  it("reaches the final visible state under reduced motion", () => {
    act(() => {
      useNotifications.getState().notify("info", "Reduced motion toast");
    });
    renderToaster();
    // The visible toast (proved by its dismiss button) mounted to its final state.
    expect(screen.getByRole("button", { name: /dismiss/i })).toBeVisible();
  });

  it("renders an action button that runs its handler and dismisses the toast", async () => {
    const user = userEvent.setup();
    renderToaster();

    const onAction = vi.fn();
    act(() => {
      useNotifications.getState().notify("success", "Renamed to “b.md”", {
        action: { label: "Undo", onAction },
      });
    });

    await user.click(await screen.findByRole("button", { name: "Undo" }));
    expect(onAction).toHaveBeenCalledOnce();
    expect(screen.queryByText("Renamed to “b.md”")).not.toBeInTheDocument();
  });

  it("puts the stack in a named region and every kind on the plain surface", () => {
    act(() => {
      useNotifications.getState().notify("success", "Document saved");
      useNotifications.getState().notify("error", "Boom");
    });
    renderToaster();

    const region = screen.getByRole("region", { name: "Notifications" });
    const toasts = region.querySelectorAll("[data-toast]");
    expect(toasts).toHaveLength(2);
    for (const toast of Array.from(toasts)) {
      // A hairline on the surface; the icon carries the state, not a tint.
      expect(toast).toHaveClass("border-border", "bg-surface");
      expect(toast.className).not.toMatch(/bg-(accent|danger)/);
    }
  });

  it("focuses the newest toast's first control on request", async () => {
    act(() => {
      useNotifications.getState().notify("error", "Older");
      useNotifications.getState().notify("error", "Couldn’t save", {
        action: { label: "Retry", onAction: vi.fn() },
      });
    });
    renderToaster();

    focusNewestToast();

    await waitFor(() => expect(screen.getByRole("button", { name: "Retry" })).toHaveFocus());
  });

  it("coalesces an immediate duplicate fleeting toast", () => {
    act(() => {
      useNotifications.getState().notify("success", "Document saved");
      useNotifications.getState().notify("success", "Document saved");
    });
    expect(useNotifications.getState().notifications).toHaveLength(1);
  });

  it("clears every toast via the Clear all control", async () => {
    const user = userEvent.setup();
    act(() => {
      // Errors are sticky, so the stack is deterministic; 3 trips the control row.
      useNotifications.getState().notify("error", "e0");
      useNotifications.getState().notify("error", "e1");
      useNotifications.getState().notify("error", "e2");
    });
    renderToaster();

    await user.click(screen.getByRole("button", { name: /clear all/i }));
    expect(useNotifications.getState().notifications).toHaveLength(0);
  });

  describe("auto-dismiss timing", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("clears a success toast after its dwell window", () => {
      vi.useFakeTimers();
      act(() => {
        useNotifications.getState().notify("success", "Document saved");
      });
      renderToaster();

      act(() => {
        vi.advanceTimersByTime(11_000);
      });
      // Assert at the store level to avoid coupling to AnimatePresence exit timing.
      expect(useNotifications.getState().notifications).toHaveLength(0);
    });

    it("drains toasts that are scrolled out of the capped visible stack", () => {
      vi.useFakeTimers();
      act(() => {
        // More than MAX_VISIBLE (6); the extra two are not rendered, but their
        // auto-dismiss timers still run because the timer lives in the store.
        for (let i = 0; i < 8; i++) useNotifications.getState().notify("info", `msg ${i}`);
      });
      renderToaster();
      expect(useNotifications.getState().notifications).toHaveLength(8);

      act(() => {
        vi.advanceTimersByTime(11_000);
      });
      expect(useNotifications.getState().notifications).toHaveLength(0);
    });

    it("keeps a toast that carries an action sticky past the window", () => {
      vi.useFakeTimers();
      act(() => {
        useNotifications.getState().notify("success", "Renamed to “b.md”", {
          action: { label: "Undo", onAction: vi.fn() },
        });
      });
      renderToaster();

      act(() => {
        vi.advanceTimersByTime(11_000);
      });
      expect(useNotifications.getState().notifications).toHaveLength(1);
    });

    it("keeps an error toast sticky past the window — the user must dismiss it", () => {
      vi.useFakeTimers();
      act(() => {
        useNotifications.getState().notify("error", "Couldn't save: disk full");
      });
      renderToaster();

      act(() => {
        vi.advanceTimersByTime(11_000);
      });
      expect(useNotifications.getState().notifications).toHaveLength(1);
      expect(screen.getAllByText("Couldn't save: disk full").length).toBeGreaterThan(0);
    });

    it("stays put on a pending toast past the auto-dismiss window instead of vanishing", () => {
      vi.useFakeTimers();
      act(() => {
        useNotifications.getState().notify("pending", "Exporting…");
      });
      renderToaster();
      expect(screen.getAllByText("Exporting…").length).toBeGreaterThan(0);

      // A success toast would be gone by now; a pending one must persist.
      act(() => {
        vi.advanceTimersByTime(11_000);
      });
      expect(screen.getAllByText("Exporting…").length).toBeGreaterThan(0);
    });
  });
});
