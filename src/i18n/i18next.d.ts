import "i18next";
import type { defaultNS, resources } from "./index";

// Type-safe translation keys: `t("app.title")` is checked against the en resources.
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS;
    resources: (typeof resources)["en"];
  }
}
