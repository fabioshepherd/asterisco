import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { ACCENT_KEY } from "@/features/themes/accents";
import { DEFAULT_NEUTRAL } from "@/features/themes/neutrals";

import { LANGUAGE_KEY, readMirroredLanguage, THEME_PREF_KEY, useSettings } from "./settings";

describe("settings accent", () => {
  beforeEach(() => {
    localStorage.clear();
    useSettings.setState(useSettings.getInitialState());
  });

  it("defaults to orange", () => {
    expect(useSettings.getInitialState().accent).toBe("orange");
  });

  it("setAccent updates state and mirrors to localStorage for the bootstrap", () => {
    useSettings.getState().setAccent("grass");

    expect(useSettings.getState().accent).toBe("grass");
    expect(localStorage.getItem(ACCENT_KEY)).toBe("grass");
  });

  it("hydrate keeps a known accent", () => {
    useSettings.getState().hydrate({ accent: "teal" });

    expect(useSettings.getState().accent).toBe("teal");
  });

  it("hydrate coerces an unknown accent to the default", () => {
    useSettings.getState().hydrate({ accent: "bogus" as never });

    expect(useSettings.getState().accent).toBe("orange");
  });
});

describe("neutral setting", () => {
  beforeEach(() => {
    localStorage.clear();
    useSettings.setState(useSettings.getInitialState());
  });

  it("defaults to the default neutral", () => {
    expect(useSettings.getState().neutral).toBe(DEFAULT_NEUTRAL);
  });

  it("setNeutral updates the value and mirrors it to localStorage", () => {
    useSettings.getState().setNeutral("slate");
    expect(useSettings.getState().neutral).toBe("slate");
    expect(localStorage.getItem("asterisco.neutral")).toBe("slate");
  });

  it("hydrate coerces an unknown persisted neutral to the default", () => {
    useSettings.getState().hydrate({ neutral: "olive" as never });
    expect(useSettings.getState().neutral).toBe(DEFAULT_NEUTRAL);
  });

  it("resetToDefaults restores the default neutral", () => {
    useSettings.getState().setNeutral("gray");
    useSettings.getState().resetToDefaults();
    expect(useSettings.getState().neutral).toBe(DEFAULT_NEUTRAL);
  });
});

describe("settings editor typography", () => {
  beforeEach(() => {
    localStorage.clear();
    useSettings.setState(useSettings.getInitialState());
  });

  it("defaults the editor font family to serif and line height to 1.7", () => {
    const state = useSettings.getInitialState();
    expect(state.editorFontFamily).toBe("serif");
    expect(state.editorLineHeight).toBe(1.7);
  });

  it("defaults the text measure to 66ch", () => {
    expect(useSettings.getInitialState().lineWidth).toBe(66);
  });

  it("setLineWidth clamps to a readable measure range (50–90ch)", () => {
    useSettings.getState().setLineWidth(120);
    expect(useSettings.getState().lineWidth).toBe(90);
    useSettings.getState().setLineWidth(10);
    expect(useSettings.getState().lineWidth).toBe(50);
  });

  it("setEditorFontFamily updates the family", () => {
    useSettings.getState().setEditorFontFamily("sans");
    expect(useSettings.getState().editorFontFamily).toBe("sans");
  });

  it("setEditorLineHeight clamps to a readable range", () => {
    useSettings.getState().setEditorLineHeight(5);
    expect(useSettings.getState().editorLineHeight).toBe(2.4);
    useSettings.getState().setEditorLineHeight(0.5);
    expect(useSettings.getState().editorLineHeight).toBe(1.2);
  });

  it("setEditorLineHeight rounds to one decimal place", () => {
    useSettings.getState().setEditorLineHeight(1.66);
    expect(useSettings.getState().editorLineHeight).toBe(1.7);
  });
});

