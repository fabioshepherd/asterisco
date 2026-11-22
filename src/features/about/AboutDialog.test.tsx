import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => true }));
vi.mock("@tauri-apps/api/app", () => ({ getVersion: vi.fn(() => Promise.resolve("1.0.0")) }));
vi.mock("@/features/updates/check-updates", () => ({ checkForUpdates: vi.fn() }));

import i18n from "@/i18n";
import { MotionProvider } from "@/app/MotionProvider";
import { useNoticesDialog } from "@/features/settings/use-notices-dialog";
import { checkForUpdates } from "@/features/updates/check-updates";
import { mockReducedMotion } from "@/test/motion";

import { AboutDialog } from "./AboutDialog";
import { useAboutDialog } from "./use-about-dialog";

function renderOpen() {
  act(() => {
    useAboutDialog.getState().open();
  });
  return render(
    <MotionProvider>
      <AboutDialog />
    </MotionProvider>,
  );
}

beforeEach(async () => {
  mockReducedMotion(true);
  vi.mocked(checkForUpdates).mockReset();
  useAboutDialog.setState({ isOpen: false });
  useNoticesDialog.setState({ isOpen: false });
  await i18n.changeLanguage("en");
});

afterEach(() => {
  act(() => {
    useAboutDialog.getState().close();
  });
});

describe("AboutDialog", () => {
  it("shows the name, the version and the licence, with a decorative mark", async () => {
    renderOpen();
    const dialog = await screen.findByRole("dialog", { name: "About Asterisco" });
    expect(dialog).toHaveTextContent("Asterisco");
    expect(await screen.findByText("Version 1.0.0")).toBeInTheDocument();
    expect(screen.getByText("Free and open-source software, MIT license.")).toBeInTheDocument();
    expect(dialog.querySelector("svg.app-mark")).toHaveAttribute("aria-hidden", "true");
  });

  it("is localized in Italian", async () => {
    await i18n.changeLanguage("it");
    renderOpen();
    expect(
      await screen.findByRole("dialog", { name: "Informazioni su Asterisco" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Controlla aggiornamenti" })).toBeInTheDocument();
  });

  it("says it is checking until the check has an answer", async () => {
    const user = userEvent.setup();
    let settle: () => void = () => undefined;
    vi.mocked(checkForUpdates).mockImplementation(
      (onChecked) =>
        new Promise<void>((resolve) => {
          settle = () => {
            onChecked?.();
            resolve();
          };
        }),
    );
    renderOpen();

    const button = await screen.findByRole("button", { name: "Check for updates" });
    await user.click(button);
    expect(screen.getByText("Checking for updates…")).toHaveAttribute("aria-live", "polite");
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveFocus();
    await user.click(button);
    expect(checkForUpdates).toHaveBeenCalledTimes(1);

    await act(async () => {
      settle();
      await Promise.resolve();
    });
    expect(screen.queryByText("Checking for updates…")).not.toBeInTheDocument();
    expect(button).not.toHaveAttribute("aria-disabled");
  });

  it("puts the first focus on Close", async () => {
    renderOpen();
    const dialog = await screen.findByRole("dialog");
    expect(dialog.querySelector("button")).toHaveFocus();
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
  });

  it("hands over to the third-party notices", async () => {
    const user = userEvent.setup();
    renderOpen();
    await user.click(await screen.findByRole("button", { name: "Third-party notices" }));
    expect(useAboutDialog.getState().isOpen).toBe(false);
    expect(useNoticesDialog.getState().isOpen).toBe(true);
  });

  it("closes with Escape", async () => {
    const user = userEvent.setup();
    renderOpen();
    expect(await screen.findByRole("dialog")).toBeVisible();
    await user.keyboard("{Escape}");
    expect(useAboutDialog.getState().isOpen).toBe(false);
  });
});
