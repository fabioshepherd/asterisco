import { RotateCcw } from "lucide-react";

import { cn } from "@/lib/utils";

import { indentStyle } from "./tree-utils";

interface TreeStateRowProps {
  /** What the row says. Also its accessible name, unless `label` overrides it. */
  message: string;
  level: number;
  tone?: "danger";
  /**
   * What the failure happened to, in mono under the message.
   *
   * A path is machine data (DESIGN.md, the Machine-Data Rule), and it belongs
   * on screen rather than in a `title` a keyboard user never triggers and a
   * screen reader never reaches past `aria-label`. Kept relative to the
   * workspace, because the absolute path is the tooltip's job.
   */
  detail?: string;
  /** The raw, untranslated OS text, on hover. Nothing else shows it. */
  title?: string;
  /** Read this folder again. Present only where retrying is meaningful. */
  onRetry?: () => void;
  /** Localized label for the retry affordance; required whenever `onRetry` is. */
  retryLabel?: string;
  /** The tree's only tab stop when the root has no node row to carry it. */
  tabStop?: boolean;
}

/**
 * A row that reports a state rather than a document — "empty folder", "no
 * documents here", an I/O error.
 *
 * These used to be `role="none"`, and arrow navigation only visited rows with a
 * path, so a screen-reader user could expand a locked folder, hear "expanded",
 * and then be told nothing at all. They are treeitems now: reachable, labelled,
 * and `aria-disabled` unless something can actually be done with them. Nothing
 * carries `data-tree-path`, so Delete and the context menu still can't mistake
 * one for a file on disk.
 *
 * A failed read is the one state with an action behind it: the folder can be
 * read again on its own, without reloading the tree and losing every branch the
 * user opened. Enter or Space on the row does it, as it does on every other row
 * in this tree — a nested button would break the treeitem's keyboard contract.
 */
export function TreeStateRow({
  message,
  level,
  tone,
  detail,
  title,
  onRetry,
  retryLabel,
  tabStop,
}: TreeStateRowProps) {
  // The visible text and the spoken name are the same sentence, plus the path
  // and the action. Two different strings for one row was a contract nobody
  // could keep straight.
  const spoken = [message, detail, onRetry ? retryLabel : null].filter(Boolean).join(" — ");
  return (
    <li
      role="treeitem"
      aria-disabled={onRetry ? undefined : "true"}
      aria-label={spoken}
      title={title}
      tabIndex={tabStop ? 0 : -1}
      data-tree-item=""
      data-tree-level={level}
      style={indentStyle(level)}
      onClick={onRetry}
      onKeyDown={(event) => {
        if (!onRetry) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          onRetry();
        }
      }}
      className={cn(
        // Stacked, not side by side: at this width the two competed, and what
        // lost was the half that says what went wrong.
        "flex flex-col items-start gap-0.5 py-1.5 pe-2 text-sm outline-none",
        "focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]",
        tone === "danger" ? "text-danger-text" : "italic text-muted-fg",
        onRetry && "cursor-pointer hover:bg-muted",
      )}
    >
      {/* Wraps rather than truncates: an error is rare and worth two lines,
          and cutting a sentence off at "Couldn't read l…" reports nothing. */}
      <span className="min-w-0 break-words">{message}</span>
      {detail ? (
        <span className="min-w-0 break-all text-data text-muted-fg" dir="ltr">
          {detail}
        </span>
      ) : null}
      {onRetry && retryLabel ? (
        /* Part of the row, not a control of its own: the treeitem is the thing
           you focus, and its accessible name already carries this word. */
        <span
          aria-hidden
          className="inline-flex shrink-0 items-center gap-1 text-data text-muted-fg"
        >
          <RotateCcw className="size-3" />
          {retryLabel}
        </span>
      ) : null}
    </li>
  );
}

/**
 * The placeholder shown while a folder's contents are being read.
 *
 * The bars are decoration and stay hidden from assistive tech, but the row
 * itself is a labelled treeitem: three `aria-hidden` list items meant a reader
 * navigating into an opening folder found nothing there and no reason why.
 */
export function TreeLoadingRow({
  label,
  level,
  tabStop,
}: {
  label: string;
  level: number;
  tabStop?: boolean;
}) {
  return (
    <li
      role="treeitem"
      aria-disabled="true"
      aria-label={label}
      tabIndex={tabStop ? 0 : -1}
      data-tree-item=""
      data-tree-level={level}
      style={indentStyle(level)}
      className="block py-1 pe-2 outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          aria-hidden="true"
          className="my-1.5 block h-3.5 animate-pulse rounded bg-muted"
          style={{ width: `${60 - i * 8}%` }}
        />
      ))}
    </li>
  );
}
