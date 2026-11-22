import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@tauri-apps/plugin-dialog", () => ({ ask: vi.fn() }));

import { ask } from "@tauri-apps/plugin-dialog";

import "@/i18n";
import i18n from "@/i18n";
import { MotionProvider } from "@/app/MotionProvider";
import { mockReducedMotion } from "@/test/motion";

import { KEY_ACTIONS, useKeybindings } from "./keybindings";
import { SettingsPanel } from "./SettingsPanel";
import { useSettingsPanel } from "./use-settings-panel";

/**
 * jsdom has no layout: give the Shortcuts section a fake offset and record the
 * scroller's scrollTo calls, so a jump can be checked by where it scrolls.
 */
function trackSectionScroll() {
  vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.tagName === "SECTION" && this.textContent?.startsWith("Shortcuts") ? 500 : 0;
  });
  return vi.spyOn(Element.prototype, "scrollTo");
}

/** True once the scroller was asked to bring the Shortcuts heading under the header. */
function scrolledToShortcuts(scrollTo: ReturnType<typeof trackSectionScroll>): boolean {
  // scrollTo is overloaded; the panel only ever passes the options form.
  return scrollTo.mock.calls.some((args) => (args[0] as ScrollToOptions | undefined)?.top === 476);
}

function openPanel(section?: string) {
  act(() => {
    useSettingsPanel.getState().open(section);
  });
  return render(
    <MotionProvider>
      <SettingsPanel />
    </MotionProvider>,
  );
}

beforeEach(async () => {
  mockReducedMotion(true);
  vi.mocked(ask).mockClear();
  vi.restoreAllMocks();
  useSettingsPanel.setState({ isOpen: false, initialSection: null });
  useKeybindings.getState().resetAll();
  await i18n.changeLanguage("en");
});

