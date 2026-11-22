import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppMark } from "./AppMark";

describe("AppMark", () => {
  it("is hidden from assistive technology when it has no label", () => {
    const { container } = render(<AppMark />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).not.toHaveAttribute("role");
  });

  it("is an image named by its label when it has one", () => {
    const { getByRole } = render(<AppMark label="Asterisco" />);
    expect(getByRole("img", { name: "Asterisco" })).not.toHaveAttribute("aria-hidden");
  });

  it("draws in currentColor with the parts the motion slice animates", () => {
    const { container } = render(<AppMark />);
    expect(container.querySelector("svg")).toHaveAttribute("fill", "currentColor");
    expect(container.querySelectorAll(".spin")).toHaveLength(1);
    expect(container.querySelectorAll(".spin .drop")).toHaveLength(5);
    expect(container.querySelectorAll(".spin .core")).toHaveLength(1);
  });
});
