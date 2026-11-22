import { isTauri } from "@tauri-apps/api/core";
import { locale } from "@tauri-apps/plugin-os";

import { supportedLanguages, type Language } from "@/stores/settings";

const FALLBACK_LANGUAGE: Language = "en";

function toSupportedLanguage(tag: string | null): Language {
  const primary = (tag ?? "").toLowerCase().split("-")[0];
  return supportedLanguages.find((lang) => lang === primary) ?? FALLBACK_LANGUAGE;
}

/**
 * Best-effort initial UI language from the OS locale. Returns the fallback
 * outside the Tauri runtime (e.g. plain browser / tests).
 */
export async function getOsLanguage(): Promise<Language> {
  if (!isTauri()) return FALLBACK_LANGUAGE;
  try {
    return toSupportedLanguage(await locale());
  } catch {
    return FALLBACK_LANGUAGE;
  }
}
