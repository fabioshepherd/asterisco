import { describe, expect, it } from "vitest";
import { COMMANDS } from "./commands";
import { menuEventName } from "./event-names";

describe("menu event names", () => {
  it("derives menu://<id> from a command id", () => {
    expect(menuEventName("new-file")).toBe("menu://new-file");
  });
  it("covers every command id", () => {
    for (const id of Object.keys(COMMANDS)) {
      expect(menuEventName(id)).toBe(`menu://${id}`);
    }
  });
});
