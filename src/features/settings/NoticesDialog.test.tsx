import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tauri/resources", () => ({ readThirdPartyNotices: vi.fn() }));

import i18n from "@/i18n";
import { MotionProvider } from "@/app/MotionProvider";
import { readThirdPartyNotices } from "@/lib/tauri/resources";
import { mockReducedMotion } from "@/test/motion";

import { NoticesDialog } from "./NoticesDialog";
import { useNoticesDialog } from "./use-notices-dialog";

beforeEach(() => {
  mockReducedMotion(true);
  vi.mocked(readThirdPartyNotices).mockReset();
  useNoticesDialog.setState({ isOpen: false });
});

afterEach(() => {
  act(() => {
    useNoticesDialog.getState().close();
  });
});

function open() {
  act(() => {
    useNoticesDialog.getState().open();
  });
}

describe("NoticesDialog", () => {
  it("renders the fetched notices text when opened", async () => {
    vi.mocked(readThirdPartyNotices).mockResolvedValue("ACME LICENSE — all rights reserved");
    open();
    render(
      <MotionProvider>
        <NoticesDialog />
      </MotionProvider>,
    );

    expect(await screen.findByText("ACME LICENSE — all rights reserved")).toBeInTheDocument();
    expect(readThirdPartyNotices).toHaveBeenCalledTimes(1);
  });

  it("can be dismissed with Escape", async () => {
    const user = userEvent.setup();
    vi.mocked(readThirdPartyNotices).mockResolvedValue("notices");
    open();
    render(
      <MotionProvider>
        <NoticesDialog />
      </MotionProvider>,
    );

    expect(await screen.findByRole("dialog")).toBeVisible();
    await user.keyboard("{Escape}");
    expect(useNoticesDialog.getState().isOpen).toBe(false);
  });

  it("shows the localized error when the fetch rejects", async () => {
    vi.mocked(readThirdPartyNotices).mockRejectedValue({ kind: "resource", message: "missing" });
    open();
    render(
      <MotionProvider>
        <NoticesDialog />
      </MotionProvider>,
    );

    const expected = i18n.t("settings.notices.error", {
      ns: "editor",
      error: i18n.t("errors.resource", { ns: "editor", message: "missing" }),
    });
    expect(await screen.findByText(expected)).toBeInTheDocument();
  });
});
