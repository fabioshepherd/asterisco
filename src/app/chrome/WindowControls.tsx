import { Minus, Square, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { closeWindow, minimizeWindow, toggleMaximizeWindow } from "@/lib/tauri/window";
import { cn } from "@/lib/utils";

const CONTROL =
  "flex h-full w-11 items-center justify-center text-muted-fg outline-none transition-colors duration-(--motion-duration-fast) ease-snappy hover:bg-muted hover:text-fg focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

/**
 * Custom min/maximize/close controls for the frameless Windows/Linux title bar.
 * Icon buttons (never draggable) wired to the window.ts wrappers; close turns
 * red on hover via the semantic danger token.
 */
export function WindowControls() {
  const { t } = useTranslation("menu");
  return (
    <div className="flex items-stretch">
      <button
        type="button"
        aria-label={t("window.controls.minimize")}
        onClick={() => void minimizeWindow()}
        className={CONTROL}
      >
        <Minus className="size-4" />
      </button>
      <button
        type="button"
        aria-label={t("window.controls.maximize")}
        onClick={() => void toggleMaximizeWindow()}
        className={CONTROL}
      >
        <Square className="size-3.5" />
      </button>
      <button
        type="button"
        aria-label={t("window.controls.close")}
        onClick={() => void closeWindow()}
        className={cn(CONTROL, "hover:bg-danger hover:text-danger-fg")}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
