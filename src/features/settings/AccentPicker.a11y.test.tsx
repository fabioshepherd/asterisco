import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it, vi } from "vitest";

import "@/i18n";
import { ACCENTS } from "@/features/themes/accents";

import { AccentPicker } from "./AccentPicker";

expect.extend(toHaveNoViolations);

describe("AccentPicker", () => {
  it("shows only the live accent until it is opened", async () => {
    render(<AccentPicker value="jade" onChange={() => {}} />);

    // One trigger, no swatch grid: the Signal Rule holds at rest.
    const trigger = screen.getByRole("button", { name: /jade/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();

    await userEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("radio")).toHaveLength(ACCENTS.length);
  });

  it("marks the selected accent with aria-checked (not colour alone)", async () => {
    render(<AccentPicker value="grass" onChange={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: /grass/i }));

    expect(screen.getByRole("radio", { name: /grass/i })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /jade/i })).toHaveAttribute("aria-checked", "false");
  });

  it("calls onChange with the picked accent", async () => {
    const onChange = vi.fn();
    render(<AccentPicker value="jade" onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: /jade/i }));
    await userEvent.click(screen.getByRole("radio", { name: /teal/i }));

    expect(onChange).toHaveBeenCalledWith("teal");
  });

  it("moves selection and focus with the arrow keys", async () => {
    const onChange = vi.fn();
    render(<AccentPicker value="orange" onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: /orange/i }));
    await userEvent.keyboard("{ArrowRight}");

    // ACCENTS[0] is orange, so ArrowRight lands on the second scale.
    expect(onChange).toHaveBeenCalledWith(ACCENTS[1]);
  });

  it("has no detectable a11y violations, collapsed or open", async () => {
    const { container } = render(<AccentPicker value="jade" onChange={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();

    await userEvent.click(screen.getByRole("button", { name: /jade/i }));
    expect(await axe(container)).toHaveNoViolations();
  });
});
