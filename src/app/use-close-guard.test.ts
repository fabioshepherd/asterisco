import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: vi.fn() }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: vi.fn() }));
vi.mock("@/features/file-ops/close-window", () => ({ closeWindowIfConfirmed: vi.fn() }));

import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { closeWindowIfConfirmed } from "@/features/file-ops/close-window";

import { useCloseGuard } from "./use-close-guard";

type CloseHandler = (event: { preventDefault: () => void }) => void | Promise<void>;

const onCloseRequested = vi.fn();
const destroy = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isTauri).mockReturnValue(true);
  // onCloseRequested returns a promise resolving to an unlisten fn.
  onCloseRequested.mockResolvedValue(() => {});
  vi.mocked(getCurrentWindow).mockReturnValue({
    onCloseRequested,
    destroy,
  } as unknown as ReturnType<typeof getCurrentWindow>);
});

describe("useCloseGuard", () => {
  it("registers an onCloseRequested handler when running under Tauri", () => {
    renderHook(() => useCloseGuard());

    expect(onCloseRequested).toHaveBeenCalledTimes(1);
    expect(onCloseRequested).toHaveBeenCalledWith(expect.any(Function));
  });

  it("does not register a handler outside Tauri", () => {
    vi.mocked(isTauri).mockReturnValue(false);

    renderHook(() => useCloseGuard());

    expect(onCloseRequested).not.toHaveBeenCalled();
  });

  it("prevents the native close and delegates to the confirm-then-destroy flow", async () => {
    renderHook(() => useCloseGuard());

    const handler = onCloseRequested.mock.calls[0]?.[0] as CloseHandler;
    const preventDefault = vi.fn();
    await handler({ preventDefault });

    // The guard must always pre-empt the native close so nothing is destroyed
    // before the unsaved-changes prompt resolves; destruction is deferred to
    // closeWindowIfConfirmed (covered in close-window.test.ts).
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(closeWindowIfConfirmed).toHaveBeenCalledTimes(1);
    expect(destroy).not.toHaveBeenCalled();
  });
});
