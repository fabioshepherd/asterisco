import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

import { useUnsavedPrompt } from "./use-unsaved-prompt";

/**
 * Modal asking the user how to handle unsaved changes before a destructive
 * action (open/new/close). Radix Dialog provides the focus trap, Escape-to-close
 * and aria-modal semantics; Escape / overlay click resolve as "cancel".
 */
export function UnsavedPromptDialog() {
  const { t } = useTranslation("editor");
  const isOpen = useUnsavedPrompt((state) => state.isOpen);
  const documentName = useUnsavedPrompt((state) => state.documentName);
  const resolve = useUnsavedPrompt((state) => state.resolve);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) resolve("cancel");
      }}
    >
      {/* An alert dialog: it interrupts the user's action and asks for a
          decision before it can continue (APG Alert Dialog). */}
      <DialogContent role="alertdialog" className="w-[min(28rem,90vw)] p-6">
        <DialogTitle className="text-base font-medium">{t("dialog.unsaved.title")}</DialogTitle>
        <DialogDescription className="mt-2 text-sm text-muted-fg">
          {t("dialog.unsaved.message", { name: documentName })}
        </DialogDescription>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => resolve("cancel")}>
            {t("dialog.unsaved.cancel")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => resolve("discard")}>
            {t("dialog.unsaved.discard")}
          </Button>
          <Button variant="default" size="sm" autoFocus onClick={() => resolve("save")}>
            {t("dialog.unsaved.save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
