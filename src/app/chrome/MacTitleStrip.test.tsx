import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tauri/fs", () => ({ renamePath: vi.fn() }));
vi.mock("@/features/file-ops/file-ops", () => ({
  saveDocumentAs: vi.fn(),
  closeTab: vi.fn(),
  newFile: vi.fn(),
}));

const { useWindowFullscreen } = vi.hoisted(() => ({
  useWindowFullscreen: vi.fn(() => false),
}));
vi.mock("./use-window-fullscreen", () => ({ useWindowFullscreen }));

import "@/i18n";
import { useDocuments } from "@/stores/document";
import { useUi } from "@/stores/ui";

import { MacTitleStrip } from "./MacTitleStrip";

describe("MacTitleStrip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWindowFullscreen.mockReturnValue(false);
    useDocuments.setState({ documents: [], activeId: null, tabs: [] });
    useUi.setState({ sidebarVisible: true });
    useDocuments.getState().createDocument({ markdown: "# hi" });
  });

  it("is a drag region that hosts the tab list", () => {
    const { container } = render(<MacTitleStrip />);
    expect(container.querySelector("[data-tauri-drag-region]")).not.toBeNull();
    expect(screen.getByRole("tablist")).toBeInTheDocument();
  });

  it("reserves the traffic-light inset and height when not fullscreen", () => {
    const { container } = render(<MacTitleStrip />);
    const strip = container.querySelector("[data-tauri-drag-region]");
    expect(strip?.className).toContain("pl-(--titlebar-mac-inset)");
    expect(strip?.className).toContain("min-h-(--titlebar-height)");
  });

  it("drops the inset and reserved height in fullscreen", () => {
    useWindowFullscreen.mockReturnValue(true);
    const { container } = render(<MacTitleStrip />);
    const strip = container.querySelector("[data-tauri-drag-region]");
    expect(strip?.className).not.toContain("pl-(--titlebar-mac-inset)");
    expect(strip?.className).not.toContain("min-h-(--titlebar-height)");
  });
});
