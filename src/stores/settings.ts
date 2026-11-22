import { create } from "zustand";

import { ACCENT_KEY, DEFAULT_ACCENT, resolveAccent, type Accent } from "@/features/themes/accents";
import {
  NEUTRAL_KEY,
  DEFAULT_NEUTRAL,
  resolveNeutral,
  type Neutral,
} from "@/features/themes/neutrals";

import type { ThemePreference } from "./theme";
import type { ViewMode } from "./ui";

export type Language = "it" | "en";

export const supportedLanguages: readonly Language[] = ["it", "en"];

/**
 * Editor body/reading font — maps to a bundled variable face via CSS variables
 * (serif → Source Serif 4, sans → Source Sans 3). Mono stays for code and
 * machine data only (DESIGN.md §6). See docs/THEMING.md.
 */
export type EditorFontFamily = "serif" | "sans";

export const EDITOR_FONT_FAMILIES: readonly EditorFontFamily[] = ["serif", "sans"];

/**
 * View the app lands in at launch, ordered raw → rendered to match the status
 * bar's axis. Reading is the larger half of this product's job (PRODUCT.md,
 * principle 2) and the canonical entry point is a double click on a file, so
 * this is applied once during startup — switching view later in the session is a
 * deliberate act and is not overridden.
 */
export const DEFAULT_VIEW_MODES: readonly ViewMode[] = ["source", "edit", "reading"];

/**
 * Validation ranges + defaults for the numeric editor/file settings. Single
 * source of truth shared by the setters (clamp a live value), `hydrate`
 * (sanitize a persisted/imported value) and the settings UI inputs — so the
 * three can never drift apart.
 */
export const EDITOR_FONT_SIZE = { min: 12, max: 28, default: 16 } as const;
/**
 * One text measure for edit, reading and source views (DESIGN.md §3, 66ch).
 * The default was 90 until Wave 2; `migrateSettings` maps a stored 90 below
 * schema v3 to 66, since every value is persisted on any change.
 */
export const LINE_WIDTH = { min: 50, max: 90, default: 66 } as const;
export const EDITOR_LINE_HEIGHT = { min: 1.2, max: 2.4, default: 1.7 } as const;

type NumericRange = { readonly min: number; readonly max: number; readonly default: number };

/** Clamp a live value to [min,max] and round to an integer (stepper semantics). */
function clampInt(value: number, { min, max }: NumericRange): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** Clamp the line height into range and round to one decimal place. */
function clampLineHeight(value: number): number {
  const { min, max } = EDITOR_LINE_HEIGHT;
  return Math.round(Math.min(max, Math.max(min, value)) * 10) / 10;
}

/**
 * Sanitize a persisted/imported integer setting. Unlike the setters — which
 * clamp a live slider to the nearest edge — a *stored* value outside the valid
 * range is treated as corrupt/legacy and replaced with the current default.
 * This is what lets a bumped default reach
 * users whose stored value is no longer valid, while still preserving any
 * in-range customization they deliberately chose.
 */
function sanitizeInt(value: unknown, range: NumericRange): number {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= range.min &&
    value <= range.max
    ? Math.round(value)
    : range.default;
}

/** Coerce a persisted/imported opening view to a known value (default edit). */
function sanitizeViewMode(value: unknown): ViewMode {
  return DEFAULT_VIEW_MODES.includes(value as ViewMode) ? (value as ViewMode) : "edit";
}

/** As {@link sanitizeInt}, but rounds valid line heights to one decimal place. */
function sanitizeLineHeight(value: unknown): number {
  const { min, max, default: fallback } = EDITOR_LINE_HEIGHT;
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
    ? Math.round(value * 10) / 10
    : fallback;
}

/** localStorage key mirrored for the pre-paint bootstrap (public/theme-init.js). */
export const THEME_PREF_KEY = "asterisco.theme-pref";

/**
 * localStorage key mirroring the UI language, read before the async store
 * loads (i18n init and public/theme-init.js) so the first paint is not English
 * for an Italian user. A cache only: the persisted store stays the truth.
 */
export const LANGUAGE_KEY = "asterisco.language";

/** Persisted, hydratable settings (no functions). */
export type PersistableSettings = Pick<
  SettingsState,
  | "themePreference"
  | "accent"
  | "neutral"
  | "customThemeName"
  | "language"
  | "defaultViewMode"
  | "autoSave"
  | "editorFontSize"
  | "lineWidth"
  | "editorFontFamily"
  | "editorLineHeight"
  | "autoPairing"
  | "showIgnoredFolders"
  | "revealActiveFile"
  | "hasSeenWelcome"
>;

