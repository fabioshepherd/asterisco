import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@/i18n";

vi.mock("@/editor/DocumentEditor", () => ({
  DocumentEditor: () => <div data-testid="document-editor" />,
}));

import { App } from "./App";
import { mockReducedMotion } from "@/test/motion";
import { useUi } from "@/stores/ui";

describe("App", () => {
  beforeEach(() => {
    mockReducedMotion(false);
    useUi.setState({ sidebarVisible: true, distractionFree: false });
  });

  it("renders the shell with the status bar and the editor area", () => {
    render(<App />);

    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByTestId("document-editor")).toBeInTheDocument();
  });

  it("does not render a redundant app-title header", () => {
    render(<App />);
    // The window title lives in the native titlebar now; no in-app banner heading.
    expect(screen.queryByRole("banner")).toBeNull();
  });

  it("shows the floating reveal button when the sidebar is collapsed", () => {
    useUi.setState({ sidebarVisible: false, distractionFree: false });
    render(<App />);
    expect(screen.getByRole("button", { name: /toggle sidebar/i })).toBeInTheDocument();
  });

  it("hides the reveal button in distraction-free mode", () => {
    useUi.setState({ sidebarVisible: false, distractionFree: true });
    render(<App />);
    expect(screen.queryByRole("button", { name: /toggle sidebar/i })).toBeNull();
  });

  it("keeps the sidebar visible under reduced motion (collapse animation honored)", () => {
    mockReducedMotion(true);
    useUi.setState({ sidebarVisible: true, distractionFree: false });
    render(<App />);
    // The width/opacity collapse animation must resolve to the visible final state.
    expect(screen.getByRole("complementary")).toBeVisible();
  });
});