describe("settings hydrate — numeric sanitization", () => {
  beforeEach(() => {
    localStorage.clear();
    useSettings.setState(useSettings.getInitialState());
  });

  it("keeps an in-range persisted reading measure (user's deliberate choice)", () => {
    useSettings.getState().hydrate({ lineWidth: 72 });
    expect(useSettings.getState().lineWidth).toBe(72);
  });

  it("replaces an out-of-range/legacy reading measure with the current default", () => {
    // 46ch predates the 50–90 range; a bypassed clamp used to leak it through.
    useSettings.getState().hydrate({ lineWidth: 46 });
    expect(useSettings.getState().lineWidth).toBe(66);
  });

  it("replaces non-finite, non-number or out-of-range persisted values with defaults", () => {
    // Note: hydrate falls back to the DEFAULT (not the nearest edge) — unlike the
    // setters, which clamp. An out-of-range stored value is treated as corrupt.
    useSettings.getState().hydrate({
      editorFontSize: Number.NaN,
      editorLineHeight: "1.7" as never,
    });
    const state = useSettings.getState();
    expect(state.editorFontSize).toBe(16);
    expect(state.editorLineHeight).toBe(1.7);
  });

  it("rounds a valid persisted line height to one decimal place", () => {
    useSettings.getState().hydrate({ editorLineHeight: 1.66 });
    expect(useSettings.getState().editorLineHeight).toBe(1.7);
  });

  it("leaves absent numeric fields untouched", () => {
    useSettings.getState().hydrate({ language: "it" });
    const state = useSettings.getState();
    expect(state.lineWidth).toBe(66);
    expect(state.editorFontSize).toBe(16);
  });
});

describe("settings: autoPairing", () => {
  beforeEach(() => {
    localStorage.clear();
    useSettings.setState(useSettings.getInitialState());
  });

  it("defaults to true", () => {
    expect(useSettings.getState().autoPairing).toBe(true);
  });

  it("setAutoPairing updates the flag", () => {
    useSettings.getState().setAutoPairing(false);
    expect(useSettings.getState().autoPairing).toBe(false);
    useSettings.getState().setAutoPairing(true);
    expect(useSettings.getState().autoPairing).toBe(true);
  });

  it("hydrate coerces a persisted value to boolean", () => {
    useSettings.getState().hydrate({ autoPairing: 0 as never });
    expect(useSettings.getState().autoPairing).toBe(false);
    useSettings.getState().resetToDefaults();
    expect(useSettings.getState().autoPairing).toBe(true);
  });
});

describe("settings resetToDefaults", () => {
  beforeEach(() => {
    localStorage.clear();
    useSettings.setState(useSettings.getInitialState());
  });

  it("restores every user-configurable preference to its default", () => {
    const s = useSettings.getState();
    s.setThemePreference("dark");
    s.setAccent("tomato");
    s.setCustomThemeName("dracula.css");
    s.setAutoSave(true);
    s.setEditorFontSize(24);
    s.setLineWidth(60);
    s.setEditorFontFamily("sans");
    s.setEditorLineHeight(2.4);

    useSettings.getState().resetToDefaults();

    const state = useSettings.getState();
    expect(state.themePreference).toBe("system");
    expect(state.accent).toBe("orange");
    expect(state.customThemeName).toBeNull();
    expect(state.autoSave).toBe(false);
    expect(state.editorFontSize).toBe(16);
    expect(state.lineWidth).toBe(66);
    expect(state.editorFontFamily).toBe("serif");
    expect(state.editorLineHeight).toBe(1.7);
  });

  it("preserves hasSeenWelcome (app state, not a preference)", () => {
    useSettings.getState().markWelcomeSeen();
    expect(useSettings.getState().hasSeenWelcome).toBe(true);

    useSettings.getState().resetToDefaults();

    expect(useSettings.getState().hasSeenWelcome).toBe(true);
  });

  it("leaves the UI language unchanged", () => {
    useSettings.getState().setLanguage("it");

    useSettings.getState().resetToDefaults();

    expect(useSettings.getState().language).toBe("it");
  });

  it("re-mirrors the default theme + accent to localStorage for the bootstrap", () => {
    useSettings.getState().setAccent("tomato");
    useSettings.getState().setThemePreference("dark");

    useSettings.getState().resetToDefaults();

    expect(localStorage.getItem(ACCENT_KEY)).toBe("orange");
    expect(localStorage.getItem(THEME_PREF_KEY)).toBe("system");
  });
});

