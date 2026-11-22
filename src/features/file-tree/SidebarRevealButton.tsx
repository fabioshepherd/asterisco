import { PanelLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { useUi } from "@/stores/ui";

/** Floating control to reopen the sidebar when it is collapsed. */
export function SidebarRevealButton() {
  const { t } = useTranslation("editor");
  const sidebarVisible = useUi((state) => state.sidebarVisible);
  const distractionFree = useUi((state) => state.distractionFree);
  const toggleSidebar = useUi((state) => state.toggleSidebar);

  if (sidebarVisible || distractionFree) return null;

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      type="button"
      onClick={toggleSidebar}
      aria-label={t("fileTree.toggleSidebar")}
      title={t("fileTree.toggleSidebar")}
      aria-pressed={sidebarVisible}
      // No resting opacity: `--muted-fg` at 60% measured 2.52:1 against the
      // page, under WCAG 2.2's 3:1 floor for a control's graphics — and this is
      // the only way back to a hidden sidebar, so resting is the state that has
      // to be findable. The token on its own is quiet enough.
      className="absolute left-2 top-2 z-10 text-muted-fg"
    >
      <PanelLeft className="size-4" />
    </Button>
  );
}
