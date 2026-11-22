import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@/i18n";

import { useUi } from "@/stores/ui";

import { SidebarRevealButton } from "./SidebarRevealButton";

describe("SidebarRevealButton", () => {
  beforeEach(() => {
    useUi.setState({ sidebarVisible: true, distractionFree: false });
  });

  it("renders nothing when the sidebar is visible", () => {
    render(<SidebarRevealButton />);
    expect(screen.queryByRole("button", { name: /toggle sidebar/i })).toBeNull();
  });

  it("renders nothing in distraction-free mode", () => {
    useUi.setState({ sidebarVisible: false, distractionFree: true });
    render(<SidebarRevealButton />);
    expect(screen.queryByRole("button", { name: /toggle sidebar/i })).toBeNull();
  });

  it("shows a button that reveals the sidebar when it is hidden", () => {
    useUi.setState({ sidebarVisible: false, distractionFree: false });
    render(<SidebarRevealButton />);

    fireEvent.click(screen.getByRole("button", { name: /toggle sidebar/i }));

    expect(useUi.getState().sidebarVisible).toBe(true);
  });
});