describe("SettingsPanel", () => {
  it("reaches the visible final state under reduced motion when open", () => {
    openPanel();

    // The animated panel must settle to its visible state, not stay at opacity:0.
    expect(screen.getByRole("dialog")).toBeVisible();
  });

  it("names every section as a region and reaches it from the rail", async () => {
    openPanel();

    // One scroll, not four screens: every section is mounted and named, so the
    // rail navigates the page rather than swapping it.
    for (const name of ["Appearance", "Editor & files", "Shortcuts", "General"]) {
      expect(screen.getByRole("region", { name })).toBeInTheDocument();
    }

    const rail = screen.getByRole("navigation", { name: "Settings sections" });
    const items = within(rail).getAllByRole("button");
    expect(items).toHaveLength(4);
    // Plain jump links: no scroll spy marks a "current" section.
    for (const item of items) expect(item).not.toHaveAttribute("aria-current");

    const scrollTo = trackSectionScroll();
    await userEvent.click(within(rail).getByRole("button", { name: "Shortcuts" }));
    expect(scrolledToShortcuts(scrollTo)).toBe(true);
  });

  it("opens on a requested section so the Help menu can deep-link", () => {
    const scrollTo = trackSectionScroll();
    openPanel("shortcuts");

    expect(scrolledToShortcuts(scrollTo)).toBe(true);
    expect(useSettingsPanel.getState().initialSection).toBeNull();
  });

  it("stays open while the app beside it is used", async () => {
    act(() => {
      useSettingsPanel.getState().open();
    });
    render(
      <MotionProvider>
        <button type="button">Outside</button>
        <SettingsPanel />
      </MotionProvider>,
    );

    // The whole point of docking it: changing a preference means working in the
    // document next to it, and neither a click nor an Escape out there is a
    // dismissal of a panel that is not covering anything.
    await userEvent.click(screen.getByRole("button", { name: "Outside" }));
    expect(useSettingsPanel.getState().isOpen).toBe(true);

    await userEvent.keyboard("{Escape}");
    expect(useSettingsPanel.getState().isOpen).toBe(true);
  });

  it("clears the filter on the first Escape from inside, and closes on the second", async () => {
    openPanel();

    const search = screen.getByRole("textbox", { name: /search settings/i });
    await userEvent.type(search, "theme");
    await userEvent.keyboard("{Escape}");
    expect(search).toHaveValue("");
    expect(useSettingsPanel.getState().isOpen).toBe(true);

    await userEvent.keyboard("{Escape}");
    expect(useSettingsPanel.getState().isOpen).toBe(false);
  });

  it.each([
    ["Escape", () => userEvent.keyboard("{Escape}")],
    [
      "the Close button",
      () => userEvent.click(screen.getByRole("button", { name: "Close settings" })),
    ],
  ])("returns focus to where it was after closing with %s", async (_, closeIt) => {
    render(
      <MotionProvider>
        <button type="button">Origin</button>
      </MotionProvider>,
    );
    screen.getByRole("button", { name: "Origin" }).focus();
    openPanel();
    expect(screen.getByRole("textbox", { name: /search settings/i })).toHaveFocus();

    await closeIt();

    expect(useSettingsPanel.getState().isOpen).toBe(false);
    expect(screen.getByRole("button", { name: "Origin" })).toHaveFocus();
  });

  it("labels every shortcut row from i18n, never from its raw id", () => {
    openPanel("shortcuts");
    const panel = screen.getByRole("region", { name: "Shortcuts" });

    for (const action of KEY_ACTIONS) {
      const label = i18n.t(`shortcuts.actions.${action.labelKey}`, { ns: "editor" });
      expect(label).not.toBe(action.id);
      expect(within(panel).getByText(label)).toBeInTheDocument();
    }
    // The regression that shipped: a missing label map entry rendered the id.
    expect(within(panel).queryByText("focusFileTree")).not.toBeInTheDocument();
  });

  it("names each shortcut row's buttons after the action and the visible combo", () => {
    openPanel("shortcuts");
    const panel = screen.getByRole("region", { name: "Shortcuts" });

    for (const action of KEY_ACTIONS) {
      const label = i18n.t(`shortcuts.actions.${action.labelKey}`, { ns: "editor" });
      const reset = within(panel).getByRole("button", { name: `Reset ${label} shortcut` });
      const record = reset.previousElementSibling as HTMLElement;
      // Label in Name (SC 2.5.3): the name starts with the action and contains the visible combo.
      expect(record).toHaveAccessibleName(`${label}: ${record.textContent ?? ""}`);
      expect(record).toHaveAccessibleDescription(
        "Activate to record a new combination. Esc cancels.",
      );
    }
  });

  it("keeps language and reset in a section of their own", () => {
    openPanel();
    const general = screen.getByRole("region", { name: "General" });

    // They used to live in a footer band pinned under the tabs, because tabs
    // hid them from the other three screens. A single scroll owes them nothing.
    expect(within(general).getByRole("button", { name: "Reset to defaults" })).toBeVisible();
    expect(within(general).getByRole("radio", { name: "Italian" })).toBeVisible();
  });

  it("announces how many settings a search matched", async () => {
    openPanel();

    await userEvent.type(screen.getByRole("textbox", { name: /search settings/i }), "auto-save");

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/\d+ settings? match/);
  });

  it("finds a general setting without leaving two live copies of it", async () => {
    openPanel();

    // The search index and the sections render the same controls; both on screen
    // meant two roving radiogroups named "Italian" pointing at one label id.
    expect(screen.getAllByRole("radio", { name: "Italian" })).toHaveLength(1);

    await userEvent.type(screen.getByRole("textbox", { name: /search settings/i }), "language");

    expect(screen.getByRole("status")).toHaveTextContent("1 setting matches");
    expect(screen.getAllByRole("radio", { name: "Italian" })).toHaveLength(1);
  });

  it("honours a deep link while the panel is already open", () => {
    const scrollTo = trackSectionScroll();
    openPanel();
    expect(scrolledToShortcuts(scrollTo)).toBe(false);

    // Help ▸ Keyboard Shortcuts on an open panel used to do nothing at all.
    act(() => {
      useSettingsPanel.getState().open("shortcuts");
    });

    expect(scrolledToShortcuts(scrollTo)).toBe(true);
  });

  it("does not fire a row's command when its text label is clicked", async () => {
    openPanel();

    // A <label> forwards clicks to the first labelable descendant, and a button
    // is one: clicking a row's text must not run its command.
    await userEvent.click(screen.getByText("Reset settings"));

    expect(ask).not.toHaveBeenCalled();
  });

  it("names the action a combo already belongs to, and can move it", async () => {
    openPanel("shortcuts");
    const panel = screen.getByRole("region", { name: "Shortcuts" });

    // "Toggle outline" ships on mod+shift+k; recording it onto Find must not
    // fail silently, and must not leave two actions holding one combo.
    const record = within(panel).getByRole("button", { name: /^find: /i });
    await userEvent.click(record);
    await userEvent.keyboard("{Meta>}{Shift>}k{/Shift}{/Meta}");

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Toggle outline");

    await userEvent.click(within(alert).getByRole("button", { name: "Reassign" }));

    const bindings = useKeybindings.getState().bindings;
    expect(bindings.find).toBe("mod+shift+k");
    expect(bindings.outline).toBe("");
  });

  it("refuses a combo a fixed shortcut owns and names it", async () => {
    openPanel("shortcuts");
    const panel = screen.getByRole("region", { name: "Shortcuts" });

    const record = within(panel).getByRole("button", { name: /^find: /i });
    await userEvent.click(record);
    await userEvent.keyboard("{Meta>}{Tab}{/Meta}");

    // Two things at once: a modified Tab is a combo being offered rather than
    // "leave the control" (letting it out would reach the tab strip behind this
    // panel), and the combo is refused because tab cycling already owns it.
    expect(screen.getByRole("alert")).toHaveTextContent("Cycle recently used tabs");
    expect(useKeybindings.getState().bindings.find).toBe("mod+f");
  });

  it("lists the shortcuts the app owns and will not let you change", () => {
    openPanel("shortcuts");
    const panel = screen.getByRole("region", { name: "Shortcuts" });

    // Discoverability is the whole point of the rows: without them Ctrl+Tab is
    // a gesture nobody finds. They carry no record button, so the list cannot
    // offer something it will then refuse.
    expect(within(panel).getByText("Cycle recently used tabs")).toBeInTheDocument();
    // Gone with CODE-03: mod+1…6 are Heading 1–6.
    expect(within(panel).queryByText("Select tab by position")).toBeNull();
    expect(
      within(panel).queryByRole("button", {
        name: /^cycle recently used tabs: /i,
      }),
    ).toBeNull();
  });

  it("refuses a combo the menu owns and names the menu item", async () => {
    openPanel("shortcuts");
    const panel = screen.getByRole("region", { name: "Shortcuts" });

    const record = within(panel).getByRole("button", { name: /^find: /i });
    await userEvent.click(record);
    await userEvent.keyboard("{Meta>}z{/Meta}");

    expect(screen.getByRole("alert")).toHaveTextContent("Reserved by the menu item “Undo”");
    // Unchanged: the binding would have been stored and then never fired.
    expect(useKeybindings.getState().bindings.find).toBe("mod+f");
  });

  it("offers to reassign a File shortcut, which the keymap owns", async () => {
    openPanel("shortcuts");
    const panel = screen.getByRole("region", { name: "Shortcuts" });

    const record = within(panel).getByRole("button", { name: /^find: /i });
    await userEvent.click(record);
    await userEvent.keyboard("{Meta>}s{/Meta}");

    expect(screen.getByRole("alert")).toHaveTextContent("Already used by “Save”");
    await userEvent.click(within(panel).getByRole("button", { name: "Reassign" }));
    expect(useKeybindings.getState().bindings.find).toBe("mod+s");
    expect(useKeybindings.getState().bindings.save).toBe("");
  });
});
