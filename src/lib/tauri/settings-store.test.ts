import { describe, expect, it } from "vitest";

import { migrateSettings, SETTINGS_SCHEMA_VERSION, type PersistedSettings } from "./settings-store";

const RAW_V0: Partial<PersistedSettings> = {
  themePreference: "dark",
  accent: "tomato",
  customThemePath: "/tmp/theme.css",
  language: "it",
  autoSave: true,
  editorFontSize: 18,
  lineWidth: 72,
  editorFontFamily: "sans",
  editorLineHeight: 1.9,
  autoPairing: false,
  hasSeenWelcome: true,
};

describe("migrateSettings", () => {
  it("exposes the current schema version", () => {
    expect(SETTINGS_SCHEMA_VERSION).toBe(4);
  });

  it("migrates a pre-versioned (v0) object to a v1 shape — identity for v1", () => {
    // 0 → 1 is a no-op: every recognized field is returned unchanged.
    expect(migrateSettings(RAW_V0, 0)).toEqual(RAW_V0);
  });

  it("maps the old default line width (90) to 66 below v3", () => {
    for (const version of [0, 1, 2]) {
      expect(migrateSettings({ lineWidth: 90 }, version)).toEqual({ lineWidth: 66 });
    }
  });

  it("keeps other stored line widths below v3", () => {
    expect(migrateSettings({ lineWidth: 72 }, 2)).toEqual({ lineWidth: 72 });
  });

  it("keeps a 90 chosen after the migration", () => {
    expect(migrateSettings({ lineWidth: 90 }, SETTINGS_SCHEMA_VERSION)).toEqual({ lineWidth: 90 });
  });

  it("migrates away mono reading font", () => {
    for (const version of [0, 1, 2, 3]) {
      expect(migrateSettings({ editorFontFamily: "mono" }, version)).toEqual({
        editorFontFamily: "serif",
      });
    }
    expect(migrateSettings({ editorFontFamily: "sans" }, 3)).toEqual({ editorFontFamily: "sans" });
  });

  it("drops unrecognized keys (shape narrowing)", () => {
    const withJunk = { ...RAW_V0, schemaVersion: 0, bogus: "x", nested: { a: 1 } };
    expect(migrateSettings(withJunk, 0)).toEqual(RAW_V0);
  });

  it("omits absent fields rather than emitting undefined values", () => {
    const result = migrateSettings({ language: "en" }, 0);
    expect(result).toEqual({ language: "en" });
    expect("editorFontSize" in result).toBe(false);
  });

  it("returns an empty object for non-record input", () => {
    expect(migrateSettings(null, 0)).toEqual({});
    expect(migrateSettings("nope", 0)).toEqual({});
    expect(migrateSettings(undefined, 0)).toEqual({});
  });

  it("keeps autoPairing through migrateSettings", () => {
    const out = migrateSettings({ autoPairing: false }, SETTINGS_SCHEMA_VERSION);
    expect(out.autoPairing).toBe(false);
  });

  it("migrates away docx export settings", () => {
    // DOCX export was removed: a store that still holds the reference-template
    // path loads without error and the key is dropped from every version.
    const stored = { language: "it", docxReferenceTemplatePath: "/tmpl.docx" };
    for (const version of [0, 1, SETTINGS_SCHEMA_VERSION]) {
      const out = migrateSettings(stored, version);
      expect(out).toEqual({ language: "it" });
      expect("docxReferenceTemplatePath" in out).toBe(false);
    }
  });

  it("migrates away smart punctuation settings", () => {
    // Smart punctuation was removed: a store that still holds its flag loads
    // without error and the key is dropped from every version.
    const stored = { language: "it", smartPunctuation: true };
    for (const version of [0, 1, SETTINGS_SCHEMA_VERSION]) {
      const out = migrateSettings(stored, version);
      expect(out).toEqual({ language: "it" });
      expect("smartPunctuation" in out).toBe(false);
    }
  });

  it("migrates away removed settings rows", () => {
    // The inline-base64 image mode and the auto-save mode/interval were removed:
    // a store that still holds them loads without error and the keys are dropped
    // from every version.
    const stored = {
      language: "it",
      imagePathMode: "base64",
      autoSaveMode: "on-change",
      autoSaveInterval: 30,
    };
    for (const version of [0, 1, SETTINGS_SCHEMA_VERSION]) {
      const out = migrateSettings(stored, version);
      expect(out).toEqual({ language: "it" });
      for (const key of ["imagePathMode", "autoSaveMode", "autoSaveInterval"]) {
        expect(key in out).toBe(false);
      }
    }
    // An interval-mode user keeps auto-save on; it now saves as they type.
    const intervalUser = { autoSave: true, autoSaveMode: "interval", autoSaveInterval: 5 };
    expect(migrateSettings(intervalUser, SETTINGS_SCHEMA_VERSION)).toEqual({ autoSave: true });
  });

  it("narrows customThemeName and preserves a legacy customThemePath for migration", () => {
    const out = migrateSettings(
      { customThemeName: "ink.css", customThemePath: "/old/abs/path.css" },
      SETTINGS_SCHEMA_VERSION,
    );
    expect(out.customThemeName).toBe("ink.css");
    expect(out.customThemePath).toBe("/old/abs/path.css");
  });
});
