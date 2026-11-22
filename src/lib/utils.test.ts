import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("keeps text-data next to a text colour", () => {
    expect(cn("text-data text-fg")).toBe("text-data text-fg");
    expect(cn("text-muted-fg text-data")).toBe("text-muted-fg text-data");
  });

  it("treats text-data as a font size", () => {
    expect(cn("text-sm text-data")).toBe("text-data");
    expect(cn("text-data text-xs")).toBe("text-xs");
  });
});
