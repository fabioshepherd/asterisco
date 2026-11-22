import * as Dialog from "@radix-ui/react-dialog";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Docked side sheet — shadcn/ui's Sheet re-pointed at a panel that lives *in*
 * the layout instead of over it.
 *
 * A sheet here is a column the window gives up, not a layer dropped on top:
 * it is rendered in flow (no portal, no scrim) and the app beside it stays
 * live, which is the whole point for panels whose settings the document
 * previews as you change them. That makes it non-modal by construction — no
 * focus trap, no scroll lock, nothing rendered inert — so it keeps ARIA's
 * non-modal dialog shape: `role="dialog"` without `aria-modal`.
 *
 * Two dismissal behaviours differ from a modal sheet, both deliberate:
 * clicking outside never closes it (a docked panel that vanished when you
 * clicked the text it restyles would be unusable), and Escape closes it only
 * while focus is inside it — otherwise Escape belongs to whatever the user is
 * actually in.
 */
function Sheet(props: React.ComponentProps<typeof Dialog.Root>) {
  return <Dialog.Root modal={false} {...props} />;
}

const SheetClose = Dialog.Close;

function SheetContent({
  side = "right",
  className,
  onEscapeKeyDown,
  onInteractOutside,
  children,
  ...props
}: React.ComponentProps<typeof Dialog.Content> & { side?: "left" | "right" }) {
  const ref = React.useRef<HTMLDivElement>(null);

  return (
    <Dialog.Content
      ref={ref}
      onInteractOutside={(event) => {
        // The app beside the sheet is meant to be used while it is open, so an
        // interaction out there is never a dismissal.
        event.preventDefault();
        onInteractOutside?.(event);
      }}
      onEscapeKeyDown={(event) => {
        // Radix listens for Escape on the document; without this the key would
        // close the sheet from anywhere in the app, including the editor.
        if (!ref.current?.contains(document.activeElement)) {
          event.preventDefault();
          return;
        }
        onEscapeKeyDown?.(event);
      }}
      className={cn(
        // A hairline, never the floating shadow: this is a resting surface of
        // the layout, and DESIGN.md §4 reserves the shadow for what floats.
        "flex h-full min-h-0 flex-col bg-surface",
        side === "right" ? "border-s border-border" : "border-e border-border",
        className,
      )}
      {...props}
    >
      {children}
    </Dialog.Content>
  );
}

/** Sheet chrome: the title row and anything pinned above the scrolling body. */
function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex shrink-0 flex-col gap-3 px-4 pb-3 pt-4", className)} {...props} />
  );
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof Dialog.Title>) {
  return <Dialog.Title className={cn("text-sm font-medium text-fg", className)} {...props} />;
}

/**
 * The scrolling region of the sheet; takes the space the chrome leaves.
 *
 * It is a container-query root, because content sized against the *window* is
 * wrong in here: a three-column grid that is right on a 1280px screen is three
 * 110px slivers inside a 384px sheet. Size against `@sm`/`@lg`, not `sm`/`lg`.
 */
function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("@container relative min-h-0 flex-1 overflow-auto", className)} {...props} />
  );
}

export { Sheet, SheetBody, SheetClose, SheetContent, SheetHeader, SheetTitle };
