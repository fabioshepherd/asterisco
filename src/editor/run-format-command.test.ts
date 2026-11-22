import { describe, expect, it, vi, beforeEach } from "vitest";
import type { CmdKey } from "@milkdown/kit/core";

import { useUi } from "@/stores/ui";

import { setActiveEditor } from "./active-editor";
import { runFormatCommand } from "./run-format-command";

beforeEach(() => {
  setActiveEditor(null);
  useUi.setState({ viewMode: "edit" });
});

describe("runFormatCommand", () => {
  it("no-ops safely when there is no active editor", () => {
    expect(() => runFormatCommand("ToggleStrong" as unknown as CmdKey<void>)).not.toThrow();
  });

  it("calls the command on the active editor with its payload", () => {
    const call = vi.fn();
    const focus = vi.fn();
    // `ctx.get` serves both `editorViewCtx` (read by `viewFromCtx`, needs a
    // truthy `.state` to pass the mounted-view guard, plus `.focus`) and
    // `commandsCtx` (needs `.call`); stub both off one object.
    const action = vi.fn((cb: (ctx: unknown) => void) =>
      cb({ get: () => ({ call, focus, state: {} }) }),
    );
    setActiveEditor({ editor: { action } } as never);

    runFormatCommand("WrapInHeading" as unknown as CmdKey<number>, 2);

    expect(action).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalled();
    expect(call).toHaveBeenCalledWith(expect.anything(), 2);
  });

  it("no-ops outside edit mode (reading/source), so it never edits the wrong surface", () => {
    const action = vi.fn();
    setActiveEditor({ editor: { action } } as never);

    useUi.setState({ viewMode: "reading" });
    runFormatCommand("ToggleStrong" as unknown as CmdKey<void>);
    useUi.setState({ viewMode: "source" });
    runFormatCommand("ToggleStrong" as unknown as CmdKey<void>);

    expect(action).not.toHaveBeenCalled();
  });
});
