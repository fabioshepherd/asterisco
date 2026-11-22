import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { useFileActions } from "./file-actions";

/** Name-entry modal for creating a new file or renaming an entry. */
export function NameDialog() {
  const { t } = useTranslation("editor");
  const prompt = useFileActions((state) => state.prompt);
  const name = useFileActions((state) => state.name);
  const error = useFileActions((state) => state.error);
  const busy = useFileActions((state) => state.busy);
  const setName = useFileActions((state) => state.setName);
  const cancel = useFileActions((state) => state.cancel);
  const submit = useFileActions((state) => state.submit);
  const inputRef = useRef<HTMLInputElement>(null);

  const isRename = prompt?.kind === "rename";

  // On open, pre-select the editable part of the name: the filename stem for a
  // rename (so the extension is kept but easy to overtype), all of it otherwise.
  useEffect(() => {
    const el = inputRef.current;
    if (!el || !prompt) return;
    el.focus();
    if (prompt.kind === "rename") {
      const base = prompt.targetPath.split(/[/\\]/).pop() ?? "";
      const dot = base.lastIndexOf(".");
      el.setSelectionRange(0, dot > 0 ? dot : base.length);
    } else {
      el.select();
    }
  }, [prompt]);

  return (
    <Dialog
      open={prompt !== null}
      onOpenChange={(open) => {
        if (!open) cancel();
      }}
    >
      <DialogContent aria-describedby={undefined} className="w-[min(26rem,90vw)] p-6">
        <DialogTitle className="text-base font-medium">
          {isRename ? t("fileActions.renameTitle") : t("fileActions.newTitle")}
        </DialogTitle>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <Input
            ref={inputRef}
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("fileActions.namePlaceholder")}
            aria-label={t("fileActions.namePlaceholder")}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "name-dialog-error" : undefined}
            className={cn("mt-4 w-full", error && "border-danger")}
          />
          {error ? (
            <p id="name-dialog-error" role="alert" className="mt-2 text-xs text-danger-text">
              {error}
            </p>
          ) : null}
          <div className="mt-6 flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={cancel}>
              {t("fileActions.cancel")}
            </Button>
            <Button
              type="submit"
              variant="default"
              size="sm"
              disabled={name.trim().length === 0 || busy}
            >
              {isRename ? t("fileActions.rename") : t("fileActions.create")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
