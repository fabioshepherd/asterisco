import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@/i18n";

import { DropOverlay } from "./DropOverlay";
import { mockReducedMotion } from "@/test/motion";

describe("DropOverlay", () => {
  beforeEach(() => {
    mockReducedMotion(false);
  });

  it("renders nothing when idle", () => {
    render(<DropOverlay phase="idle" />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows the open prompt and supported files when a file is dragged in", () => {
    render(<DropOverlay phase="valid" />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Drop to open");
    expect(status).toHaveTextContent("Markdown and text files");
  });
});
