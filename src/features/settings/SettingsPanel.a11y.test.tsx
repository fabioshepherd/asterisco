import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { beforeEach, describe, expect, it } from "vitest";

import "@/i18n";
import i18n from "@/i18n";
import { MotionProvider } from "@/app/MotionProvider";
import { mockReducedMotion } from "@/test/motion";

import { SettingsPanel } from "./SettingsPanel";
import { useSettingsPanel } from "./use-settings-panel";

expect.extend(toHaveNoViolations);

beforeEach(async () => {
  mockReducedMotion(true);
  useSettingsPanel.setState({ isOpen: false, initialSection: null });
  await i18n.changeLanguage("en");
});

describe("SettingsPanel a11y", () => {
  it("has no detectable violations, scrolling or filtering", async () => {
    act(() => {
      useSettingsPanel.getState().open();
    });
    const { container } = render(
      <MotionProvider>
        <SettingsPanel />
      </MotionProvider>,
    );

    expect(await axe(container)).toHaveNoViolations();

    await userEvent.type(screen.getByRole("textbox", { name: /search settings/i }), "theme");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("is a non-modal dialog: the app beside it is not hidden from a screen reader", () => {
    act(() => {
      useSettingsPanel.getState().open();
    });
    render(
      <MotionProvider>
        <main>
          <p>The document</p>
        </main>
        <SettingsPanel />
      </MotionProvider>,
    );

    // A modal sheet would mark itself aria-modal and hide everything else; this
    // one is a column of the layout, and the document beside it stays readable.
    const sheet = screen.getByRole("dialog");
    expect(sheet).not.toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("The document")).toBeVisible();
    expect(screen.getByRole("main")).not.toHaveAttribute("aria-hidden");
  });

  it("names the sheet and every section it scrolls through", () => {
    act(() => {
      useSettingsPanel.getState().open();
    });
    render(
      <MotionProvider>
        <SettingsPanel />
      </MotionProvider>,
    );

    expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Settings sections" })).toBeInTheDocument();
    for (const name of ["Appearance", "Editor & files", "Shortcuts", "General"]) {
      expect(screen.getByRole("region", { name })).toBeInTheDocument();
    }
  });
});
