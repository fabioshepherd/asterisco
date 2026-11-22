import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tauri/window", () => ({
  minimizeWindow: vi.fn(),
  toggleMaximizeWindow: vi.fn(),
  closeWindow: vi.fn(),
}));

import i18n from "@/i18n";
import { closeWindow, minimizeWindow, toggleMaximizeWindow } from "@/lib/tauri/window";

import { WindowControls } from "./WindowControls";

describe("WindowControls", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage("en");
  });

  it("each control invokes its window action", async () => {
    const user = userEvent.setup();
    render(<WindowControls />);

    await user.click(screen.getByRole("button", { name: "Minimize" }));
    expect(minimizeWindow).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Maximize" }));
    expect(toggleMaximizeWindow).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(closeWindow).toHaveBeenCalledTimes(1);
  });
});
