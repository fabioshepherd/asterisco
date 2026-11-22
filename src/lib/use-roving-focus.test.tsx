import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useRovingFocus } from "./use-roving-focus";

function List({ count }: { count: number }) {
  const { refs, tabbable, onKeyDown } = useRovingFocus(count);
  return (
    <ul>
      {Array.from({ length: count }, (_, i) => (
        <li key={i}>
          <button
            ref={(el) => {
              refs.current[i] = el;
            }}
            tabIndex={tabbable === i ? 0 : -1}
            onKeyDown={(event) => onKeyDown(event, i)}
          >
            item {i}
          </button>
        </li>
      ))}
    </ul>
  );
}

describe("useRovingFocus", () => {
  it("keeps one tab stop and moves focus with the arrows, Home and End", () => {
    render(<List count={3} />);
    const items = screen.getAllByRole("button");
    expect(items.map((b) => b.tabIndex)).toEqual([0, -1, -1]);

    items[0]?.focus();
    fireEvent.keyDown(items[0]!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[1]);
    expect(items.map((b) => b.tabIndex)).toEqual([-1, 0, -1]);

    fireEvent.keyDown(items[1]!, { key: "End" });
    expect(document.activeElement).toBe(items[2]);
    fireEvent.keyDown(items[2]!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[2]);
    fireEvent.keyDown(items[2]!, { key: "Home" });
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(items[0]!, { key: "ArrowUp" });
    expect(document.activeElement).toBe(items[0]);
  });
});