export interface SettingsState {
  themePreference: ThemePreference;
  /** Accent colour — one of the curated Radix scales (over the selected neutral base). */
  accent: Accent;
  /** Neutral base palette — one of the curated Radix gray scales. */
  neutral: Neutral;
  /** Filename of the selected custom theme within the managed themes folder, or null. */
  customThemeName: string | null;
  language: Language;
  /** View a document opens in — source, edit, or reading. */
  defaultViewMode: ViewMode;
  /** Save documents that have a path shortly after typing stops, and on blur. */
  autoSave: boolean;
  /** Editor body font size in pixels. */
  editorFontSize: number;
  /** Editor content max width (reading measure) in ch — range 50–90, default 66. */
  lineWidth: number;
  /** Editor body/reading font face. */
  editorFontFamily: EditorFontFamily;
  /** Editor body line height (unitless multiplier). */
  editorLineHeight: number;
  /** Auto-pair brackets/quotes/backtick as you type (Typora-style). */
  autoPairing: boolean;
  /**
   * Reveal what `fs_policy` treats as noise: generated/vendored folders
   * (node_modules, target, dist) and anything the repository's `.gitignore`
   * excludes. The agent folders (`.github`, `.claude`, `.cursor`) are never
   * hidden either way — they are what this product is for.
   */
  showIgnoredFolders: boolean;
  /** Let the file tree follow the active document, opening the folders above it. */
  revealActiveFile: boolean;
  /** Whether the bundled welcome document has been shown already. */
  hasSeenWelcome: boolean;
  setThemePreference: (preference: ThemePreference) => void;
  setAccent: (accent: Accent) => void;
  setNeutral: (neutral: Neutral) => void;
  setCustomThemeName: (name: string | null) => void;
  setLanguage: (language: Language) => void;
  setDefaultViewMode: (mode: ViewMode) => void;
  setAutoSave: (autoSave: boolean) => void;
  setEditorFontSize: (px: number) => void;
  setLineWidth: (ch: number) => void;
  setEditorFontFamily: (family: EditorFontFamily) => void;
  setEditorLineHeight: (value: number) => void;
  setAutoPairing: (value: boolean) => void;
  toggleIgnoredFolders: () => void;
  setRevealActiveFile: (value: boolean) => void;
  markWelcomeSeen: () => void;
  /** Replace persisted values during startup hydration (no side effects). */
  hydrate: (values: Partial<PersistableSettings>) => void;
  /**
   * Restore every user-configurable preference to its default. Intentionally
   * preserves app state (`hasSeenWelcome`, so the welcome doc doesn't reappear)
   * and the UI `language` (a preferences reset shouldn't flip the user's
   * chosen interface language). Clearing the injected custom-theme `<style>`
   * is handled by the caller (see `selectTheme(null)` in the themes feature).
   */
  resetToDefaults: () => void;
}

/**
 * User-configurable preference defaults, shared by the store's initial state
 * and {@link SettingsState.resetToDefaults} so the two can't drift. Excludes
 * `accent` (seeded live from the bootstrap mirror), `language` and
 * `hasSeenWelcome` (preserved across a reset — see `resetToDefaults`).
 */
const PREFERENCE_DEFAULTS = {
  themePreference: "system",
  customThemeName: null,
  defaultViewMode: "edit",
  autoSave: false,
  editorFontSize: EDITOR_FONT_SIZE.default,
  lineWidth: LINE_WIDTH.default,
  editorFontFamily: "serif",
  editorLineHeight: EDITOR_LINE_HEIGHT.default,
  autoPairing: true,
  showIgnoredFolders: false,
  revealActiveFile: true,
} as const satisfies Partial<PersistableSettings>;

function mirrorThemePref(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_PREF_KEY, preference);
  } catch {
    // localStorage may be unavailable; the bootstrap falls back to "system".
  }
}

function mirrorAccent(accent: Accent): void {
  try {
    localStorage.setItem(ACCENT_KEY, accent);
  } catch {
    // localStorage may be unavailable; the bootstrap falls back to the default.
  }
}

/**
 * Seed the in-memory accent from the localStorage mirror so it matches what the
 * pre-paint bootstrap (public/theme-init.js) already applied — otherwise the
 * default would briefly clobber a persisted accent before the (async) store
 * hydration lands, causing a flash.
 */
function readMirroredAccent(): Accent {
  try {
    return resolveAccent(localStorage.getItem(ACCENT_KEY));
  } catch {
    return DEFAULT_ACCENT;
  }
}

function mirrorNeutral(neutral: Neutral): void {
  try {
    localStorage.setItem(NEUTRAL_KEY, neutral);
  } catch {
    // localStorage may be unavailable; the bootstrap falls back to the default.
  }
}

function mirrorLanguage(language: Language): void {
  try {
    localStorage.setItem(LANGUAGE_KEY, language);
  } catch {
    // localStorage may be unavailable; startup falls back to English until loaded.
  }
}

