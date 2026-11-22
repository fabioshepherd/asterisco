import { describe, expect, it } from "vitest";

import { FIXED_SHORTCUTS } from "./fixed-shortcuts";
import { KEY_ACTIONS, actionForCombo, useKeybindings } from "./keybindings";
import { reservedCombos, reservedForCombo, withoutReservedCombos } from "./reserved-combos";

describe("reservedForCombo", () => {
  it("leaves the File combos to the keymap, which dispatches them on every platform", () => {
    // They used to be reserved as "owned by the native menu" everywhere, but off
    // macOS there is no native menu: the keymap owns them, so they are remappable.
    for (const platform of ["mac", "win", "linux"] as const) {
      for (const combo of ["mod+n", "mod+o", "mod+shift+o", "mod+s", "mod+w", "mod+q", "mod+p"]) {
        expect(reservedForCombo(combo, platform)).toBeUndefined();
      }
    }
    expect(actionForCombo("mod+n")?.id).toBe("newFile");
    expect(actionForCombo("mod+w")?.id).toBe("closeTab");
  });

  it("claims the predefined-role accelerators the platform supplies", () => {
    expect(reservedForCombo("mod+z")?.labelKey).toBe("edit.undo");
    expect(reservedForCombo("mod+a")?.labelKey).toBe("edit.selectAll");
  });

  it("claims the combos the fixed app shortcuts own", () => {
    // Recording one of these used to be accepted and then shadowed by the tab
    // strip, which acts on the keystroke whatever the keymap says.
    expect(reservedForCombo("mod+tab")).toEqual({
      combo: "mod+tab",
      owner: "app",
      labelKey: "cycleRecent",
    });
  });

  it("covers every combo the fixed shortcuts declare", () => {
    const claimed = new Set(reservedCombos("linux").map((entry) => entry.combo));
    const declared = FIXED_SHORTCUTS.flatMap((shortcut) => [...shortcut.combos]);
    expect(declared.length).toBeGreaterThan(0);
    expect(declared.filter((combo) => !claimed.has(combo))).toEqual([]);
  });

  it("leaves an unclaimed combo alone", () => {
    expect(reservedForCombo("mod+shift+k")).toBeUndefined();
  });
});

describe("reserved combos match platform owners", () => {
  it("reserves mod+1…6 for Heading 1–6 and frees mod+7…9", () => {
    for (const platform of ["mac", "win", "linux"] as const) {
      expect(reservedForCombo("mod+1", platform)?.labelKey).toBe("format.heading1");
      expect(reservedForCombo("mod+6", platform)?.labelKey).toBe("format.heading6");
      expect(reservedForCombo("mod+0", platform)?.labelKey).toBe("format.paragraph");
      expect(reservedForCombo("mod+b", platform)?.labelKey).toBe("format.bold");
      for (const combo of ["mod+7", "mod+8", "mod+9"]) {
        expect(reservedForCombo(combo, platform)).toBeUndefined();
      }
    }
  });

  it("reserves the window roles only where the OS menu owns them", () => {
    // Minimize and Hide are native macOS menu roles; on Windows/Linux the DOM
    // menubar draws Minimize without a key and nothing listens for Ctrl+M/H.
    expect(reservedForCombo("mod+m", "mac")?.labelKey).toBe("window.controls.minimize");
    expect(reservedForCombo("mod+h", "mac")?.labelKey).toBe("app.hide");
    for (const platform of ["win", "linux"] as const) {
      expect(reservedForCombo("mod+m", platform)).toBeUndefined();
      expect(reservedForCombo("mod+h", platform)).toBeUndefined();
    }
  });

  it("reserves the edit roles on every platform", () => {
    for (const platform of ["mac", "win", "linux"] as const) {
      expect(reservedForCombo("mod+z", platform)?.labelKey).toBe("edit.undo");
      expect(reservedForCombo("mod+v", platform)?.labelKey).toBe("edit.paste");
    }
  });
});

describe("KEY_ACTIONS", () => {
  it("ships no default binding that the menu or a fixed shortcut already owns", () => {
    for (const platform of ["mac", "win", "linux"] as const) {
      const clashes = KEY_ACTIONS.filter((action) =>
        reservedForCombo(action.defaultCombo, platform),
      ).map((action) => action.id);
      expect(clashes).toEqual([]);
    }
  });

  it("ships no two actions on the same default combo", () => {
    const combos = KEY_ACTIONS.map((action) => action.defaultCombo).filter(Boolean);
    expect(combos.filter((combo, index) => combos.indexOf(combo) !== index)).toEqual([]);
  });

  it("keeps every group contiguous, so the rendered list needs no sorting", () => {
    const seen = new Set<string>();
    let previous: string | undefined;
    for (const action of KEY_ACTIONS) {
      if (action.group !== previous) {
        expect(seen.has(action.group)).toBe(false);
        seen.add(action.group);
        previous = action.group;
      }
    }
  });
});

describe("withoutReservedCombos", () => {
  it("migrates away select-tab-by-position keybindings", () => {
    // "Select tab by position" is gone (CODE-03). A stored entry under its name,
    // or a custom combo on a heading key, must load as if it had never existed.
    useKeybindings.getState().resetAll();
    useKeybindings
      .getState()
      .hydrate(
        withoutReservedCombos({ selectByPosition: "mod+1", outline: "mod+3", sidebar: "mod+7" }),
      );

    const { bindings } = useKeybindings.getState();
    expect(bindings).not.toHaveProperty("selectByPosition");
    expect(bindings.outline).toBe("mod+shift+k");
    expect(bindings.sidebar).toBe("mod+7");
    useKeybindings.getState().resetAll();
  });

  it("drops a stored binding a menu item now owns, keeping the rest", () => {
    // A custom `mod+z` would never fire: the edit role takes it first.
    expect(withoutReservedCombos({ outline: "mod+z", find: "mod+g", sidebar: "" })).toEqual({
      find: "mod+g",
      sidebar: "",
    });
  });
});
