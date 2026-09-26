"use client";
import type { ReactNode } from "react";
import { useIsMobile } from "@foundry/ui/use-mobile";
import { cn } from "@foundry/ui/cn";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@foundry/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "@foundry/ui/drawer";

// One create/edit surface: Dialog on desktop. Mobile defaults to a top drawer
// (admin inquiry/order forms start at the top; no blank gap under a bottom
// sheet). Pass direction="bottom" for customer task sheets (vacation, skip).
//
// The shell owns the spacing so every popup reads the same: a padded header, a
// padded scrolling body, and a divided footer whose buttons sit right on desktop
// and stack full-width on a phone (primary on top). Callers pass bare content —
// no outer padding of their own — and actions through `footer`. `flush` drops the
// body padding for edge-to-edge content (tables, maps, lists).
export function ResponsiveDialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
  contentClassName,
  direction = "top",
  nested = false,
  handleOnly = false,
  flush = false,
}: {
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  trigger?: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  contentClassName?: string;
  direction?: "top" | "bottom";
  /** Nested Vaul drawer — required when this sheet opens from inside another drawer. */
  nested?: boolean;
  /** Only the handle swipes the sheet closed; inner widgets (calendars) keep pointer events. */
  handleOnly?: boolean;
  /** Edge-to-edge body: no padding (tables, maps, full-width lists). */
  flush?: boolean;
}) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <Drawer
        nested={nested}
        handleOnly={handleOnly}
        direction={direction}
        open={open}
        onOpenChange={onOpenChange}
      >
        {trigger && <DrawerTrigger asChild>{trigger}</DrawerTrigger>}
        <DrawerContent
          className={cn(
            "flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0",
            direction === "top" ? "rounded-b-2xl" : "rounded-t-2xl",
            contentClassName,
          )}
        >
          <DrawerHeader className="shrink-0 gap-1 px-5 pt-5 pb-4 text-left">
            <DrawerTitle className="text-lg font-semibold tracking-[-0.01em]">{title}</DrawerTitle>
            {description && <DrawerDescription className="text-pretty">{description}</DrawerDescription>}
          </DrawerHeader>
          {children != null ? (
            <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", !flush && "px-5 pb-5")}>{children}</div>
          ) : null}
          {footer ? (
            <div className="flex shrink-0 flex-col-reverse gap-2 border-t bg-muted/40 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] [&>div]:flex [&>div]:w-full [&>div]:flex-col-reverse [&>div]:gap-2 [&_button]:w-full">
              {footer}
            </div>
          ) : null}
        </DrawerContent>
      </Drawer>
    );
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        className={cn(
          "flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg",
          contentClassName,
        )}
      >
        {/* pr-12 keeps the title clear of the close button. */}
        <DialogHeader className="shrink-0 gap-1 px-6 pt-6 pr-12 pb-4 text-left">
          <DialogTitle className="text-lg font-semibold tracking-[-0.01em]">{title}</DialogTitle>
          {description && <DialogDescription className="text-pretty">{description}</DialogDescription>}
        </DialogHeader>
        {children != null ? (
          <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", !flush && "px-6 pb-6")}>{children}</div>
        ) : null}
        {footer ? (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t bg-muted/40 px-6 py-4">
            {footer}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
