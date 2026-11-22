import { beforeEach, describe, expect, it } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import "@/i18n";
import { MotionProvider } from "@/app/MotionProvider";
import { mockReducedMotion } from "@/test/motion";
import { UnsavedPromptDialog } from "./UnsavedPromptDialog";
import { useUnsavedPrompt, type UnsavedDecision } from "./use-unsaved-prompt";

beforeEach(() => {
  // Animated dialog uses motion components (strict LazyMotion) → render under the
  // provider; reduced motion makes enter resolve to the final state instantly.
  mockReducedMotion(true);
  useUnsavedPrompt.setState({ isOpen: false, documentName: "", resolver: null });
});

function renderDialog() {
  return render(
    <MotionProvider>
      <UnsavedPromptDialog />
    </MotionProvider>,
  );
}

describe("UnsavedPromptDialog", () => {
  it("stays hidden until a decision is requested", () => {
    renderDialog();

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("shows the document name and resolves with the chosen decision", async () => {
    const user = userEvent.setup();
    renderDialog();

    let decision!: Promise<UnsavedDecision>;
    act(() => {
      decision = useUnsavedPrompt.getState().requestDecision("notes.md");
    });

    await waitFor(() =>
      expect(screen.getByRole("alertdialog", { name: "Unsaved changes" })).toBeInTheDocument(),
    );
    expect(screen.getByRole("alertdialog")).toHaveAccessibleDescription(/notes\.md/);

    await user.click(screen.getByRole("button", { name: /don.t save/i }));

    await expect(decision).resolves.toBe("discard");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });
});
