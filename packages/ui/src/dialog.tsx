"use client"

import * as React from "react"
import {
  Dialog,
  DialogBackdrop as SdkDialogBackdrop,
  DialogClose,
  DialogContent as SdkDialogContent,
  DialogDescription as SdkDialogDescription,
  DialogTitle as SdkDialogTitle,
  DialogTrigger as SdkDialogTrigger,
} from "@ui-sdk/react/dialog"
import { XIcon } from "lucide-react"

import { cn } from "./cn"
import { Button } from "./button"

function DialogTrigger(props: React.ComponentProps<typeof SdkDialogTrigger>) {
  return <SdkDialogTrigger {...props} />
}

function DialogBackdrop({ className, ...props }: React.ComponentProps<typeof SdkDialogBackdrop>) {
  return (
    <SdkDialogBackdrop
      className={cn(
        "fixed inset-0 isolate z-50 bg-(--ui-modal-backdrop) transition-opacity duration-(--ui-modal-duration) ease-(--ui-modal-ease) supports-backdrop-filter:backdrop-blur-(--ui-modal-blur) motion-reduce:transition-none data-ending-style:opacity-0 data-starting-style:opacity-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: Omit<React.ComponentProps<typeof SdkDialogContent>, "children"> & {
  children?: React.ReactNode
  showCloseButton?: boolean
}) {
  return (
    <>
      <DialogBackdrop />
      <SdkDialogContent
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-2rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-(--ui-radius-modal) bg-popover p-4 text-sm text-popover-foreground shadow-(--ui-shadow-modal) outline-none transition-[opacity,scale] duration-(--ui-modal-duration) ease-(--ui-modal-ease) sm:max-w-sm motion-reduce:transition-none data-ending-style:scale-(--ui-modal-scale) data-ending-style:opacity-0 data-starting-style:scale-(--ui-modal-scale) data-starting-style:opacity-0",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogClose render={<Button variant="ghost" className="absolute top-2 right-2" size="icon-sm" />}>
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogClose>
        )}
      </SdkDialogContent>
    </>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-header" className={cn("flex flex-col gap-2", className)} {...props} />
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-(--ui-radius-modal) border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogClose render={<Button variant="outline" />}>Close</DialogClose>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof SdkDialogTitle>) {
  return (
    <SdkDialogTitle
      className={cn("font-heading text-base leading-none font-(weight:--ui-modal-title-weight)", className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof SdkDialogDescription>) {
  return (
    <SdkDialogDescription
      className={cn(
        "text-(length:--ui-modal-description-size) leading-[1.25rem] text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
}
