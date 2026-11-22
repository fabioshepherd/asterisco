import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tauri/window", () => ({
  minimizeWindow: vi.fn(),
  toggleMaximizeWindow: vi.fn(),
  closeWindow: vi.fn(),
}));

import i18n from "@/i18n";
import { toggleMaximizeWindow } from "@/lib/tauri/window";

import { TitleBar } from "./TitleBar";

describe("TitleBar", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage("en");
  });

  it("renders the menubar and window controls inside a drag region", () => {
    const { container } = render(<TitleBar />);
    expect(container.querySelector("[data-tauri-drag-region]")).not.toBeNull();
    expect(screen.getByRole("menubar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("double-clicking the drag spacer toggles maximize", async () => {
    const user = userEvent.setup();
    const { container } = render(<TitleBar />);
    const spacer = container.querySelector(".flex-1");
    expect(spacer).not.toBeNull();

    await user.dblClick(spacer as Element);

    expect(toggleMaximizeWindow).toHaveBeenCalled();
  });
});
