import {
  CaseSensitive,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Regex,
  WholeWord,
  X,
} from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { formatCombo } from "@/features/settings/keybindings";
import { cn } from "@/lib/utils";
import { selectActiveDocument, useDocuments } from "@/stores/document";

import type { FindOptions } from "./find-utils";
import {
  replaceAllInActiveDocument,
  replaceCurrentInActiveDocument,
  useFindReplace,
} from "./use-find-replace";

const OPTIONS = [
  { key: "caseSensitive", Icon: CaseSensitive, labelKey: "find.caseSensitive" },
  { key: "wholeWord", Icon: WholeWord, labelKey: "find.wholeWord" },
  { key: "regex", Icon: Regex, labelKey: "find.regex" },
] as const satisfies ReadonlyArray<{
  key: keyof FindOptions;
  Icon: typeof CaseSensitive;
  labelKey: string;
}>;

// The two text inputs are native (not Button), so give them the Button
// primitive's focus treatment by hand — one consistent 2px ring at a 2px offset
// across every control in the panel. Icon buttons use the Button primitive.
const INPUT_CLASS =
  "min-w-0 rounded-md bg-muted px-2 py-1 text-sm placeholder:text-muted-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

/** In-document find & replace panel (operates on the active document markdown). */
export function FindReplace() {
  const { t } = useTranslation("editor");
  const state = useFindReplace();
  const docMarkdown = useDocuments((s) => selectActiveDocument(s)?.markdown ?? "");

  // The store recomputes matches on query/option changes and on open; keep them
  // in sync when the underlying document content changes too (e.g. live edits).
  const recomputeMatches = state.recomputeMatches;
  useEffect(() => {
    if (state.isOpen) recomputeMatches();
  }, [docMarkdown, state.isOpen, recomputeMatches]);

  const total = state.total;
  const displayCurrent = total === 0 ? 0 : state.current + 1;
  const undoCombo = formatCombo("mod+z");
  if (!state.isOpen) return null;

  return (
    <div
      role="search"
      aria-label={t("find.label")}
      className="absolute right-3 top-2 z-(--z-floating) flex w-80 flex-col gap-2 rounded-lg bg-bg p-3 shadow-card"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          state.close();
          return;
        }
        // Trap Tab within the panel (find-widget convention); Esc is the way out
        // to the editor. Without this, Tab falls through into the document behind.
        if (event.key !== "Tab") return;
        const focusables = event.currentTarget.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input",
        );
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
    >
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-fg"
          aria-label={t("find.toggleReplace")}
          aria-expanded={state.showReplace}
          onClick={() => state.setShowReplace(!state.showReplace)}
        >
          <ChevronRight className={cn("transition-transform", state.showReplace && "rotate-90")} />
        </Button>
        <input
          autoFocus
          type="text"
          value={state.query}
          onChange={(event) => state.setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            if (event.shiftKey) state.prev();
            else state.next();
          }}
          placeholder={t("find.findPlaceholder")}
          aria-label={t("find.find")}
          aria-invalid={state.invalidRegex || undefined}
          aria-describedby={state.invalidRegex ? "find-status" : undefined}
          className={cn(
            INPUT_CLASS,
            "flex-1",
            // Persist a danger ring even when focused, so the error stays visible
            // instead of reverting to the accent focus ring.
            state.invalidRegex && "ring-2 ring-danger focus-visible:ring-danger",
          )}
        />
        <span aria-live="polite" className="shrink-0 text-xs tabular-nums text-muted-fg">
          {t("find.count", { current: displayCurrent, total })}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-fg"
          aria-label={t("find.prev")}
          disabled={total === 0}
          onClick={() => state.prev()}
        >
          <ChevronUp />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-fg"
          aria-label={t("find.next")}
          disabled={total === 0}
          onClick={() => state.next()}
        >
          <ChevronDown />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-fg"
          aria-label={t("find.close")}
          onClick={() => state.close()}
        >
          <X />
        </Button>
      </div>

      <div className="flex gap-1 ps-8">
        {OPTIONS.map(({ key, Icon, labelKey }) => (
          <Button
            key={key}
            type="button"
            variant={state[key] ? "default" : "outline"}
            size="icon-sm"
            aria-pressed={state[key]}
            aria-label={t(labelKey)}
            title={t(labelKey)}
            onClick={() => state.toggleOption(key)}
          >
            <Icon />
          </Button>
        ))}
      </div>

      {state.showReplace ? (
        // Replacement field on its own full-width row, actions below — so the
        // input keeps its width regardless of how long the localized button
        // labels run (it. "Sostituisci tutto" would otherwise crush it).
        <div className="flex flex-col gap-2 ps-8">
          <input
            type="text"
            value={state.replacement}
            onChange={(event) => state.setReplacement(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              // Enter replaces the current match; mod+Enter replaces all —
              // mirroring the buttons' enabled conditions.
              if (event.metaKey || event.ctrlKey) {
                if (total > 0) replaceAllInActiveDocument();
              } else if (state.current >= 0) {
                replaceCurrentInActiveDocument();
              }
            }}
            placeholder={t("find.replacePlaceholder")}
            aria-label={t("find.replace")}
            className={cn(INPUT_CLASS, "w-full")}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={state.current < 0}
              onClick={() => replaceCurrentInActiveDocument()}
            >
              {t("find.replaceOne")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={total === 0}
              onClick={() => replaceAllInActiveDocument()}
            >
              {total > 0 ? t("find.replaceAllCount", { count: total }) : t("find.replaceAll")}
            </Button>
          </div>
        </div>
      ) : null}

      {state.invalidRegex ? (
        <p id="find-status" role="alert" className="ps-8 text-xs text-danger-text">
          {t("find.invalidRegex")}
        </p>
      ) : state.lastReplacement !== null ? (
        <p id="find-status" aria-live="polite" className="ps-8 text-xs text-muted-fg">
          {t("find.replaced", { count: state.lastReplacement, undo: undoCombo })}
        </p>
      ) : state.query !== "" && total === 0 ? (
        // Distinguish "searched, found nothing" from the idle empty-query panel,
        // and announce it (a silent "0 of 0" reads as an unresponsive app).
        <p id="find-status" aria-live="polite" className="ps-8 text-xs text-muted-fg">
          {t("find.noMatches")}
        </p>
      ) : null}
    </div>
  );
}
