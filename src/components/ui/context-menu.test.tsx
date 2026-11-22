import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ContextMenu, ContextMenuItem } from "./context-menu";

function renderMenu(
  props: Partial<React.ComponentProps<typeof ContextMenu>> = {},
  items = ["One", "Two", "Three"],
) {
  const onDismiss = props.onDismiss ?? vi.fn();
  const selected = vi.fn();
  const view = render(
    <ContextMenu at={{ x: 10, y: 10 }} label="Actions" onDismiss={onDismiss} {...props}>
      {items.map((label) => (
        <ContextMenuItem
          key={label}
          label={label}
          icon={<svg />}
          onSelect={() => {
            selected(label);
          }}
        />
      ))}
    </ContextMenu>,
  );
  return { ...view, onDismiss, selected };
}

describe("ContextMenu", () => {
  it("renders nothing when closed", () => {
    render(
      <ContextMenu at={null} label="Actions" onDismiss={vi.fn()}>
        <ContextMenuItem label="One" icon={<svg />} onSelect={vi.fn()} />
      </ContextMenu>,
    );

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("focuses the first item on open", () => {
    renderMenu();

    expect(screen.getByRole("menuitem", { name: "One" })).toHaveFocus();
  });

  it("roves with arrows and wraps, and jumps with Home/End", () => {
    renderMenu();
    const menu = screen.getByRole("menu");
    const item = (name: string) => screen.getByRole("menuitem", { name });

    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(item("Two")).toHaveFocus();

    fireEvent.keyDown(menu, { key: "End" });
    expect(item("Three")).toHaveFocus();

    // Wrapping past the end is what keeps arrow keys from dead-ending.
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(item("One")).toHaveFocus();

    fireEvent.keyDown(menu, { key: "ArrowUp" });
    expect(item("Three")).toHaveFocus();

    fireEvent.keyDown(menu, { key: "Home" });
    expect(item("One")).toHaveFocus();
  });

  it("dismisses on Escape", () => {
    const { onDismiss } = renderMenu();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  // Tab used to walk out of the menu and leave it open behind the focus, with no
  // way back to it.
  it("closes on Tab instead of letting focus walk out", () => {
    const { onDismiss } = renderMenu();

    fireEvent.keyDown(screen.getByRole("menu"), { key: "Tab" });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("dismisses on an outside click but not on a click inside the menu", async () => {
    const user = userEvent.setup();
    const { onDismiss } = renderMenu();

    await user.click(screen.getByRole("menu"));
    expect(onDismiss).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("menu").parentElement as HTMLElement);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("dismisses before running the chosen action", async () => {
    const user = userEvent.setup();
    const order: string[] = [];
    const onDismiss = vi.fn(() => order.push("dismiss"));
    render(
      <ContextMenu at={{ x: 0, y: 0 }} label="Actions" onDismiss={onDismiss}>
        <ContextMenuItem label="Go" icon={<svg />} onSelect={() => order.push("select")} />
      </ContextMenu>,
    );

    await user.click(screen.getByRole("menuitem", { name: "Go" }));

    expect(order).toEqual(["dismiss", "select"]);
  });

  it("clamps to the viewport so a click near an edge never opens off-screen", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 200,
      height: 120,
    } as DOMRect);
    window.innerWidth = 400;
    window.innerHeight = 300;

    renderMenu({ at: { x: 390, y: 290 } });

    const menu = screen.getByRole("menu");
    // 400 - 200 - 8 margin, 300 - 120 - 8 margin.
    expect(menu.style.left).toBe("192px");
    expect(menu.style.top).toBe("172px");
    vi.restoreAllMocks();
  });

  describe("focus return", () => {
    function opener() {
      const button = document.createElement("button");
      button.id = "opener";
      document.body.append(button);
      return button;
    }

    it("returns focus to the opener when the menu closes", () => {
      const button = opener();
      const returnFocus = () => document.getElementById("opener");
      const { rerender } = render(
        <ContextMenu
          at={{ x: 0, y: 0 }}
          label="Actions"
          onDismiss={vi.fn()}
          returnFocus={returnFocus}
        >
          <ContextMenuItem label="One" icon={<svg />} onSelect={vi.fn()} />
        </ContextMenu>,
      );

      rerender(
        <ContextMenu at={null} label="Actions" onDismiss={vi.fn()} returnFocus={returnFocus}>
          <ContextMenuItem label="One" icon={<svg />} onSelect={vi.fn()} />
        </ContextMenu>,
      );

      expect(button).toHaveFocus();
      button.remove();
    });

    // Callers clear their target as they close, so a callback read at close time
    // would have nothing left to look for. It has to be captured on open.
    it("uses the callback as it was when the menu opened", () => {
      const button = opener();
      const { rerender } = render(
        <ContextMenu
          at={{ x: 0, y: 0 }}
          label="Actions"
          onDismiss={vi.fn()}
          returnFocus={() => document.getElementById("opener")}
        >
          <ContextMenuItem label="One" icon={<svg />} onSelect={vi.fn()} />
        </ContextMenu>,
      );

      // Exactly what a caller does: target goes null, so its callback now
      // resolves to nothing.
      rerender(
        <ContextMenu at={null} label="Actions" onDismiss={vi.fn()} returnFocus={() => undefined}>
          <ContextMenuItem label="One" icon={<svg />} onSelect={vi.fn()} />
        </ContextMenu>,
      );

      expect(button).toHaveFocus();
      button.remove();
    });

    it("does not bounce focus back when the menu re-targets while open", () => {
      const button = opener();
      const menuProps = (x: number) => ({
        at: { x, y: 0 },
        label: "Actions",
        onDismiss: vi.fn(),
        returnFocus: () => document.getElementById("opener"),
      });
      const { rerender } = render(
        <ContextMenu {...menuProps(0)}>
          <ContextMenuItem label="One" icon={<svg />} onSelect={vi.fn()} />
        </ContextMenu>,
      );

      rerender(
        <ContextMenu {...menuProps(50)}>
          <ContextMenuItem label="One" icon={<svg />} onSelect={vi.fn()} />
        </ContextMenu>,
      );

      // Still in the menu, not thrown back to the element that opened the first.
      expect(screen.getByRole("menuitem", { name: "One" })).toHaveFocus();
      button.remove();
    });
  });
});
