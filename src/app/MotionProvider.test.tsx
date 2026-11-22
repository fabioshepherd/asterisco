import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MotionProvider } from "./MotionProvider";

describe("MotionProvider", () => {
  it("renders its children", () => {
    render(
      <MotionProvider>
        <span>child</span>
      </MotionProvider>,
    );
    expect(screen.getByText("child")).toBeInTheDocument();
  });
});
