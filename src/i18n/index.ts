import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enCommon from "./locales/en/common.json";
import enEditor from "./locales/en/editor.json";
import enMenu from "./locales/en/menu.json";
import itCommon from "./locales/it/common.json";
import itEditor from "./locales/it/editor.json";
import itMenu from "./locales/it/menu.json";

import { readMirroredLanguage, supportedLanguages } from "@/stores/settings";

export const defaultNS = "common";

// Resources are bundled inline (local-first): no http backend, no auto-detector.
export const resources = {
  en: { common: enCommon, menu: enMenu, editor: enEditor },
  it: { common: itCommon, menu: itMenu, editor: itEditor },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  // The bootstrap mirror avoids an English first paint; startup still applies
  // the persisted setting / OS locale once the store has loaded.
  lng: readMirroredLanguage() ?? "en",
  fallbackLng: "en",
  supportedLngs: [...supportedLanguages],
  defaultNS,
  ns: ["common", "menu", "editor"],
  interpolation: { escapeValue: false }, // React already escapes
  react: { useSuspense: false },
  debug: import.meta.env.DEV,
});

export default i18n;
