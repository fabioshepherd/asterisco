import { BookOpen, Code, SquarePen } from "lucide-react";
import { useTranslation } from "react-i18next";

import { RadioGroup } from "@/components/ui/radio-group";
import type { ViewMode } from "@/stores/ui";
import { useUi } from "@/stores/ui";

// Ordered as an axis rather than a menu: raw file → editable page → finished
// page, with the default (edit) at the centre.
// `as const satisfies` keeps each labelKey a literal (typed-i18n needs a known
// key, not a widened `string`) while still checking the row shape.
const VIEWS = [
  { mode: "source", labelKey: "modes.source", Icon: Code },
  { mode: "edit", labelKey: "modes.edit", Icon: SquarePen },
  { mode: "reading", labelKey: "modes.reading", Icon: BookOpen },
] as const satisfies ReadonlyArray<{
  mode: ViewMode;
  labelKey: string;
  Icon: typeof BookOpen;
}>;

/**
 * The one question the status line's left side answers: what am I looking at.
 * Three mutually-exclusive states of the same column, always labelled — the bar
 * carries what has to be *seen*, while every other view command is reached from
 * the View menu, the command palette or a keybinding.
 */
export function ViewModeControl() {
  const { t } = useTranslation("editor");
  const viewMode = useUi((state) => state.viewMode);
  const setViewMode = useUi((state) => state.setViewMode);
  return (
    <RadioGroup
      aria-label={t("modes.viewGroup")}
      className="flex shrink-0 items-center gap-0.5"
      itemClassName="[&_svg]:size-3.5"
      options={VIEWS.map((view) => view.mode)}
      value={viewMode}
      onChange={setViewMode}
      renderOption={(mode) => {
        const view = VIEWS.find((entry) => entry.mode === mode);
        if (!view) return null;
        return (
          <>
            <view.Icon aria-hidden />
            {t(view.labelKey)}
          </>
        );
      }}
    />
  );
}