describe("settings custom theme name", () => {
  beforeEach(() => {
    localStorage.clear();
    useSettings.setState(useSettings.getInitialState());
  });

  it("stores and clears the custom theme by name", () => {
    useSettings.getState().setCustomThemeName("dracula.css");
    expect(useSettings.getState().customThemeName).toBe("dracula.css");
    useSettings.getState().setCustomThemeName(null);
    expect(useSettings.getState().customThemeName).toBeNull();
  });

  it("hydrates customThemeName and resets it to null", () => {
    useSettings.getState().hydrate({ customThemeName: "ink.css" });
    expect(useSettings.getState().customThemeName).toBe("ink.css");
    useSettings.getState().resetToDefaults();
    expect(useSettings.getState().customThemeName).toBeNull();
  });
});

describe("showIgnoredFolders setting", () => {
  beforeEach(() => {
    localStorage.clear();
    useSettings.setState(useSettings.getInitialState());
  });

  it("defaults to false", () => {
    expect(useSettings.getInitialState().showIgnoredFolders).toBe(false);
  });

  it("toggleIgnoredFolders flips the value", () => {
    useSettings.getState().toggleIgnoredFolders();
    expect(useSettings.getState().showIgnoredFolders).toBe(true);
    useSettings.getState().toggleIgnoredFolders();
    expect(useSettings.getState().showIgnoredFolders).toBe(false);
  });

  it("hydrate coerces a persisted value to boolean", () => {
    useSettings.getState().hydrate({ showIgnoredFolders: true });
    expect(useSettings.getState().showIgnoredFolders).toBe(true);
  });

  it("resetToDefaults restores false", () => {
    useSettings.setState({ showIgnoredFolders: true });
    useSettings.getState().resetToDefaults();
    expect(useSettings.getState().showIgnoredFolders).toBe(false);
  });
});

describe("settings accent — initial seed from the bootstrap mirror", () => {
  afterEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it("seeds the initial accent from the localStorage mirror (no flash before hydration)", async () => {
    localStorage.setItem(ACCENT_KEY, "tomato");
    vi.resetModules();

    const { useSettings: fresh } = await import("./settings");

    expect(fresh.getState().accent).toBe("tomato");
  });

  it("seeds the default when the mirror holds an unknown accent", async () => {
    localStorage.setItem(ACCENT_KEY, "chartreuse");
    vi.resetModules();

    const { useSettings: fresh } = await import("./settings");

    expect(fresh.getState().accent).toBe("orange");
  });
});

describe("settings language — bootstrap mirror (SHELL-09)", () => {
  afterEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it("mirrors the language on set and on hydrate", () => {
    useSettings.getState().setLanguage("it");
    expect(localStorage.getItem(LANGUAGE_KEY)).toBe("it");
    useSettings.getState().hydrate({ language: "en" });
    expect(localStorage.getItem(LANGUAGE_KEY)).toBe("en");
  });

  it("reads back only a supported language", () => {
    localStorage.setItem(LANGUAGE_KEY, "it");
    expect(readMirroredLanguage()).toBe("it");
    localStorage.setItem(LANGUAGE_KEY, "fr");
    expect(readMirroredLanguage()).toBeNull();
    localStorage.removeItem(LANGUAGE_KEY);
    expect(readMirroredLanguage()).toBeNull();
  });

  it("starts i18n and the store in the mirrored language, before the store loads", async () => {
    localStorage.setItem(LANGUAGE_KEY, "it");
    vi.resetModules();

    const { useSettings: fresh } = await import("./settings");
    const { default: freshI18n } = await import("@/i18n");

    expect(fresh.getState().language).toBe("it");
    expect(freshI18n.language).toBe("it");
  });
});
