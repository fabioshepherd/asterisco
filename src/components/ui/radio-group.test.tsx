import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { RadioGroup } from "./radio-group";

const OPTIONS = ["light", "dark", "system"] as const;

function Harness() {
  const [value, setValue] = useState<(typeof OPTIONS)[number]>("dark");
  return (
    <RadioGroup
      aria-label="Theme"
      options={OPTIONS}
      value={value}
      onChange={setValue}
      renderOption={(option) => option}
    />
  );
}

describe("RadioGroup", () => {
  it("marks the choice with aria-checked and a muted chip, never a solid fill", () => {
    render(<Harness />);
    const checked = screen.getByRole("radio", { name: "dark" });

    expect(screen.getByRole("radiogroup", { name: "Theme" })).toBeInTheDocument();
    expect(checked).toHaveAttribute("aria-checked", "true");
    expect(checked).toHaveClass("bg-muted", "text-fg", "border-muted-fg");
    expect(checked.className).not.toMatch(/bg-primary|bg-accent/);
    expect(screen.getByRole("radio", { name: "light" })).not.toHaveClass(
      "bg-muted",
      "border-muted-fg",
    );
  });

  it("keeps one tab stop and moves selection with focus on the arrow keys", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.tab();
    expect(screen.getByRole("radio", { name: "dark" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "system" })).toHaveFocus();
    expect(screen.getByRole("radio", { name: "system" })).toHaveAttribute("aria-checked", "true");
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: "light" })).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("radio", { name: "system" })).toHaveFocus();
    expect(screen.getAllByRole("radio").filter((radio) => radio.tabIndex === 0)).toHaveLength(1);
  });
});
