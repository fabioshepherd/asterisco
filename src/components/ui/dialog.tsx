import * as DialogPrimitive from "@radix-ui/react-dialog";
import { m } from "motion/react";
import * as React from "react";

import { focusOrigin, returnFocus } from "@/lib/focus-return";
import { fadeMotion, overlayMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Modal dialog — the one shell every modal in the app shares (DESIGN.md §5,
 * Menus & Floating Surfaces): the `--scrim` wash behind it, and a panel with the
 * surface background, a hairline border and the single floating shadow.
 *
 * Radix provides the focus trap, Escape and outside-click dismissal and the
 * aria-modal semantics; callers own only what goes inside the panel. On close,
 * focus goes back to where it was when the dialog opened (or to the active
 * editor): Radix would return it to a `Dialog.Trigger`, and none of these
 * dialogs has one, so without this it fell to `<body>`.
 */
const Dialog = DialogPrimitive.Root;
const DialogTitle = DialogPrimitive.Title;
const DialogDescription = DialogPrimitive.Description;
const DialogClose = DialogPrimitive.Close;

type DialogContentProps = React.ComponentProps<typeof DialogPrimitive.Content> & {
  /**
   * `center` for a decision or a form; `top` for the command palette, whose
   * list grows downwards from a fixed input row.
   */
  placement?: "center" | "top";
};

/**
 * Records the element focused when the dialog opened. It renders inside the
 * content, so it mounts on every open, and its state initializer runs during
 * that render — before any `autoFocus` inside the dialog has moved focus.
 */
function FocusOrigin({ into }: { into: React.RefObject<HTMLElement | null> }) {
  const [origin] = React.useState(focusOrigin);
  React.useEffect(() => {
    into.current = origin;
  }, [into, origin]);
  return null;
}

/**
 * Overlay + positioned content + animated panel. Radix props (role, auto-focus
 * and dismissal handlers, aria-*) go to the dialog element; `className` styles
 * the panel inside it.
 */
function DialogContent({
  className,
  children,
  placement = "center",
  onCloseAutoFocus,
  ...props
}: DialogContentProps) {
  const origin = React.useRef<HTMLElement | null>(null);
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay asChild>
        <m.div className="fixed inset-0 z-(--z-modal) bg-scrim" {...fadeMotion} />
      </DialogPrimitive.Overlay>
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 z-(--z-modal) -translate-x-1/2",
          placement === "center" ? "top-1/2 -translate-y-1/2" : "top-[18%]",
        )}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event);
          if (event.defaultPrevented) return;
          event.preventDefault();
          returnFocus(origin.current);
        }}
        {...props}
      >
        <FocusOrigin into={origin} />
        <m.div
          {...overlayMotion}
          className={cn(
            "rounded-lg border border-border bg-surface text-fg shadow-card",
            className,
          )}
        >
          {children}
        </m.div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle };
