import { getVersion } from "@tauri-apps/api/app";
import { isTauri } from "@tauri-apps/api/core";
import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { AppMark } from "@/components/brand/AppMark";
import { playAboutOpen, startBreathing, type Breathing } from "@/components/brand/app-mark-motion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useNoticesDialog } from "@/features/settings/use-notices-dialog";
import { checkForUpdates } from "@/features/updates/check-updates";

import { useAboutDialog } from "./use-about-dialog";

/**
 * The About panel, the same on macOS, Windows and Linux (owner decision,
 * 2026-11-20): it replaces the native macOS panel, and gives Windows/Linux the
 * About they did not have. Mark, name, version and licence, plus the two things
 * people come here for — an update check and the third-party notices.
 *
 * The mark is decorative (the name is written beside it). It draws itself when
 * the panel opens (A2), breathes while a check started here runs (A3) and
 * settles when the check has an answer (A4); see app-mark-motion.ts. While a
 * check started here is running, the status is also said in words in a polite
 * live region; the outcome arrives as the usual toast. Radix Dialog provides the focus trap,
 * Escape and the return of focus on close.
 */
export function AboutDialog() {
  const { t } = useTranslation("editor");
  const { t: tMenu } = useTranslation("menu");
  const isOpen = useAboutDialog((state) => state.isOpen);
  const close = useAboutDialog((state) => state.close);
  const [version, setVersion] = useState<string | null>(null);
  // `busy` lasts the whole update flow (check, prompt, download); `checking`
  // only until the check has an answer, which is what the live region says.
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const mark = useRef<SVGSVGElement | null>(null);
  const breathing = useRef<Breathing | null>(null);

  // A2 runs each time the mark mounts, which is each time the panel opens.
  const markRef = useCallback((node: SVGSVGElement | null) => {
    mark.current = node;
    if (node) playAboutOpen(node);
  }, []);

  // Closing the panel stops the A3 loop at once: nothing left to settle.
  useEffect(() => {
    if (isOpen) return;
    breathing.current?.cancel();
    breathing.current = null;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !isTauri()) return;
    let cancelled = false;
    getVersion()
      .then((value) => {
        if (!cancelled) setVersion(value);
      })
      // Without a version the line stays empty; nothing to report.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const runCheck = () => {
    if (busy) return;
    setBusy(true);
    setChecking(true);
    breathing.current = startBreathing(mark.current);
    // A4 once the check has an answer: the loop settles where it is. The handle
    // stays, so closing the panel still stops an A4 under way.
    const settle = () => {
      setChecking(false);
      breathing.current?.settle();
    };
    void checkForUpdates(settle).finally(() => {
      settle();
      setBusy(false);
    });
  };

  const openNotices = () => {
    close();
    useNoticesDialog.getState().open();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent aria-describedby={undefined} className="w-[min(24rem,92vw)]">
        <header className="flex items-start justify-between gap-4 px-6 pt-4">
          <DialogTitle className="text-base font-medium">{t("about.title")}</DialogTitle>
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              type="button"
              aria-label={t("about.close")}
              className="shrink-0 text-muted-fg"
            >
              <X className="size-4" />
            </Button>
          </DialogClose>
        </header>

        <div className="flex flex-col items-center gap-2 px-6 pt-4 pb-6 text-center">
          <AppMark ref={markRef} className="size-16 text-fg" />
          <p className="mt-2 text-lg font-medium">{tMenu("app.name")}</p>
          {/* The height is kept while the version loads, so the panel does not jump. */}
          <p className="min-h-4 font-mono text-xs text-muted-fg">
            {version ? t("about.version", { version }) : null}
          </p>
          <p className="text-sm text-muted-fg">{t("about.license")}</p>
        </div>

        <footer className="flex flex-col gap-3 border-t border-border px-6 py-4">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {/* aria-disabled, not disabled: a disabled button drops the focus it
                holds to <body>, out of the dialog's focus trap. */}
            <Button
              variant="outline"
              type="button"
              onClick={runCheck}
              aria-disabled={busy || undefined}
              className="aria-disabled:opacity-50"
            >
              {t("about.checkUpdates")}
            </Button>
            <Button variant="ghost" type="button" onClick={openNotices}>
              {t("settings.notices.title")}
            </Button>
          </div>
          <p aria-live="polite" className="min-h-4 text-center text-xs text-muted-fg">
            {checking ? t("about.checking") : ""}
          </p>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
