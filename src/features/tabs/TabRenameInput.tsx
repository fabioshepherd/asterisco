import { useEffect, useId, useRef } from "react";

import { cn } from "@/lib/utils";

interface TabRenameInputProps {
  value: string;
  error: string | null;
  ariaLabel: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}

/** Inline text field shown in place of a tab label while renaming its file. */
export function TabRenameInput({
  value,
  error,
  ariaLabel,
  onChange,
  onCommit,
  onCancel,
}: TabRenameInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const closingRef = useRef(false);
  const errorId = useId();

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, []);

  return (
    <>
      <input
        ref={inputRef}
        value={value}
        aria-label={ariaLabel}
        aria-invalid={error !== null}
        aria-describedby={error ? errorId : undefined}
        // The tab strip listens for arrow keys on the parent; keep them local.
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            closingRef.current = true;
            onCommit();
          } else if (e.key === "Escape") {
            closingRef.current = true;
            onCancel();
          }
        }}
        onBlur={() => {
          if (closingRef.current) return; // Enter/Esc already handled it.
          // Clicking away discards the in-progress rename rather than silently
          // committing it to disk — Enter is the only commit path.
          onCancel();
        }}
        className={cn(
          "min-w-0 max-w-44 rounded-sm bg-bg px-1 text-sm text-fg outline-none ring-1",
          error ? "ring-danger" : "ring-ring",
        )}
      />
      {/* The visible, announced message is the error toast (the tab strip clips
          any inline popover via overflow). This stays as a programmatic
          description tied to the field — not a second live region. */}
      {error ? (
        <span id={errorId} className="sr-only">
          {error}
        </span>
      ) : null}
    </>
  );
}
