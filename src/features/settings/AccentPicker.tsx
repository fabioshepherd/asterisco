import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { RadioGroup } from "@/components/ui/radio-group";
import { ACCENTS, type Accent } from "@/features/themes/accents";
import { cn } from "@/lib/utils";

/**
 * Swatch colour per accent — the scale's signal step (9), which is what --accent
 * maps to. The monochrome "gray" option previews the live neutral's own signal
 * step, matching accents.css where it follows whichever neutral is selected.
 */
const SWATCH_VAR: Record<Accent, string> = {
  orange: "var(--orange-9)",
  jade: "var(--jade-9)",
  grass: "var(--grass-9)",
  teal: "var(--teal-9)",
  blue: "var(--blue-9)",
  indigo: "var(--indigo-9)",
  plum: "var(--plum-9)",
  bronze: "var(--bronze-9)",
  gold: "var(--gold-9)",
  tomato: "var(--tomato-9)",
  gray: "var(--muted-fg)",
};

/**
 * Accent colour picker, collapsed by default.
 *
 * Eleven swatches laid out flat put eleven hues on the one screen that advertises
 * the Signal Rule ("exactly one chromatic accent is live at a time", DESIGN.md §2).
 * At rest this is an ordinary label-and-control row showing a single swatch — the
 * live accent — and the full set opens underneath, full width, only while the user
 * is deliberately choosing. No option is removed; the choice is disclosed rather
 * than displayed.
 *
 * The component owns the whole row rather than just the control, because the open
 * grid is wider than a control column: kept inside one, it squeezed the label to
 * two lines and pushed the trigger off the label's baseline.
 *
 * Open, it is a real `radiogroup`: arrows move selection *and* focus, so screen
 * readers announce "n of m" rather than a row of independent toggles — the same
 * model as the theme row above it, instead of a third ARIA pattern on one tab.
 */
export function AccentPicker({
  value,
  onChange,
  label,
}: {
  value: Accent;
  onChange: (accent: Accent) => void;
  /** Row label; omitted, the trigger names itself instead. */
  label?: React.ReactNode;
}) {
  const { t } = useTranslation("editor");
  const [open, setOpen] = useState(false);
  const baseId = useId();
  const labelId = `${baseId}-label`;
  const groupId = `${baseId}-group`;
  const justOpened = useRef(false);

  // Opening with the keyboard should land on the current choice, not force a
  // walk from the first swatch. Focus after paint, once the group exists.
  useEffect(() => {
    if (!open || !justOpened.current) return;
    justOpened.current = false;
    document
      .getElementById(groupId)
      ?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')
      ?.focus();
  }, [open, value, groupId]);

  return (
    <div className="py-3">
      <div className="flex items-center justify-between gap-4 text-sm">
        {label ? <span id={labelId}>{label}</span> : null}
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-expanded={open}
          // Only while the group exists: pointing at an absent id is worse than
          // not pointing at all.
          aria-controls={open ? groupId : undefined}
          // The trigger states the current choice, so its name has to carry the
          // value too — "Accent colour" alone would hide what is selected.
          aria-labelledby={label ? `${labelId} ${baseId}-value` : undefined}
          aria-label={
            label ? undefined : `${t("settings.accentColor")}: ${t(`accents.${value}` as const)}`
          }
          className={label ? undefined : "ms-auto"}
          onClick={() => {
            justOpened.current = !open;
            setOpen((previous) => !previous);
          }}
        >
          <span
            aria-hidden="true"
            className="size-3 shrink-0 rounded-full border border-border"
            style={{ backgroundColor: SWATCH_VAR[value] }}
          />
          <span id={`${baseId}-value`}>{t(`accents.${value}`)}</span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "transition-transform duration-(--motion-duration-fast) ease-snappy",
              open && "rotate-180",
            )}
          />
        </Button>
      </div>

      {open ? (
        <RadioGroup
          id={groupId}
          aria-labelledby={label ? labelId : undefined}
          aria-label={label ? undefined : t("settings.accentColor")}
          className="mt-2 flex flex-wrap gap-2"
          itemClassName="h-8 px-3 text-xs font-medium [&_svg]:size-4"
          options={ACCENTS}
          value={value}
          onChange={onChange}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.stopPropagation();
            setOpen(false);
          }}
          renderOption={(accent, selected) => (
            <>
              <span
                aria-hidden="true"
                className="size-3 shrink-0 rounded-full border border-border"
                style={{ backgroundColor: SWATCH_VAR[accent] }}
              />
              {t(`accents.${accent}`)}
              {selected ? <Check aria-hidden="true" /> : null}
            </>
          )}
        />
      ) : null}
    </div>
  );
}
