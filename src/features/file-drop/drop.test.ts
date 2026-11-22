import { describe, expect, it } from "vitest";
import { routeDroppedPath } from "./drop";

describe("routeDroppedPath", () => {
  it("routes markdown/text files to open", () => {
    expect(routeDroppedPath("/x/a.md")).toBe("open");
    expect(routeDroppedPath("/x/a.markdown")).toBe("open");
    expect(routeDroppedPath("/x/a.mdx")).toBe("open");
    expect(routeDroppedPath("/x/a.MD")).toBe("open");
    expect(routeDroppedPath("/x/a.txt")).toBe("open");
  });

  it("ignores anything else", () => {
    expect(routeDroppedPath("/x/a.docx")).toBe("ignore");
    expect(routeDroppedPath("/x/a.pdf")).toBe("ignore");
    expect(routeDroppedPath("/x/a.png")).toBe("ignore");
    expect(routeDroppedPath("/x/README")).toBe("ignore");
  });
});
