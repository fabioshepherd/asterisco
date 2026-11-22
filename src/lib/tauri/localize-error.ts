import { isAppError, errorMessage } from "./errors";

import i18n from "@/i18n";

/**
 * Turn an unknown thrown value into a short, localized, user-facing phrase
 * suitable for interpolation into a `"Couldn't save: {{error}}"`-style toast.
 *
 * The phrase comes from the error's `kind`, which is now the errno's own name
 * ("permission denied", "not a folder") rather than one bucket for everything
 * that can go wrong on a disk. Only the errnos with no phrase of their own fall
 * back to `errors.io`, which quotes the raw OS text instead of replacing it
 * with an adjective.
 *
 * Use this for anything shown to the USER. Keep `errorMessage` for LOGGING,
 * which must preserve the raw (untranslated) OS message and its path.
 */
export function localizeAppError(error: unknown): string {
  if (isAppError(error)) {
    // A kind-specific phrase; `message` carries the raw OS detail for the
    // (few) strings that choose to interpolate it.
    return i18n.t(`errors.${error.kind}`, { ns: "editor", message: error.message });
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return i18n.t("errors.unknown", { ns: "editor" });
}

/**
 * The unlocalized truth behind a failure — the path it happened on and the OS's
 * own words — for a tooltip or a log line beside the localized phrase.
 *
 * `localizeAppError` says what a person needs; this is what a bug report needs.
 * `undefined` when there is nothing beyond the phrase itself to add.
 */
export function appErrorDetail(error: unknown): string | undefined {
  if (!isAppError(error)) return undefined;
  return errorMessage(error);
}
