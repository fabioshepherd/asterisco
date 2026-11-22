import { CaseSensitive, Info, Loader2, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { openPath } from "@/features/file-ops/file-ops";
import { errorMessage } from "@/lib/tauri/errors";
import { searchWorkspace, type SearchFileResult } from "@/lib/tauri/search";
import { cn } from "@/lib/utils";
import { useSettings } from "@/stores/settings";
import { useUi } from "@/stores/ui";
import { useWorkspace } from "@/stores/workspace";

import { setPendingJumpLine } from "./jump";
import { useWorkspaceSearch } from "./use-workspace-search";

type Status = "idle" | "loading" | "done" | "error";

const optionId = (index: number) => `workspace-search-option-${index}`;

/** Emphasise every occurrence of `query` within a result line (weight, not colour). */
function highlightMatches(text: string, query: string, caseSensitive: boolean) {
  if (!query) return text;
  const haystack = caseSensitive ? text : text.toLowerCase();
  const needle = caseSensitive ? query : query.toLowerCase();
  const parts: React.ReactNode[] = [];
  let from = 0;
  let at = haystack.indexOf(needle, from);
  while (at !== -1) {
    if (at > from) parts.push(text.slice(from, at));
    parts.push(
      <mark key={at} className="bg-transparent font-medium text-fg">
        {text.slice(at, at + needle.length)}
      </mark>,
    );
    from = at + needle.length;
    at = haystack.indexOf(needle, from);
  }
  if (from < text.length) parts.push(text.slice(from));
  return parts.length > 0 ? parts : text;
}

/** Workspace-wide full-text search panel (Cmd/Ctrl+Shift+F). */
export function WorkspaceSearch() {
  const { t } = useTranslation("editor");
  const isOpen = useWorkspaceSearch((state) => state.isOpen);
  const close = useWorkspaceSearch((state) => state.close);
  const focusRequest = useWorkspaceSearch((state) => state.focusRequest);
  const rootPath = useWorkspace((state) => state.rootPath);
  // Search reaches exactly what the tree lists — same axis, one setting.
  const showIgnoredFolders = useSettings((state) => state.showIgnoredFolders);

  const [query, setQuery] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [results, setResults] = useState<SearchFileResult[]>([]);
  // A limit stopped the scan, so `totalMatches` is a floor rather than a total.
  const [truncated, setTruncated] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errorText, setErrorText] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  // Flattened result rows, in visual order, for keyboard navigation.
  const flat = useMemo(
    () =>
      results.flatMap((file) =>
        file.matches.map((match) => ({ path: file.path, line: match.line })),
      ),
    [results],
  );

  // Restore focus to the opener on close.
  useEffect(() => {
    if (!isOpen) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    return () => previousFocus.current?.focus();
  }, [isOpen]);

  // Focus the input on every open request, including one while already open.
  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen, focusRequest]);

  // Debounced search whenever the query / options change while open.
  useEffect(() => {
    if (!isOpen) return;
    const trimmed = query.trim();
    if (!rootPath || trimmed.length === 0) {
      setResults([]);
      setTruncated(false);
      setStatus("idle");
      setActiveIndex(-1);
      return;
    }
    setStatus("loading");
    let cancelled = false;
    const handle = setTimeout(() => {
      searchWorkspace(rootPath, trimmed, caseSensitive, showIgnoredFolders)
        .then((found) => {
          if (cancelled) return;
          setResults(found.files);
          setTruncated(found.truncated);
          setStatus("done");
          setActiveIndex(found.files.length > 0 ? 0 : -1);
        })
        .catch((error) => {
          if (cancelled) return;
          setResults([]);
          setTruncated(false);
          setStatus("error");
          setErrorText(errorMessage(error));
          setActiveIndex(-1);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [isOpen, query, caseSensitive, rootPath, showIgnoredFolders]);

  // Keep the active option scrolled into view as it changes.
  useEffect(() => {
    if (activeIndex < 0) return;
    document.getElementById(optionId(activeIndex))?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex]);

  if (!isOpen) return null;

  const totalMatches = results.reduce((sum, file) => sum + file.matches.length, 0);
  const trimmedQuery = query.trim();
  const hasResults = status === "done" && flat.length > 0;

  const openResult = (path: string, line: number) => {
    setPendingJumpLine(line);
    useUi.setState({ viewMode: "source" });
    void openPath(path).catch((error) => errorMessage(error));
    close();
  };

  const onInputKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case "Escape":
        event.preventDefault();
        close();
        break;
      case "ArrowDown":
        if (flat.length > 0) {
          event.preventDefault();
          setActiveIndex((i) => Math.min(flat.length - 1, i + 1));
        }
        break;
      case "ArrowUp":
        if (flat.length > 0) {
          event.preventDefault();
          setActiveIndex((i) => Math.max(0, i - 1));
        }
        break;
      case "Home":
        if (flat.length > 0) {
          event.preventDefault();
          setActiveIndex(0);
        }
        break;
      case "End":
        if (flat.length > 0) {
          event.preventDefault();
          setActiveIndex(flat.length - 1);
        }
        break;
      case "Enter": {
        const item = flat[activeIndex];
        if (item) {
          event.preventDefault();
          openResult(item.path, item.line);
        }
        break;
      }
    }
  };

  // What the counts actually mean. A capped scan makes them a floor, so the
  // "+" and the caveat travel with the number instead of being dropped — the
  // panel used to print the capped total as if it were the whole workspace.
  const summaryText = truncated
    ? t("search.summaryPartial", { matches: totalMatches, files: results.length })
    : t("search.summary", { matches: totalMatches, files: results.length });
  const emptyText = truncated ? t("search.emptyPartial") : t("search.empty");

  // Politely announced status for screen readers.
  const liveMessage =
    status === "loading"
      ? t("search.searching")
      : status === "error"
        ? errorText || t("search.failed")
        : status === "done"
          ? totalMatches > 0
            ? summaryText
            : emptyText
          : "";

  let optionIndex = -1;

  return (
    <aside
      aria-label={t("search.label")}
      className="absolute right-3 top-3 z-20 flex max-h-[80%] w-96 max-w-[calc(100%-1.5rem)] flex-col rounded-lg bg-bg shadow-card"
    >
      {/* The field is `outline-none` (the caret alone showed focus), so the row
          draws the ring while the field has focus — not when a button in it does. */}
      <div className="flex items-center gap-2 rounded-t-lg border-b border-border p-2 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:-outline-offset-2 has-[input:focus-visible]:outline-[var(--ring)]">
        <Search className="size-4 shrink-0 text-muted-fg" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onInputKeyDown}
          placeholder={t("search.placeholder")}
          aria-label={t("search.label")}
          role="combobox"
          aria-expanded={hasResults}
          aria-controls="workspace-search-listbox"
          aria-activedescendant={hasResults && activeIndex >= 0 ? optionId(activeIndex) : undefined}
          aria-autocomplete="list"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-fg"
        />
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          aria-pressed={caseSensitive}
          aria-label={t("find.caseSensitive")}
          title={t("find.caseSensitive")}
          onClick={() => setCaseSensitive((value) => !value)}
          className={cn("text-muted-fg", caseSensitive && "bg-muted text-fg")}
        >
          <CaseSensitive className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          aria-label={t("find.close")}
          title={t("find.close")}
          onClick={close}
          className="text-muted-fg"
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-1">
        {!rootPath ? (
          <p className="px-2 py-3 text-xs text-muted-fg">{t("search.noWorkspace")}</p>
        ) : status === "idle" ? (
          <p className="px-2 py-3 text-xs text-muted-fg">{t("search.hint")}</p>
        ) : status === "loading" ? (
          <p className="flex items-center gap-2 px-2 py-3 text-xs text-muted-fg">
            <Loader2 className="size-3.5 animate-spin" /> {t("search.searching")}
          </p>
        ) : status === "error" ? (
          <p className="px-2 py-3 text-xs text-danger-text">{errorText || t("search.failed")}</p>
        ) : results.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-fg">{emptyText}</p>
        ) : (
          <div id="workspace-search-listbox" role="listbox" aria-label={t("search.label")}>
            {results.map((file) => (
              <div key={file.path} role="group" aria-label={file.name} className="mb-1">
                <p
                  aria-hidden="true"
                  className="truncate px-2 py-1 text-xs font-medium text-fg"
                  title={file.name}
                >
                  {file.name}
                </p>
                {file.matches.map((match, index) => {
                  optionIndex += 1;
                  const idx = optionIndex;
                  const isActive = idx === activeIndex;
                  return (
                    <div
                      key={`${file.path}:${match.line}:${index}`}
                      id={optionId(idx)}
                      role="option"
                      aria-selected={isActive}
                      onMouseMove={() => setActiveIndex(idx)}
                      onClick={() => openResult(file.path, match.line)}
                      className={cn(
                        "flex w-full gap-2 rounded-md px-2 py-1 text-left text-xs transition-colors duration-(--motion-duration-fast) ease-snappy hover:bg-muted",
                        // The tint alone is 1.1:1; the inset ring carries it.
                        isActive && "bg-muted outline-2 -outline-offset-2 outline-[var(--ring)]",
                      )}
                    >
                      {/* A line number is machine data — mono at label size. */}
                      <span className="shrink-0 text-data text-muted-fg">{match.line}</span>
                      <span className="truncate text-muted-fg">
                        {highlightMatches(match.text, trimmedQuery, caseSensitive)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {status === "done" && totalMatches > 0 ? (
        <div className="flex items-start gap-1.5 px-2 py-1.5 text-xs text-muted-fg">
          {truncated ? <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /> : null}
          <span>{summaryText}</span>
        </div>
      ) : null}

      <div aria-live="polite" className="sr-only">
        {liveMessage}
      </div>
    </aside>
  );
}
