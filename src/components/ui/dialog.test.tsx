import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState } from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { MotionProvider } from "@/app/MotionProvider";
import { mockReducedMotion } from "@/test/motion";

import { Dialog, DialogContent, DialogTitle } from "./dialog";

let setOpen: (open: boolean) => void = () => {};

/**
 * Moves focus at the moment the dialog leaves — after the focus trap lets go,
 * before Radix's close auto-focus runs (a timeout after unmount). A move on the
 * next frame would land after the auto-focus and pass without the guard.
 */
function MovesFocusOnUnmount() {
  useEffect(
    () => () => {
      document.getElementById("elsewhere")?.focus();
    },
    [],
  );
  return null;
}

function Harness({ moveFocusOnClose = false }: { moveFocusOnClose?: boolean }) {
  const [open, setOpenState] = useState(false);
  setOpen = setOpenState;
  return (
    <MotionProvider>
      <button type="button">Origin</button>
      <button type="button" id="elsewhere">
        Elsewhere
      </button>
      <Dialog open={open} onOpenChange={setOpenState}>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>Example</DialogTitle>
          <input aria-label="Field" autoFocus />
          <button
            type="button"
            onClick={() => {
              setOpenState(false);
            }}
          >
            Done
          </button>
          {moveFocusOnClose && <MovesFocusOnUnmount />}
        </DialogContent>
      </Dialog>
    </MotionProvider>
  );
}

beforeEach(() => {
  mockReducedMotion(true);
});

describe("DialogContent", () => {
  it("returns focus to the element focused before it opened on Escape", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    screen.getByRole("button", { name: "Origin" }).focus();

    act(() => setOpen(true));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Field" })).toHaveFocus());
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("button", { name: "Origin" })).toHaveFocus());
  });

  it("leaves focus alone when the closing action moved it", async () => {
    const user = userEvent.setup();
    render(<Harness moveFocusOnClose />);
    screen.getByRole("button", { name: "Origin" }).focus();

    act(() => setOpen(true));
    await user.click(await screen.findByRole("button", { name: "Done" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("button", { name: "Elsewhere" })).toHaveFocus());
    // Let any late close-autofocus run, then check it did not take focus back.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByRole("button", { name: "Elsewhere" })).toHaveFocus();
  });
});
