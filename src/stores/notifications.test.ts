import { beforeEach, describe, expect, it } from "vitest";

import { notify, useNotifications } from "./notifications";

beforeEach(() => {
  useNotifications.setState({ notifications: [] });
});

describe("notifications store", () => {
  it("pushes notifications and returns their id", () => {
    const id = useNotifications.getState().notify("success", "Saved");

    const list = useNotifications.getState().notifications;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id, kind: "success", message: "Saved" });
  });

  it("dismisses a notification by id", () => {
    const id = useNotifications.getState().notify("error", "Boom");

    useNotifications.getState().dismiss(id);

    expect(useNotifications.getState().notifications).toHaveLength(0);
  });

  it("exposes imperative helpers", () => {
    notify.error("Failed");

    expect(useNotifications.getState().notifications[0]?.kind).toBe("error");
  });

  it("resolves a pending notification in place via update", () => {
    const id = notify.pending("Exporting…");
    expect(useNotifications.getState().notifications[0]).toMatchObject({
      id,
      kind: "pending",
      message: "Exporting…",
    });

    notify.update(id, "success", "Exported to “a.html”");

    const list = useNotifications.getState().notifications;
    expect(list).toHaveLength(1);
    // Same id (so the toast morphs in place rather than stacking a new one).
    expect(list[0]).toMatchObject({ id, kind: "success", message: "Exported to “a.html”" });
  });

  it("update is a no-op once the notification is gone", () => {
    const id = notify.pending("Working…");
    notify.dismiss(id);

    notify.update(id, "success", "Done");

    expect(useNotifications.getState().notifications).toHaveLength(0);
  });

  it("carries an action on a notification", () => {
    const onAction = () => {};
    notify.error("Save failed", { label: "Retry", onAction });

    expect(useNotifications.getState().notifications[0]?.action).toEqual({
      label: "Retry",
      onAction,
    });
  });

  it("update can attach a retry action to a resolved toast", () => {
    const onAction = () => {};
    const id = notify.pending("Exporting…");

    notify.update(id, "error", "Export failed", { label: "Retry", onAction });

    const item = useNotifications.getState().notifications[0];
    expect(item?.action).toEqual({ label: "Retry", onAction });
  });
});
