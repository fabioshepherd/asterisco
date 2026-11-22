import { describe, it, expect } from "vitest";
import { resources } from "./index";

function flatKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    value && typeof value === "object"
      ? flatKeys(value as Record<string, unknown>, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

describe("i18n resource parity", () => {
  for (const ns of ["common", "menu", "editor"] as const) {
    it(`it.${ns} has the same keys as en.${ns}`, () => {
      const en = flatKeys(resources.en[ns]).sort();
      const it = flatKeys(resources.it[ns]).sort();
      expect(it).toEqual(en);
    });
  }
});
