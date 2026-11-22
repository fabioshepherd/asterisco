import { isTauri } from "@tauri-apps/api/core";
import { ask } from "@tauri-apps/plugin-dialog";
import { RotateCcw, Search, X } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { Fragment, useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup } from "@/components/ui/radio-group";
import { Select } from "@/components/ui/select";
import {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { applyCustomThemeCss } from "@/features/themes/apply-theme";
import { NEUTRALS } from "@/features/themes/neutrals";
import { getThemesDir, listThemes, selectTheme } from "@/features/themes/themes-folder";
import { onThemesDirChanged, openThemesDir } from "@/lib/tauri/themes";
import { cn } from "@/lib/utils";
import {
  DEFAULT_VIEW_MODES,
  EDITOR_FONT_FAMILIES,
  EDITOR_FONT_SIZE,
  EDITOR_LINE_HEIGHT,
  LINE_WIDTH,
  useSettings,
  type EditorFontFamily,
  type Language,
} from "@/stores/settings";
import type { ThemePreference } from "@/stores/theme";

import { AccentPicker } from "./AccentPicker";
import { FIXED_SHORTCUTS } from "./fixed-shortcuts";
import {
  actionForCombo,
  eventToCombo,
  formatCombo,
  KEY_ACTIONS,
  useKeybindings,
} from "./keybindings";
import { reservedForCombo } from "./reserved-combos";
import { useSettingsPanel } from "./use-settings-panel";

/**
 * Four sections, one column. They split on a real axis: how the app looks, how
 * it treats a document and its folder, what the keyboard does, and what is
 * app-wide rather than document-wide (language and the factory reset). "General" used to be a footer band pinned under three tabs, because
 * tabs hid it from the other screens; a single scroll owes nobody that trick —
 * every section is one flick or one click away, so it is just the last one.
 */
const SECTIONS = ["appearance", "editor", "shortcuts", "general"] as const;
type Section = (typeof SECTIONS)[number];

/** Gap left above a section heading when a rail link scrolls to it. */
const SECTION_SCROLL_OFFSET = 24;

const THEME_PREFS: readonly ThemePreference[] = ["system", "light", "dark"];
const LANGUAGES: readonly Language[] = ["it", "en"];

/** Lower-case + strip diacritics so search matching is case- and accent-insensitive. */
const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Wrap the first case-insensitive match of `query` in `label` with a subtle mark. */
function highlightLabel(label: string, query?: string): React.ReactNode {
  const q = query?.trim().toLowerCase();
  if (!q) return label;
  const idx = label.toLowerCase().indexOf(q);
  if (idx === -1) return label;
  return (
    <>
      {label.slice(0, idx)}
      <mark className="rounded-xs bg-(--selection) text-fg">
        {label.slice(idx, idx + q.length)}
      </mark>
      {label.slice(idx + q.length)}
    </>
  );
}

/**
 * A settings row whose control is a single labelable element (input, switch,
 * select). An optional `hint` renders a quiet caption below the row; when set,
 * children are a render-prop receiving the caption's id so the control can
 * point at it with `aria-describedby` (the hint is then announced after the
 * label, not folded into it). `highlight` marks the matched substring while
 * the settings search is active.
 */
function Field({
  label,
  hint,
  highlight,
  children,
}: {
  label: string;
  hint?: string;
  highlight?: string;
  children: React.ReactNode | ((describedBy: string | undefined) => React.ReactNode);
}) {
  const hintId = useId();
  const describedBy = hint ? hintId : undefined;
  return (
    <div className="py-3">
      {/* Wraps rather than squeezes: in a column this narrow a control that no
          longer fits beside its label takes the next line whole, instead of
          crushing both into two illegible halves. */}
      <label className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
        <span>{highlightLabel(label, highlight)}</span>
        {typeof children === "function" ? children(describedBy) : children}
      </label>
      {hint ? (
        <p id={hintId} className="mt-1.5 max-w-prose text-xs text-muted-fg">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A settings row whose control is a *group* of elements (a segmented radiogroup).
 * A `<label>` may only name one control, so grouped rows use a div plus an id'd
 * caption wired to the group via `aria-labelledby` (the children render-prop
 * receives that id, plus a `describedBy` id when a hint is present).
 */
function FieldRow({
  label,
  hint,
  highlight,
  children,
}: {
  label: string;
  hint?: string;
  highlight?: string;
  children: (ids: { labelledBy: string; describedBy?: string }) => React.ReactNode;
}) {
  const id = useId();
  const hintId = useId();
  return (
    <div className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
        <span id={id}>{highlightLabel(label, highlight)}</span>
        {children({ labelledBy: id, describedBy: hint ? hintId : undefined })}
      </div>
      {hint ? (
        <p id={hintId} className="mt-1.5 max-w-prose text-xs text-muted-fg">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Section heading in the scroll (and the section divider in search results).
 * One level under the sheet's own title, which Radix renders as the `h2`.
 */
function SectionHeading({
  children,
  className,
  ...props
}: React.ComponentProps<"h3"> & { children: React.ReactNode }) {
  return (
    <h3 className={cn("mb-1 text-sm font-medium text-fg", className)} {...props}>
      {children}
    </h3>
  );
}

/** Quiet subsection heading used to chunk a long section (sentence case, never tracked). */
function GroupLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h4 className={cn("mb-1 text-xs font-medium text-muted-fg", className)}>{children}</h4>;
}

/** Segmented control for one mutually-exclusive setting (see `RadioGroup`). */
function SegButtons<T extends string>({
  options,
  value,
  onChange,
  render,
  labelledBy,
  describedBy,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  render: (v: T) => string;
  labelledBy?: string;
  describedBy?: string;
}) {
  return (
    <RadioGroup
      options={options}
      value={value}
      onChange={onChange}
      renderOption={render}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className="flex flex-wrap justify-end gap-1"
      itemClassName="h-8 px-3 text-xs font-medium"
    />
  );
}

/**
 * Numeric setting field. Keeps a local draft string while focused so a
 * multi-digit value can be typed even when its first digit is below `min`
 * (the store clamps on every set, which otherwise snaps the field on each
 * keystroke). The clamped value is committed on blur / Enter; Escape reverts.
 */
function NumberField({
  value,
  min,
  max,
  step,
  onCommit,
  "aria-labelledby": labelledBy,
  "aria-describedby": describedBy,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onCommit: (n: number) => void;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const next = Number(draft);
    if (draft.trim() !== "" && !Number.isNaN(next)) onCommit(next);
    setDraft(null);
  };

  return (
    <Input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      step={step}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      value={draft ?? String(value)}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
          event.currentTarget.blur();
        } else if (event.key === "Escape") {
          setDraft(null);
        }
      }}
      className="w-20 text-right tabular-nums"
    />
  );
}

/**
 * Why a recorded combo was refused. `action` carries the id of the action that
 * already owns it, so the message can name the owner — and offer to move the
 * combo over — instead of the dead end "Already in use".
 */
type Conflict =
  | { kind: "action"; actionId: string; label: string }
  | { kind: "menu"; label: string }
  | { kind: "fixed"; label: string }
  | { kind: "modifier" };

function KeybindingRow({
  actionId,
  label,
  highlight,
}: {
  actionId: string;
  label: string;
  highlight?: string;
}) {
  const { t } = useTranslation("editor");
  const { t: tm } = useTranslation("menu");
  const combo = useKeybindings((state) => state.bindings[actionId] ?? "");
  const setBinding = useKeybindings((state) => state.setBinding);
  const clearBinding = useKeybindings((state) => state.clearBinding);
  const resetBinding = useKeybindings((state) => state.resetBinding);
  const [recording, setRecording] = useState(false);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  /** The refused combo, held so "Reassign" knows what to move. */
  const [pending, setPending] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const recordHintId = useId();

  const commit = (next: string) => {
    setBinding(actionId, next);
    setRecording(false);
    setConflict(null);
    setPending(null);
  };

  // Scoped to the focused button rather than a global capture listener: the old
  // one swallowed every keystroke in the window while recording, which locked a
  // screen-reader user out of their own commands and out of Tab.
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!recording) return;
    // Tab is the way out. Let it through so focus can always leave the control —
    // Shift+Tab too, which is the way out backwards. A Tab carrying Ctrl, Cmd or
    // Alt is not an escape but a combo being offered, and letting that one
    // through would hand `Ctrl+Tab` to the tab strip behind this panel.
    if (event.key === "Tab" && !event.ctrlKey && !event.metaKey && !event.altKey) {
      setRecording(false);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") {
      setRecording(false);
      setConflict(null);
      setPending(null);
      return;
    }
    const next = eventToCombo(event.nativeEvent);
    // A modifier on its own is the user still assembling the combo, not an error.
    if (!next) return;
    if (!next.includes("mod") && !next.includes("alt")) {
      setConflict({ kind: "modifier" });
      return;
    }
    const reserved = reservedForCombo(next);
    if (reserved) {
      setConflict(
        reserved.owner === "menu"
          ? { kind: "menu", label: tm(reserved.labelKey) }
          : { kind: "fixed", label: t(`shortcuts.fixed.${reserved.labelKey}`) },
      );
      return;
    }
    const existing = actionForCombo(next);
    if (existing && existing.id !== actionId) {
      setConflict({
        kind: "action",
        actionId: existing.id,
        label: t(`shortcuts.actions.${existing.labelKey}`),
      });
      setPending(next);
      return;
    }
    commit(next);
  };

  const reassign = () => {
    if (conflict?.kind !== "action" || !pending) return;
    clearBinding(conflict.actionId);
    commit(pending);
    buttonRef.current?.focus();
  };

  const message =
    conflict?.kind === "action"
      ? t("shortcuts.conflictAction", { name: conflict.label })
      : conflict?.kind === "menu"
        ? t("shortcuts.conflictMenu", { name: conflict.label })
        : conflict?.kind === "fixed"
          ? t("shortcuts.conflictFixed", { name: conflict.label })
          : conflict?.kind === "modifier"
            ? t("shortcuts.conflictModifier")
            : null;

  // The name carries the visible text (SC 2.5.3 Label in Name): "{action}: {combo}".
  const shown = recording
    ? t("shortcuts.recording")
    : combo
      ? formatCombo(combo)
      : t("shortcuts.unbound");

  return (
    <div className="py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm">{highlightLabel(label, highlight)}</span>
        <div className="flex items-center gap-2">
          <span id={recordHintId} hidden>
            {t("shortcuts.recordHint")}
          </span>
          <button
            ref={buttonRef}
            type="button"
            aria-label={t("shortcuts.record", { name: label, combo: shown })}
            aria-describedby={recordHintId}
            onClick={() => {
              setRecording((value) => !value);
              setConflict(null);
              setPending(null);
            }}
            // Recording ends when focus leaves, but the refusal stays on screen:
            // clearing it here would unmount "Reassign" before its click landed.
            onBlur={() => setRecording(false)}
            onKeyDown={onKeyDown}
            className={cn(
              // The bound combo is machine data; the "recording…" state is the app
              // talking, so it stays in chrome sans (DESIGN.md §3).
              "min-w-20 rounded-md border border-border px-2 py-1 text-center transition-colors duration-(--motion-duration-fast) ease-snappy",
              recording ? "border-ring text-xs text-fg" : "text-data text-muted-fg hover:bg-muted",
            )}
          >
            {combo && !recording ? shown : <span className="text-xs">{shown}</span>}
          </button>
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            aria-label={t("shortcuts.reset", { name: label })}
            onClick={() => {
              resetBinding(actionId);
              setConflict(null);
              setPending(null);
            }}
            className="text-muted-fg"
          >
            <RotateCcw />
          </Button>
        </div>
      </div>
      {message ? (
        <div role="alert" className="mt-1.5 flex items-center justify-end gap-2 text-xs">
          <span className="text-danger-text">{message}</span>
          {conflict?.kind === "action" ? (
            <Button size="sm" variant="outline" onClick={reassign}>
              {t("shortcuts.reassign")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * A shortcut the app owns and will not let you change (`fixed-shortcuts.ts`).
 *
 * Same shape as a {@link KeybindingRow} so the combo column lines up, minus the
 * two controls that would lie about what can be done here. It earns its place
 * by existing at all: without a row, `Ctrl+Tab` is a gesture nobody discovers.
 */
function FixedShortcutRow({
  label,
  hint,
  highlight,
}: {
  label: string;
  hint: string;
  highlight?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm">{highlightLabel(label, highlight)}</span>
      <div className="flex items-center gap-2">
        {/* Transparent border, not none: it keeps this column exactly as wide as
            the bordered button the recordable rows use. */}
        <span className="text-data min-w-20 border border-transparent px-2 py-1 text-center text-muted-fg">
          {hint}
        </span>
        {/* Stands in for the reset button the recordable rows carry, so both
            kinds of row print their combo in the same column. */}
        <span aria-hidden className="block size-[1.375rem]" />
      </div>
    </div>
  );
}

/** One searchable settings row, used to render both the per-tab and search views. */
interface SettingEntry {
  id: string;
  section: Section;
  /** Subsection within a tab (default view only); `id` must stay contiguous. */
  group?: { id: string; label: string };
  /** Tab-level chrome (hint, "reset all"): shown in the tab view, never in search results. */
  chrome?: boolean;
  /** Conditional visibility (e.g. auto-save sub-options). */
  when?: boolean;
  /** Normalized search text; absent for chrome rows. */
  keywords?: string;
  render: (highlight?: string) => React.ReactNode;
}

/**
 * Settings, docked as a side sheet (Cmd/Ctrl+,).
 *
 * It is a column of the window rather than a modal over it, so the document
 * stays on screen and readable while the theme, the accent, the reading measure
 * and the typography change under it — a preference about how text looks is
 * worth little if the only text on screen while you set it is the dialog's own.
 *
 * Mounting *is* the open state: {@link App} renders this only while the panel
 * is open, and keeps it mounted through its exit animation, so the sheet is
 * always open for as long as it exists.
 */
export function SettingsPanel() {
  const { t } = useTranslation("editor");
  const { t: tc } = useTranslation("common");
  const close = useSettingsPanel((state) => state.close);
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Partial<Record<Section, HTMLElement | null>>>({});
  const baseId = useId();
  const reduceMotion = useReducedMotion();

  const settings = useSettings();
  const resetAllBindings = useKeybindings((state) => state.resetAll);
  const [themeFiles, setThemeFiles] = useState<string[]>([]);

  /** Scroll a section under the header. */
  const goToSection = useCallback(
    (section: Section) => {
      setQuery("");
      const scroller = contentRef.current;
      const target = sectionRefs.current[section];
      if (!scroller || !target) return;
      scroller.scrollTo({
        top: Math.max(0, target.offsetTop - SECTION_SCROLL_OFFSET),
        behavior: reduceMotion ? "auto" : "smooth",
      });
    },
    [reduceMotion],
  );

  // A new filter (or a cleared one) rebuilds the whole list, so start it at the
  // top rather than inheriting a scroll offset that now points somewhere else.
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [query]);

  // Jump to a requested section (e.g. Help ▸ Keyboard Shortcuts) and clear any
  // active filter. Keyed on the request itself, so the deep link works just as
  // well when the panel is already open.
  const initialSection = useSettingsPanel((state) => state.initialSection);
  useEffect(() => {
    if (initialSection === null) return;
    const pending = useSettingsPanel.getState().consumeInitialSection();
    if (pending && (SECTIONS as readonly string[]).includes(pending)) {
      goToSection(pending as Section);
    }
  }, [initialSection, goToSection]);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    const refresh = () => void listThemes().then(setThemeFiles, () => setThemeFiles([]));
    refresh();
    void onThemesDirChanged(refresh).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  async function handleResetToDefaults() {
    const confirmed = await ask(t("settings.reset.confirmMessage"), {
      title: t("settings.reset.confirmTitle"),
      kind: "warning",
      okLabel: t("settings.reset.button"),
      cancelLabel: t("fileActions.cancel"),
    });
    if (!confirmed) return;
    // Remove any injected custom-theme <style> consistently with clearing the
    // theme, then restore every preference to its default.
    applyCustomThemeCss(null);
    useSettings.getState().resetToDefaults();
  }

  // Fourteen bindings are as destructive to lose as every preference is, and
  // that button already asks. This one used to fire on the first click.
  async function handleResetAllShortcuts() {
    const confirmed = await ask(t("shortcuts.resetAllConfirmMessage"), {
      title: t("shortcuts.resetAllConfirmTitle"),
      kind: "warning",
      okLabel: t("shortcuts.resetAll"),
      cancelLabel: t("fileActions.cancel"),
    });
    if (confirmed) resetAllBindings();
  }

  const sectionLabel = (section: Section) => t(`settings.sections.${section}`);
  const kw = (...parts: string[]) => normalize(parts.filter(Boolean).join(" "));
  /** Group ids are local to a section; the label is resolved once, at declaration. */
  const group = (id: string, label: string) => ({ id, label });

  // Takes the id of whichever visible label names it: the band's own caption, or
  // the row's when the same control is reached through search.
  const languageControl = (labelledBy: string) => (
    <SegButtons
      options={LANGUAGES}
      value={settings.language}
      onChange={settings.setLanguage}
      render={(v) => tc(`language.${v}`)}
      labelledBy={labelledBy}
    />
  );
  const resetControl = (
    <Button
      size="sm"
      variant="destructive-outline"
      // Short in the band, precise to assistive tech — and the confirm dialog
      // states in full what is restored and what is kept.
      aria-label={t("settings.reset.button")}
      onClick={() => void handleResetToDefaults()}
    >
      {t("settings.reset.footerButton")}
    </Button>
  );

  // The single source of truth for every setting row. Both the per-tab view and
  // the flat search view render from this list, so controls are never duplicated.
  const entries: SettingEntry[] = [
    {
      id: "themePreference",
      section: "appearance",
      keywords: kw(t("settings.themePreference"), sectionLabel("appearance")),
      render: (h) => (
        <FieldRow label={t("settings.themePreference")} highlight={h}>
          {({ labelledBy }) => (
            <SegButtons
              options={THEME_PREFS}
              value={settings.themePreference}
              onChange={settings.setThemePreference}
              render={(v) => tc(`theme.${v}`)}
              labelledBy={labelledBy}
            />
          )}
        </FieldRow>
      ),
    },
    {
      id: "neutral",
      section: "appearance",
      keywords: kw(t("settings.neutral"), t("settings.hints.neutral"), sectionLabel("appearance")),
      render: (h) => (
        <FieldRow label={t("settings.neutral")} hint={t("settings.hints.neutral")} highlight={h}>
          {({ labelledBy, describedBy }) => (
            <SegButtons
              options={NEUTRALS}
              value={settings.neutral}
              onChange={settings.setNeutral}
              render={(v) => t(`settings.neutrals.${v}`)}
              labelledBy={labelledBy}
              describedBy={describedBy}
            />
          )}
        </FieldRow>
      ),
    },
    {
      id: "accentColor",
      section: "appearance",
      keywords: kw(t("settings.accentColor"), sectionLabel("appearance")),
      render: (h) => (
        <AccentPicker
          value={settings.accent}
          onChange={settings.setAccent}
          label={highlightLabel(t("settings.accentColor"), h)}
        />
      ),
    },
    {
      id: "customTheme",
      section: "appearance",
      keywords: kw(
        t("settings.customTheme"),
        t("settings.customThemeHint"),
        sectionLabel("appearance"),
      ),
      render: (h) => (
        <FieldRow
          label={t("settings.customTheme")}
          hint={t("settings.customThemeHint")}
          highlight={h}
        >
          {({ labelledBy, describedBy }) => (
            <div className="flex items-center gap-2">
              <Select
                value={settings.customThemeName ?? ""}
                onChange={(e) => void selectTheme(e.target.value || null)}
                aria-labelledby={labelledBy}
                aria-describedby={describedBy}
              >
                <option value="">{t("settings.customThemeNone")}</option>
                {themeFiles.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </Select>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void getThemesDir().then(openThemesDir)}
              >
                {t("settings.openThemesFolder")}
              </Button>
            </div>
          )}
        </FieldRow>
      ),
    },

    {
      id: "defaultViewMode",
      section: "editor",
      group: group("reading", t("settings.groups.reading")),
      keywords: kw(
        t("settings.defaultViewMode"),
        t("settings.hints.defaultViewMode"),
        t("modes.source"),
        t("modes.edit"),
        t("modes.reading"),
        sectionLabel("editor"),
      ),
      render: (h) => (
        <FieldRow
          label={t("settings.defaultViewMode")}
          hint={t("settings.hints.defaultViewMode")}
          highlight={h}
        >
          {({ labelledBy, describedBy }) => (
            <SegButtons
              options={DEFAULT_VIEW_MODES}
              value={settings.defaultViewMode}
              onChange={settings.setDefaultViewMode}
              render={(v) => t(`modes.${v}`)}
              labelledBy={labelledBy}
              describedBy={describedBy}
            />
          )}
        </FieldRow>
      ),
    },
    {
      id: "fontFamily",
      section: "editor",
      group: group("reading", t("settings.groups.reading")),
      keywords: kw(
        t("settings.fontFamily"),
        t("settings.fonts.serif"),
        t("settings.fonts.sans"),
        sectionLabel("editor"),
      ),
      render: (h) => (
        <FieldRow label={t("settings.fontFamily")} highlight={h}>
          {({ labelledBy }) => (
            <SegButtons
              options={EDITOR_FONT_FAMILIES}
              value={settings.editorFontFamily}
              onChange={(v: EditorFontFamily) => settings.setEditorFontFamily(v)}
              render={(v) => t(`settings.fonts.${v}`)}
              labelledBy={labelledBy}
            />
          )}
        </FieldRow>
      ),
    },
    {
      id: "fontSize",
      section: "editor",
      group: group("reading", t("settings.groups.reading")),
      keywords: kw(t("settings.fontSize"), sectionLabel("editor")),
      render: (h) => (
        <Field label={t("settings.fontSize")} highlight={h}>
          <NumberField
            value={settings.editorFontSize}
            min={EDITOR_FONT_SIZE.min}
            max={EDITOR_FONT_SIZE.max}
            onCommit={settings.setEditorFontSize}
          />
        </Field>
      ),
    },
    {
      id: "lineHeight",
      section: "editor",
      group: group("reading", t("settings.groups.reading")),
      keywords: kw(t("settings.lineHeight"), sectionLabel("editor")),
      render: (h) => (
        <Field label={t("settings.lineHeight")} highlight={h}>
          <NumberField
            value={settings.editorLineHeight}
            min={EDITOR_LINE_HEIGHT.min}
            max={EDITOR_LINE_HEIGHT.max}
            step={0.1}
            onCommit={settings.setEditorLineHeight}
          />
        </Field>
      ),
    },
    {
      id: "lineWidth",
      section: "editor",
      group: group("reading", t("settings.groups.reading")),
      keywords: kw(t("settings.lineWidth"), t("settings.hints.lineWidth"), sectionLabel("editor")),
      render: (h) => (
        <Field label={t("settings.lineWidth")} hint={t("settings.hints.lineWidth")} highlight={h}>
          {(describedBy) => (
            <NumberField
              value={settings.lineWidth}
              min={LINE_WIDTH.min}
              max={LINE_WIDTH.max}
              onCommit={settings.setLineWidth}
              aria-describedby={describedBy}
            />
          )}
        </Field>
      ),
    },
    {
      id: "autoPairing",
      section: "editor",
      group: group("writing", t("settings.groups.writing")),
      keywords: kw(
        t("settings.autoPairing"),
        t("settings.hints.autoPairing"),
        sectionLabel("editor"),
      ),
      render: (h) => (
        <Field
          label={t("settings.autoPairing")}
          hint={t("settings.hints.autoPairing")}
          highlight={h}
        >
          {(describedBy) => (
            <Switch
              checked={settings.autoPairing}
              onCheckedChange={settings.setAutoPairing}
              aria-label={t("settings.autoPairing")}
              aria-describedby={describedBy}
            />
          )}
        </Field>
      ),
    },
    {
      id: "autoSave",
      section: "editor",
      group: group("saving", t("settings.groups.saving")),
      keywords: kw(t("settings.autoSave"), sectionLabel("editor")),
      render: (h) => (
        <Field label={t("settings.autoSave")} highlight={h}>
          <Switch
            checked={settings.autoSave}
            onCheckedChange={settings.setAutoSave}
            aria-label={t("settings.autoSave")}
          />
        </Field>
      ),
    },
    {
      id: "showIgnoredFolders",
      section: "editor",
      group: group("workspace", t("settings.groups.workspace")),
      keywords: kw(
        t("settings.showIgnoredFolders"),
        t("settings.hints.showIgnoredFolders"),
        sectionLabel("editor"),
      ),
      render: (h) => (
        <Field
          label={t("settings.showIgnoredFolders")}
          hint={t("settings.hints.showIgnoredFolders")}
          highlight={h}
        >
          {(describedBy) => (
            <Switch
              checked={settings.showIgnoredFolders}
              onCheckedChange={() => settings.toggleIgnoredFolders()}
              aria-label={t("settings.showIgnoredFolders")}
              aria-describedby={describedBy}
            />
          )}
        </Field>
      ),
    },
    {
      id: "revealActiveFile",
      section: "editor",
      group: group("workspace", t("settings.groups.workspace")),
      keywords: kw(
        t("settings.revealActiveFile"),
        t("settings.hints.revealActiveFile"),
        sectionLabel("editor"),
      ),
      render: (h) => (
        <Field
          label={t("settings.revealActiveFile")}
          hint={t("settings.hints.revealActiveFile")}
          highlight={h}
        >
          {(describedBy) => (
            <Switch
              checked={settings.revealActiveFile}
              onCheckedChange={settings.setRevealActiveFile}
              aria-label={t("settings.revealActiveFile")}
              aria-describedby={describedBy}
            />
          )}
        </Field>
      ),
    },

    {
      id: "shortcuts-hint",
      section: "shortcuts",
      chrome: true,
      render: () => <p className="mb-3 max-w-prose text-xs text-muted-fg">{t("shortcuts.hint")}</p>,
    },
    ...KEY_ACTIONS.map((action): SettingEntry => {
      const label = t(`shortcuts.actions.${action.labelKey}`);
      return {
        id: `shortcut-${action.id}`,
        section: "shortcuts",
        group: group(action.group, t(`shortcuts.groups.${action.group}`)),
        keywords: kw(label, sectionLabel("shortcuts"), t("shortcuts.keyword")),
        render: (h) => <KeybindingRow actionId={action.id} label={label} highlight={h} />,
      };
    }),
    {
      id: "shortcuts-fixed-hint",
      section: "shortcuts",
      group: group("fixed", t("shortcuts.groups.fixed")),
      chrome: true,
      render: () => (
        <p className="mb-1 max-w-prose text-xs text-muted-fg">{t("shortcuts.fixedHint")}</p>
      ),
    },
    ...FIXED_SHORTCUTS.map((shortcut): SettingEntry => {
      const label = t(`shortcuts.fixed.${shortcut.labelKey}`);
      const hint = formatCombo(shortcut.combos[0] ?? "");
      return {
        id: `shortcut-fixed-${shortcut.labelKey}`,
        section: "shortcuts",
        group: group("fixed", t("shortcuts.groups.fixed")),
        keywords: kw(label, sectionLabel("shortcuts"), t("shortcuts.keyword")),
        render: (h) => <FixedShortcutRow label={label} hint={hint} highlight={h} />,
      };
    }),
    // A two-key sequence, not a combo, so it is listed here rather than in
    // `FIXED_SHORTCUTS` (whose combos the recorder refuses): in the source editor
    // and in code blocks Tab indents, and Esc hands the next Tab back to focus
    // navigation (CodeMirror's tab-focus escape) — the documented way out.
    {
      id: "shortcut-fixed-leaveCodeEditor",
      section: "shortcuts",
      group: group("fixed", t("shortcuts.groups.fixed")),
      keywords: kw(
        t("shortcuts.fixed.leaveCodeEditor"),
        sectionLabel("shortcuts"),
        t("shortcuts.keyword"),
      ),
      render: (h) => (
        <FixedShortcutRow
          label={t("shortcuts.fixed.leaveCodeEditor")}
          hint={t("shortcuts.fixed.leaveCodeEditorKeys")}
          highlight={h}
        />
      ),
    },
    {
      id: "shortcuts-resetAll",
      section: "shortcuts",
      chrome: true,
      render: () => (
        <div className="mt-5 border-t border-border pt-4">
          <Button size="sm" variant="outline" onClick={() => void handleResetAllShortcuts()}>
            {t("shortcuts.resetAll")}
          </Button>
        </div>
      ),
    },

    {
      id: "language",
      section: "general",
      keywords: kw(t("settings.language"), tc("language.it"), tc("language.en")),
      render: (h) => (
        <FieldRow label={t("settings.language")} highlight={h}>
          {({ labelledBy }) => languageControl(labelledBy)}
        </FieldRow>
      ),
    },
    {
      id: "reset",
      section: "general",
      keywords: kw(t("settings.reset.label"), t("settings.reset.button")),
      // FieldRow, not Field: a <label> forwards its click to the first labelable
      // descendant, and a <button> is one — so clicking the row's text fired the
      // command. Rows whose control is a button never wrap in a label.
      render: (h) => (
        <FieldRow label={t("settings.reset.label")} highlight={h}>
          {() => resetControl}
        </FieldRow>
      ),
    },
  ];

  const trimmed = query.trim();
  const searching = trimmed.length > 0;

  /** One section's entries, with their subsection headers. */
  function renderSectionRows(section: Section) {
    const out: React.ReactNode[] = [];
    let emittedHeader = false;
    let lastGroup: string | undefined;
    for (const entry of entries) {
      if (entry.section !== section || entry.when === false) continue;
      if (entry.group && entry.group.id !== lastGroup) {
        out.push(
          <GroupLabel
            key={`grp-${entry.group.id}`}
            className={emittedHeader ? "mt-5 border-t border-border pt-4" : undefined}
          >
            {entry.group.label}
          </GroupLabel>,
        );
        emittedHeader = true;
        lastGroup = entry.group.id;
      }
      out.push(<Fragment key={entry.id}>{entry.render()}</Fragment>);
    }
    return out;
  }

  const matches = searching
    ? SECTIONS.map((section) => ({
        section,
        items: entries.filter(
          (e) =>
            e.section === section &&
            !e.chrome &&
            e.when !== false &&
            (e.keywords?.includes(normalize(trimmed)) ?? false),
        ),
      })).filter((g) => g.items.length > 0)
    : [];
  const matchCount = matches.reduce((total, g) => total + g.items.length, 0);

  /** Search view: matching entries across every section, grouped by section. */
  function renderSearchView() {
    if (matches.length === 0) {
      return (
        <p className="text-sm text-muted-fg">{t("settings.search.empty", { query: trimmed })}</p>
      );
    }
    return matches.map((g, index) => (
      <div key={g.section}>
        <SectionHeading className={index > 0 ? "mt-5 border-t border-border pt-4" : undefined}>
          {sectionLabel(g.section)}
        </SectionHeading>
        {g.items.map((e) => (
          <Fragment key={e.id}>{e.render(trimmed)}</Fragment>
        ))}
      </div>
    ));
  }

  const headingId = (section: Section) => `${baseId}-heading-${section}`;

  return (
    <Sheet
      // Mounted means open: App unmounts the sheet to close it, and the flag
      // here would flip to false one frame before the column finishes leaving.
      open
      onOpenChange={(next) => {
        if (!next) {
          setQuery("");
          close();
        }
      }}
    >
      <SheetContent
        side="right"
        aria-describedby={undefined}
        // Lets the panel store tell focus still in here from focus moved away.
        data-settings-panel=""
        // Wide enough for a shortcut row (label, combo, reset) to stay on one
        // line, narrow enough to leave the document its measure on a laptop.
        className="w-96 max-w-[100vw]"
        // The panel exists to be typed into: opening it lands on the filter
        // rather than on the close button the DOM order would otherwise reach.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          searchInputRef.current?.focus();
        }}
        onEscapeKeyDown={(event) => {
          // First Escape clears an active filter; a second (empty) one closes
          // the sheet. Radix owns the Escape handler, so intercept it here
          // rather than fighting it from the input's keydown.
          if (query) {
            event.preventDefault();
            setQuery("");
          }
        }}
      >
        <SheetHeader>
          <div className="flex items-center justify-between gap-2">
            <SheetTitle>{t("settings.title")}</SheetTitle>
            <SheetClose asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                type="button"
                aria-label={t("settings.close")}
                className="text-muted-fg"
              >
                <X className="size-4" />
              </Button>
            </SheetClose>
          </div>

          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-fg"
            />
            <Input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("settings.search.placeholder")}
              aria-label={t("settings.search.label")}
              className="w-full pl-7 pr-7"
            />
            {query ? (
              <button
                type="button"
                aria-label={t("settings.search.clear")}
                onClick={() => {
                  // Returning focus to the field keeps the keyboard flow
                  // intact when the clear button unmounts itself.
                  setQuery("");
                  searchInputRef.current?.focus();
                }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-fg transition-colors duration-(--motion-duration-fast) ease-snappy hover:text-fg"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>

          {/* Jump links, not tabs: every section is always rendered, so this
              navigates a page instead of swapping four of them. Filtering
              already flattens the list across sections, which leaves the rail
              nothing to point at. */}
          {searching ? null : (
            <nav aria-label={t("settings.sectionsNav")} className="flex flex-wrap gap-1">
              {SECTIONS.map((section) => (
                <button
                  key={section}
                  type="button"
                  onClick={() => goToSection(section)}
                  className="rounded-md px-2 py-1 text-xs text-muted-fg transition-colors duration-(--motion-duration-fast) ease-snappy hover:bg-muted hover:text-fg"
                >
                  {sectionLabel(section)}
                </button>
              ))}
            </nav>
          )}
        </SheetHeader>

        {/* Filtering used to be silent for assistive tech: only the empty
            case announced. The count covers both outcomes. */}
        <p role="status" className="sr-only">
          {searching ? t("settings.search.results", { count: matchCount }) : ""}
        </p>

        <SheetBody
          ref={contentRef}
          // A rule under the header, so a row scrolled half out of the region
          // reads as scrolled rather than as a rendering artifact.
          className="border-t border-border px-4 pb-8"
          tabIndex={0}
          {...(searching
            ? { role: "region" as const, "aria-label": t("settings.search.heading") }
            : {})}
        >
          {searching
            ? renderSearchView()
            : SECTIONS.map((section, index) => (
                <section
                  key={section}
                  ref={(element) => {
                    sectionRefs.current[section] = element;
                  }}
                  aria-labelledby={headingId(section)}
                  className={cn("pt-4", index > 0 && "mt-4 border-t border-border")}
                >
                  <SectionHeading id={headingId(section)}>{sectionLabel(section)}</SectionHeading>
                  {renderSectionRows(section)}
                </section>
              ))}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
