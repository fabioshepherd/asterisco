import { describe, expect, it, vi } from "vitest";
import { headingKeymap, paragraphKeymap } from "@milkdown/kit/preset/commonmark";
import { strikethroughKeymap } from "@milkdown/kit/preset/gfm";

import { FORMAT_KEYMAP, configFormattingShortcuts, milkdownToAppCombo } from "./formatting-keymap";

/** A single keymap entry as passed to `ctx.set(<keymap>.key, …)`. */
type KeymapEntry = { shortcuts: string | string[] };
/** Shape of a keymap config object, keyed by the entries this test inspects. */
type KeymapConfig = Record<
  "TurnIntoH1" | "TurnIntoH6" | "DowngradeHeading" | "TurnIntoText" | "ToggleStrikethrough",
  KeymapEntry
>;

describe("FORMAT_KEYMAP", () => {
  it("uses plain Mod for headings/paragraph and the chosen marks", () => {
    expect(FORMAT_KEYMAP.heading).toEqual(["Mod-1", "Mod-2", "Mod-3", "Mod-4", "Mod-5", "Mod-6"]);
    expect(FORMAT_KEYMAP.paragraph).toBe("Mod-0");
    expect(FORMAT_KEYMAP.strikethrough).toBe("Mod-Shift-x");
    expect(FORMAT_KEYMAP.link).toBe("Mod-k");
  });
});

describe("configFormattingShortcuts", () => {
  it("overrides heading, paragraph and strikethrough keymaps (preserving DowngradeHeading)", () => {
    const set = vi.fn<(key: unknown, config: KeymapConfig) => void>();
    configFormattingShortcuts({ set } as unknown as Parameters<
      typeof configFormattingShortcuts
    >[0]);

    const heading = set.mock.calls.find((c) => c[0] === headingKeymap.key)?.[1];
    expect(heading?.TurnIntoH1.shortcuts).toBe("Mod-1");
    expect(heading?.TurnIntoH6.shortcuts).toBe("Mod-6");
    expect(heading?.DowngradeHeading.shortcuts).toEqual(["Delete", "Backspace"]);

    const paragraph = set.mock.calls.find((c) => c[0] === paragraphKeymap.key)?.[1];
    expect(paragraph?.TurnIntoText.shortcuts).toBe("Mod-0");

    const strike = set.mock.calls.find((c) => c[0] === strikethroughKeymap.key)?.[1];
    expect(strike?.ToggleStrikethrough.shortcuts).toBe("Mod-Shift-x");
  });

  it("clears the mark/heading/paragraph combos when disabled (macOS native menu owns them)", () => {
    const set = vi.fn<(key: unknown, config: KeymapConfig) => void>();
    configFormattingShortcuts(
      { set } as unknown as Parameters<typeof configFormattingShortcuts>[0],
      true,
    );

    const heading = set.mock.calls.find((c) => c[0] === headingKeymap.key)?.[1];
    expect(heading?.TurnIntoH1.shortcuts).toEqual([]);
    expect(heading?.TurnIntoH6.shortcuts).toEqual([]);
    // Backspace/Delete downgrade stays bound on every platform.
    expect(heading?.DowngradeHeading.shortcuts).toEqual(["Delete", "Backspace"]);

    const paragraph = set.mock.calls.find((c) => c[0] === paragraphKeymap.key)?.[1];
    expect(paragraph?.TurnIntoText.shortcuts).toEqual([]);

    const strike = set.mock.calls.find((c) => c[0] === strikethroughKeymap.key)?.[1];
    expect(strike?.ToggleStrikethrough.shortcuts).toEqual([]);
  });
});

describe("milkdownToAppCombo", () => {
  it("converts Milkdown notation to the app combo notation", () => {
    expect(milkdownToAppCombo("Mod-1")).toBe("mod+1");
    expect(milkdownToAppCombo("Mod-Shift-x")).toBe("mod+shift+x");
    expect(milkdownToAppCombo("Mod-k")).toBe("mod+k");
  });
});
