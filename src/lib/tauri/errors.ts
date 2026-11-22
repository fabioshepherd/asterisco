// Mirror of the Rust `AppError` serialization (src-tauri/src/error.rs).
// Tauri commands reject `invoke` with this tagged shape on `Err`.
//
// The kinds below the first line are errno names: one "io" bucket could only
// ever produce one sentence, so the OS's own answer to *why* was being thrown
// away on the way to the user.
export type AppErrorKind =
  | "io"
  | "notFound"
  | "alreadyExists"
  | "permissionDenied"
  | "notADirectory"
  | "trash"
  | "watch"
  | "resource"
  | "imageTooLarge";

export interface AppError {
  kind: AppErrorKind;
  /** The raw, untranslated OS text. For logs and detail lines, never as UI copy. */
  message: string;
  /** What the failure happened on, when the command knew. */
  path?: string;
}

export function isAppError(value: unknown): value is AppError {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    "message" in value &&
    typeof (value as { message: unknown }).message === "string"
  );
}

/** Extract a human-readable message from an unknown thrown value. */
export function errorMessage(value: unknown): string {
  if (isAppError(value)) return value.path ? `${value.path}: ${value.message}` : value.message;
  if (value instanceof Error) return value.message;
  return String(value);
}
