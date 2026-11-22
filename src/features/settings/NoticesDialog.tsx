import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { localizeAppError } from "@/lib/tauri/localize-error";
import { readThirdPartyNotices } from "@/lib/tauri/resources";

import { useNoticesDialog } from "./use-notices-dialog";

type LoadState =
  { status: "loading" } | { status: "ready"; text: string } | { status: "error"; message: string };

/**
 * Modal showing the bundled THIRD-PARTY-NOTICES.txt (open-source license
 * notices). Radix Dialog provides the focus trap, Escape-to-close and
 * aria-modal semantics. The notices are fetched on open via a Rust command;
 * a failure (e.g. an unresolved resource in some dev setups) is surfaced as a
 * localized message rather than crashing.
 */
export function NoticesDialog() {
  const { t } = useTranslation("editor");
  const isOpen = useNoticesDialog((state) => state.isOpen);
  const close = useNoticesDialog((state) => state.close);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setState({ status: "loading" });
    readThirdPartyNotices()
      .then((text) => {
        if (!cancelled) setState({ status: "ready", text });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: "error", message: localizeAppError(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        className="flex h-[min(34rem,90vh)] w-[min(46rem,92vw)] flex-col overflow-hidden"
      >
        <header className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div className="min-w-0">
            <DialogTitle className="text-base font-medium">
              {t("settings.notices.title")}
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-muted-fg">
              {t("settings.notices.description")}
            </DialogDescription>
          </div>
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              type="button"
              aria-label={t("fileActions.cancel")}
              className="shrink-0 text-muted-fg"
            >
              <X className="size-4" />
            </Button>
          </DialogClose>
        </header>

        <div className="min-h-0 flex-1 overflow-auto p-6">
          {state.status === "loading" ? (
            <p className="text-sm text-muted-fg">{t("settings.notices.loading")}</p>
          ) : null}
          {state.status === "error" ? (
            <p className="text-sm text-danger-text">
              {t("settings.notices.error", { error: state.message })}
            </p>
          ) : null}
          {state.status === "ready" ? (
            <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-fg">
              {state.text}
            </pre>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
