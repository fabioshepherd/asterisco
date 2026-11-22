import { isTauri } from "@tauri-apps/api/core";
import {
  debug as pluginDebug,
  error as pluginError,
  info as pluginInfo,
  warn as pluginWarn,
} from "@tauri-apps/plugin-log";

type LogLevel = "debug" | "info" | "warn" | "error";
type LogFn = (msg: string, ...rest: unknown[]) => void;

const pluginByLevel: Record<LogLevel, (message: string) => Promise<void>> = {
  debug: pluginDebug,
  info: pluginInfo,
  warn: pluginWarn,
  error: pluginError,
};

/** Render an extra arg for the plugin, which only accepts a single string. */
function stringify(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.stack ?? `${value.name}: ${value.message}`;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function emit(level: LogLevel, msg: string, rest: unknown[]): void {
  if (isTauri()) {
    const line = rest.length ? `${msg} ${rest.map(stringify).join(" ")}` : msg;
    // Logging must never throw; the plugin call is fire-and-forget.
    void pluginByLevel[level](line).catch(() => {});
    return;
  }
  // Resolve at call time so test spies on `console.*` are honored.
  console[level](msg, ...rest);
}

/**
 * Thin logging facade. Inside a Tauri webview it forwards to
 * `tauri-plugin-log` (stdout + the OS log file); elsewhere (tests, plain
 * browser) it falls back to the matching `console.*`. Plugin failures are
 * swallowed so a logging call can never throw.
 */
export const log: Record<LogLevel, LogFn> = {
  debug: (msg, ...rest) => emit("debug", msg, rest),
  info: (msg, ...rest) => emit("info", msg, rest),
  warn: (msg, ...rest) => emit("warn", msg, rest),
  error: (msg, ...rest) => emit("error", msg, rest),
};
