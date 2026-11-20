"use client"

import * as React from "react"
import {
  AlertDialog,
  AlertDialogBackdrop as SdkAlertDialogBackdrop,
  AlertDialogClose,
  AlertDialogContent as SdkAlertDialogContent,
  AlertDialogDescription as SdkAlertDialogDescription,
  AlertDialogTitle as SdkAlertDialogTitle,
  AlertDialogTrigger,
} from "@ui-sdk/react/alert-dialog"

import { cn } from "./cn"

function AlertDialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SdkAlertDialogContent>) {
  return (
    <>
      <SdkAlertDialogBackdrop
        className="fixed inset-0 isolate z-50 bg-(--ui-modal-backdrop) transition-opacity duration-(--ui-modal-duration) ease-(--ui-modal-ease) supports-backdrop-filter:backdrop-blur-(--ui-modal-blur) motion-reduce:transition-none data-ending-style:opacity-0 data-starting-style:opacity-0"
      />
      <SdkAlertDialogContent
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-2rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-(--ui-radius-modal) bg-popover p-4 text-sm text-popover-foreground shadow-(--ui-shadow-modal) outline-none transition-[opacity,scale] duration-(--ui-modal-duration) ease-(--ui-modal-ease) sm:max-w-sm motion-reduce:transition-none data-ending-style:scale-(--ui-modal-scale) data-ending-style:opacity-0 data-starting-style:scale-(--ui-modal-scale) data-starting-style:opacity-0",
          className
        )}
        {...props}
      >
        {children}
      </SdkAlertDialogContent>
    </>
  )
}

function AlertDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-dialog-header" className={cn("flex flex-col gap-2", className)} {...props} />
}

function AlertDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-(--ui-radius-modal) border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogTitle({ className, ...props }: React.ComponentProps<typeof SdkAlertDialogTitle>) {
  return (
    <SdkAlertDialogTitle
      className={cn(
        "font-heading text-(length:--ui-modal-heading-size) leading-none font-(weight:--ui-modal-title-weight)",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogDescription({ className, ...props }: React.ComponentProps<typeof SdkAlertDialogDescription>) {
  return (
    <SdkAlertDialogDescription
      className={cn(
        "text-(length:--ui-modal-description-size) leading-[1.25rem] text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
}
