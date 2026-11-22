import { Check, CircleAlert, Info, Loader2, X } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { tween } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { type Notification, type NotificationKind, useNotifications } from "@/stores/notifications";

import { TOASTS_ID } from "./focus-toast";

/** Cap the visible stack so a burst can't run off the top of the viewport.
 * Toasts beyond this still live in the store and still auto-dismiss on schedule
 * (the timer lives in the store, not here), and a "+N more" hint surfaces them. */
const MAX_VISIBLE = 6;

/** A leading icon per kind: shape (not just the tint) carries the meaning, so the
 * success/error distinction survives colour-blindness and a red-ish accent. */
function KindIcon({ kind }: { kind: NotificationKind }) {
  const className = "mt-0.5 size-4 shrink-0";
  switch (kind) {
    case "pending":
      return (
        <Loader2
          aria-hidden
          className={cn(className, "animate-spin text-muted-fg motion-reduce:animate-none")}
        />
      );
    case "success":
      return <Check aria-hidden className={cn(className, "text-primary")} />;
    case "error":
      return <CircleAlert aria-hidden className={cn(className, "text-danger-text")} />;
    case "info":
      return <Info aria-hidden className={cn(className, "text-muted-fg")} />;
  }
}

function ToastItem({ notification }: { notification: Notification }) {
  const { t } = useTranslation("editor");
  const dismiss = useNotifications((state) => state.dismiss);
  const pause = useNotifications((state) => state.pause);
  const resume = useNotifications((state) => state.resume);

  const action = notification.action;
  // Tie the message to its buttons so focusing × / Undo announces what it acts on
  // (the visible toast itself is not a live region — see ToastAnnouncer).
  const messageId = `toast-msg-${notification.id}`;

  return (
    <m.div
      layout
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={tween.fast}
      // Pause the auto-dismiss countdown while the pointer is over or focus is
      // inside the toast, so it can't vanish as the user reaches for Undo/Retry.
      onMouseEnter={() => pause(notification.id)}
      onMouseLeave={() => resume(notification.id)}
      onFocus={() => pause(notification.id)}
      onBlur={() => resume(notification.id)}
      onKeyDown={(event) => {
        if (event.key === "Escape") dismiss(notification.id);
      }}
      data-toast=""
      // One floating surface for every kind (DESIGN.md §4): a hairline, no tint.
      // The icon carries the state, and the live region says it in words.
      className="pointer-events-auto flex items-start gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm shadow-card"
    >
      <KindIcon kind={notification.kind} />
      <span
        id={messageId}
        className="min-w-0 flex-1 max-h-40 overflow-y-auto whitespace-pre-line text-fg"
      >
        {notification.message}
      </span>
      {action && (
        <button
          type="button"
          aria-describedby={messageId}
          onClick={() => {
            action.onAction();
            dismiss(notification.id);
          }}
          className="shrink-0 rounded-md border border-border px-2 py-0.5 text-xs font-medium text-fg transition-[color,background-color,transform] duration-(--motion-duration-fast) ease-snappy hover:bg-muted active:scale-[0.98]"
        >
          {action.label}
        </button>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        type="button"
        aria-label={t("notify.dismiss")}
        aria-describedby={messageId}
        onClick={() => dismiss(notification.id)}
        className="shrink-0 text-muted-fg"
      >
        <X />
      </Button>
    </m.div>
  );
}

/** Persistent, visually-hidden live regions — mounted once for the app's lifetime.
 * A live region created together with its first message is announced inconsistently
 * across screen readers, so the visible toasts stay silent and announcement happens
 * here. Polite carries routine status; assertive carries errors. A pending→error
 * escalation moves the message between the two regions, so a failure is re-announced
 * assertively rather than slipping by as a polite update. */
function ToastAnnouncer({ notifications }: { notifications: Notification[] }) {
  const polite = notifications.filter((n) => n.kind !== "error");
  const assertive = notifications.filter((n) => n.kind === "error");
  return (
    <>
      <div role="status" aria-live="polite" aria-atomic="false" className="sr-only">
        {polite.map((n) => (
          <div key={n.id}>{n.message}</div>
        ))}
      </div>
      <div role="alert" aria-live="assertive" aria-atomic="false" className="sr-only">
        {assertive.map((n) => (
          <div key={n.id}>{n.message}</div>
        ))}
      </div>
    </>
  );
}

/** Bottom-right transient notifications (success / error feedback). */
export function Toaster() {
  const { t } = useTranslation("editor");
  const notifications = useNotifications((state) => state.notifications);
  const clearAll = useNotifications((state) => state.clearAll);

  const hiddenCount = Math.max(0, notifications.length - MAX_VISIBLE);
  // Show the control row once the stack is genuinely busy or overflowing — not for
  // a lone toast or two, where it would just add chrome to a calm surface.
  const showControls = hiddenCount > 0 || notifications.length > 2;

  return (
    <>
      <ToastAnnouncer notifications={notifications} />
      {notifications.length > 0 && (
        // Sits above modals (`--z-toast`) and clears the status bar (`bottom-10`).
        // A named region, so the stack is a landmark AT can list and jump to.
        <div
          id={TOASTS_ID}
          role="region"
          aria-label={t("notify.region")}
          className="pointer-events-none fixed bottom-10 right-3 z-(--z-toast) flex w-80 max-w-[calc(100vw-1.5rem)] flex-col gap-2"
        >
          {showControls && (
            <div className="pointer-events-auto flex w-full items-center justify-end gap-2 text-xs text-muted-fg">
              {hiddenCount > 0 && <span>{t("notify.more", { count: hiddenCount })}</span>}
              <button
                type="button"
                onClick={clearAll}
                className="rounded-md px-2 py-0.5 font-medium text-muted-fg transition-[color,background-color] duration-(--motion-duration-fast) ease-snappy hover:bg-muted hover:text-fg"
              >
                {t("notify.clearAll")}
              </button>
            </div>
          )}
          <AnimatePresence initial={false}>
            {notifications.slice(-MAX_VISIBLE).map((notification) => (
              <ToastItem key={notification.id} notification={notification} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </>
  );
}
