import { beforeEach, describe, expect, it } from "vitest";

import { useUi } from "./ui";

describe("ui store view modes", () => {
  beforeEach(() => {
    useUi.setState({ viewMode: "edit", distractionFree: false });
  });

  it("defaults to the edit view", () => {
    expect(useUi.getState().viewMode).toBe("edit");
  });

  it("setViewMode switches the active view exclusively", () => {
    useUi.getState().setViewMode("source");
    expect(useUi.getState().viewMode).toBe("source");
    useUi.getState().setViewMode("reading");
    // Reading replaces source — never both at once.
    expect(useUi.getState().viewMode).toBe("reading");
  });

  it("toggleSource flips edit<->source and back", () => {
    useUi.getState().toggleSource();
    expect(useUi.getState().viewMode).toBe("source");
    useUi.getState().toggleSource();
    expect(useUi.getState().viewMode).toBe("edit");
  });

  it("toggleSource from reading goes to source (not edit)", () => {
    useUi.getState().setViewMode("reading");
    useUi.getState().toggleSource();
    expect(useUi.getState().viewMode).toBe("source");
  });

  it("toggleReading flips edit<->reading and back", () => {
    useUi.getState().toggleReading();
    expect(useUi.getState().viewMode).toBe("reading");
    useUi.getState().toggleReading();
    expect(useUi.getState().viewMode).toBe("edit");
  });

  it("toggles distraction-free independently of the view", () => {
    useUi.getState().toggleDistractionFree();
    expect(useUi.getState().distractionFree).toBe(true);
    expect(useUi.getState().viewMode).toBe("edit");
    useUi.getState().setDistractionFree(false);
    expect(useUi.getState().distractionFree).toBe(false);
  });
});