/** The mirrored UI language, or null when none (or an unsupported one) is stored. */
export function readMirroredLanguage(): Language | null {
  try {
    const value = localStorage.getItem(LANGUAGE_KEY);
    return supportedLanguages.find((language) => language === value) ?? null;
  } catch {
    return null;
  }
}

/** Seed the in-memory neutral from the bootstrap mirror (see readMirroredAccent). */
function readMirroredNeutral(): Neutral {
  try {
    return resolveNeutral(localStorage.getItem(NEUTRAL_KEY));
  } catch {
    return DEFAULT_NEUTRAL;
  }
}

export const useSettings = create<SettingsState>()((set) => ({
  ...PREFERENCE_DEFAULTS,
  accent: readMirroredAccent(),
  neutral: readMirroredNeutral(),
  language: readMirroredLanguage() ?? "en",
  hasSeenWelcome: false,
  setThemePreference: (themePreference) => {
    mirrorThemePref(themePreference);
    set({ themePreference });
  },
  setAccent: (accent) => {
    mirrorAccent(accent);
    set({ accent });
  },
  setNeutral: (neutral) => {
    mirrorNeutral(neutral);
    set({ neutral });
  },
  setCustomThemeName: (customThemeName) => set({ customThemeName }),
  setLanguage: (language) => {
    mirrorLanguage(language);
    set({ language });
  },
  setDefaultViewMode: (defaultViewMode) => set({ defaultViewMode }),
  setAutoSave: (autoSave) => set({ autoSave }),
  setEditorFontSize: (editorFontSize) =>
    set({ editorFontSize: clampInt(editorFontSize, EDITOR_FONT_SIZE) }),
  setLineWidth: (lineWidth) => set({ lineWidth: clampInt(lineWidth, LINE_WIDTH) }),
  setEditorFontFamily: (editorFontFamily) => set({ editorFontFamily }),
  setEditorLineHeight: (value) => set({ editorLineHeight: clampLineHeight(value) }),
  setAutoPairing: (autoPairing) => set({ autoPairing }),
  toggleIgnoredFolders: () => set((state) => ({ showIgnoredFolders: !state.showIgnoredFolders })),
  setRevealActiveFile: (revealActiveFile) => set({ revealActiveFile }),
  markWelcomeSeen: () => set({ hasSeenWelcome: true }),
  hydrate: (values) => {
    if (values.themePreference) mirrorThemePref(values.themePreference);
    // Coerce any persisted/imported accent to a known value (migration safety).
    const accent = values.accent === undefined ? undefined : resolveAccent(values.accent);
    if (accent) mirrorAccent(accent);
    const neutral = values.neutral === undefined ? undefined : resolveNeutral(values.neutral);
    if (neutral) mirrorNeutral(neutral);
    if (values.language) mirrorLanguage(values.language);
    // Sanitize numeric fields the same way: an out-of-range persisted value
    // (legacy default, corrupt store, hand-edited import) falls back to the
    // current default instead of leaking past the setters' validation.
    set({
      ...values,
      ...(accent ? { accent } : {}),
      ...(neutral ? { neutral } : {}),
      ...(values.editorFontSize !== undefined
        ? { editorFontSize: sanitizeInt(values.editorFontSize, EDITOR_FONT_SIZE) }
        : {}),
      ...(values.lineWidth !== undefined
        ? { lineWidth: sanitizeInt(values.lineWidth, LINE_WIDTH) }
        : {}),
      ...(values.defaultViewMode !== undefined
        ? { defaultViewMode: sanitizeViewMode(values.defaultViewMode) }
        : {}),
      ...(values.editorLineHeight !== undefined
        ? { editorLineHeight: sanitizeLineHeight(values.editorLineHeight) }
        : {}),
      ...(values.autoPairing !== undefined ? { autoPairing: Boolean(values.autoPairing) } : {}),
      ...(values.showIgnoredFolders !== undefined
        ? { showIgnoredFolders: Boolean(values.showIgnoredFolders) }
        : {}),
      ...(values.revealActiveFile !== undefined
        ? { revealActiveFile: Boolean(values.revealActiveFile) }
        : {}),
    });
  },
  resetToDefaults: () => {
    // Keep the localStorage mirrors (theme pref + accent) in sync with the
    // pre-paint bootstrap, exactly as the individual setters do.
    mirrorThemePref(PREFERENCE_DEFAULTS.themePreference);
    mirrorAccent(DEFAULT_ACCENT);
    mirrorNeutral(DEFAULT_NEUTRAL);
    // `language` and `hasSeenWelcome` are intentionally NOT reset (see the
    // action's doc comment).
    set({ ...PREFERENCE_DEFAULTS, accent: DEFAULT_ACCENT, neutral: DEFAULT_NEUTRAL });
  },
}));
