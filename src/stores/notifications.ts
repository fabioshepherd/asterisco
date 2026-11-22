import { create } from "zustand";

// `pending` is a sticky in-progress toast (spinner, no auto-dismiss) that a
// long-running op resolves in place via `update`.
export type NotificationKind = "success" | "error" | "info" | "pending";

/** An inline recovery affordance on a toast (e.g. "Undo" a rename, "Retry" a
 * failed save). The toast auto-dismisses once the action runs. */
export interface NotificationAction {
  /** Already-localized button label. */
  label: string;
  /** Run on click. */
  onAction: () => void;
}

export interface Notification {
  id: string;
  kind: NotificationKind;
  message: string;
  /** Optional one-tap recovery (Undo / Retry) rendered as a button. */
  action?: NotificationAction;
}

interface NotifyOptions {
  action?: NotificationAction;
}

interface NotificationsState {
  notifications: Notification[];
  /** Push a notification; returns its id. */
  notify: (kind: NotificationKind, message: string, opts?: NotifyOptions) => string;
  /** Resolve an existing notification in place (e.g. pending → success). No-op if
   * it's gone. Replaces the prior action: a resolved toast may gain a "Retry" action. */
  update: (id: string, kind: NotificationKind, message: string, opts?: NotifyOptions) => void;
  dismiss: (id: string) => void;
  /** Drop every toast at once (the "Clear all" control on a busy stack). */
  clearAll: () => void;
  /** Pause the auto-dismiss countdown while the user reads/reaches for a toast
   * (hover/focus). No-op on sticky toasts. */
  pause: (id: string) => void;
  /** Resume (restart) the auto-dismiss countdown. No-op on sticky toasts. */
  resume: (id: string) => void;
}

/** Base dwell time; longer messages earn more reading room, up to a cap. */
const AUTO_DISMISS_MIN_MS = 4000;
const AUTO_DISMISS_MAX_MS = 10_000;
const MS_PER_CHAR = 45;

function dwellFor(message: string): number {
  return Math.min(AUTO_DISMISS_MIN_MS + message.length * MS_PER_CHAR, AUTO_DISMISS_MAX_MS);
}

/** A toast waits for the user — never auto-dismisses — when it reports a failure,
 * is still in progress, or carries a recovery action the user must reach in time. */
function isSticky(n: Pick<Notification, "kind" | "action">): boolean {
  return n.kind === "error" || n.kind === "pending" || n.action !== undefined;
}

// Auto-dismiss timers live beside the store, not in the view, so a toast still
// drains on schedule while it's scrolled out of the capped visible stack.
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function clearTimer(id: string) {
  const handle = timers.get(id);
  if (handle !== undefined) {
    clearTimeout(handle);
    timers.delete(id);
  }
}

export const useNotifications = create<NotificationsState>()((set, get) => {
  /** (Re)arm the auto-dismiss timer for a toast; sticky toasts get none. */
  function schedule(n: Notification) {
    clearTimer(n.id);
    if (isSticky(n)) return;
    timers.set(
      n.id,
      setTimeout(() => get().dismiss(n.id), dwellFor(n.message)),
    );
  }

  return {
    notifications: [],
    notify: (kind, message, opts) => {
      // Coalesce an immediate duplicate of a fleeting toast (same kind + message,
      // no action on either side) so a burst of identical saves shows once
      // and simply refreshes its countdown instead of stacking.
      if ((kind === "success" || kind === "info") && opts?.action === undefined) {
        const existing = get().notifications.find(
          (n) => n.kind === kind && n.message === message && n.action === undefined,
        );
        if (existing) {
          schedule(existing);
          return existing.id;
        }
      }

      const id = crypto.randomUUID();
      const notification: Notification = {
        id,
        kind,
        message,
        action: opts?.action,
      };
      set((state) => ({ notifications: [...state.notifications, notification] }));
      schedule(notification);
      return id;
    },
    update: (id, kind, message, opts) => {
      let updated: Notification | undefined;
      set((state) => ({
        notifications: state.notifications.map((item) => {
          if (item.id !== id) return item;
          updated = { ...item, kind, message, action: opts?.action };
          return updated;
        }),
      }));
      // Resolving a pending toast may make it auto-dismissable (e.g. → success);
      // re-arm from the new kind/message, or cancel the timer if it's now sticky.
      if (updated) schedule(updated);
    },
    dismiss: (id) => {
      clearTimer(id);
      set((state) => ({
        notifications: state.notifications.filter((item) => item.id !== id),
      }));
    },
    clearAll: () => {
      for (const id of [...timers.keys()]) clearTimer(id);
      set({ notifications: [] });
    },
    pause: (id) => clearTimer(id),
    resume: (id) => {
      const n = get().notifications.find((item) => item.id === id);
      if (n) schedule(n);
    },
  };
});

/** Imperative helpers for non-React code (file-ops, export…). */
export const notify = {
  success: (message: string, action?: NotificationAction) =>
    useNotifications.getState().notify("success", message, action && { action }),
  error: (message: string, action?: NotificationAction) =>
    useNotifications.getState().notify("error", message, action && { action }),
  info: (message: string) => useNotifications.getState().notify("info", message),
  /** Sticky in-progress toast; resolve it later with `notify.update(id, …)`. */
  pending: (message: string) => useNotifications.getState().notify("pending", message),
  /** Resolve a pending toast; pass `action` to offer Retry on a failed outcome. */
  update: (id: string, kind: NotificationKind, message: string, action?: NotificationAction) =>
    useNotifications.getState().update(id, kind, message, action && { action }),
  dismiss: (id: string) => useNotifications.getState().dismiss(id),
};
