import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useUi } from "@/stores/ui";

import { ViewModeControl } from "./ViewModeControl";

describe("ViewModeControl", () => {
  beforeEach(() => {
    useUi.setState({ viewMode: "edit" });
  });

  it("marks the active view as checked", () => {
    render(<ViewModeControl />);
    expect(screen.getByRole("radio", { name: /edit/i })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /reading/i })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("switches the view on click", () => {
    render(<ViewModeControl />);
    fireEvent.click(screen.getByRole("radio", { name: /reading/i }));
    expect(useUi.getState().viewMode).toBe("reading");
  });

  it("exposes a radiogroup", () => {
    render(<ViewModeControl />);
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
  });

  it("names each segment from its visible label, not a tooltip", () => {
    render(<ViewModeControl />);
    for (const label of [/source/i, /edit/i, /reading/i]) {
      expect(screen.getByRole("radio", { name: label })).toHaveTextContent(label);
    }
  });

  it("moves selection and focus together with the arrow keys", () => {
    render(<ViewModeControl />);
    const edit = screen.getByRole("radio", { name: /edit/i });
    edit.focus();
    fireEvent.keyDown(edit, { key: "ArrowRight" });
    expect(useUi.getState().viewMode).toBe("reading");

    // Focus has to travel with the selection: left behind, the roving tabIndex
    // strands on a segment the user is no longer on and the next arrow bounces
    // between the same two views instead of continuing along the group.
    const reading = screen.getByRole("radio", { name: /reading/i });
    expect(reading).toHaveFocus();
    fireEvent.keyDown(reading, { key: "ArrowRight" });
    expect(useUi.getState().viewMode).toBe("source");
  });
});
