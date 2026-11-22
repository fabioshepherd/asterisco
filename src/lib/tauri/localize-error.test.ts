import { describe, it, expect } from "vitest";

import { appErrorDetail, localizeAppError } from "./localize-error";

import i18n from "@/i18n";

describe("localizeAppError", () => {
  it("maps a notFound AppError to the localized errors.notFound phrase", () => {
    const result = localizeAppError({ kind: "notFound", message: "/x" });
    expect(result).toBe(i18n.t("errors.notFound", { ns: "editor", message: "/x" }));
  });

  /**
   * Every failure on disk used to collapse into "a file-system error occurred".
   * The errno is the only thing that says why, so it must reach the sentence.
   */
  it("names the errno the OS reported instead of one phrase for every failure", () => {
    expect(localizeAppError({ kind: "permissionDenied", message: "Permission denied" })).toBe(
      "permission denied",
    );
    expect(localizeAppError({ kind: "notADirectory", message: "Not a directory" })).toBe(
      "that path is not a folder",
    );
  });

  it("quotes the raw OS text for an errno with no phrase of its own", () => {
    // Not an adjective in place of the machine's own words: this is the only
    // thing that can explain a failure the list above does not name.
    expect(localizeAppError({ kind: "io", message: "No space left on device" })).toContain(
      "No space left on device",
    );
  });

  it("keeps the path and the raw text together for a tooltip or a log line", () => {
    expect(
      appErrorDetail({
        kind: "permissionDenied",
        message: "Permission denied",
        path: "/x/private",
      }),
    ).toBe("/x/private: Permission denied");
    // Nothing to add beyond the phrase itself.
    expect(appErrorDetail(new Error("boom"))).toBeUndefined();
  });

  it("returns the message of a plain Error", () => {
    expect(localizeAppError(new Error("boom"))).toBe("boom");
  });

  it("falls back to errors.unknown for an empty Error message", () => {
    expect(localizeAppError(new Error(""))).toBe(i18n.t("errors.unknown", { ns: "editor" }));
  });

  it("falls back to errors.unknown for a non-error value", () => {
    expect(localizeAppError(42)).toBe(i18n.t("errors.unknown", { ns: "editor" }));
  });
});
