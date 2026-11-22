import { beforeEach, describe, expect, it } from "vitest";

import { useRecentCommands } from "./recent-commands";

describe("useRecentCommands", () => {
  beforeEach(() => {
    useRecentCommands.setState({ recent: [] });
  });

  it("promotes a freshly used command to the front", () => {
    const { record } = useRecentCommands.getState();
    record("save");
    record("find");
    expect(useRecentCommands.getState().recent).toEqual(["find", "save"]);
  });

  it("de-duplicates, moving a repeat to the front without growing", () => {
    const { record } = useRecentCommands.getState();
    record("save");
    record("find");
    record("save");
    expect(useRecentCommands.getState().recent).toEqual(["save", "find"]);
  });

  it("caps the list at five entries", () => {
    const { record } = useRecentCommands.getState();
    for (const id of ["a", "b", "c", "d", "e", "f"]) record(id);
    expect(useRecentCommands.getState().recent).toEqual(["f", "e", "d", "c", "b"]);
  });
});
