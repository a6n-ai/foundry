"use client"

import * as React from "react"
import {
  Toast,
  ToastAction,
  ToastDescription,
  ToastRegion,
  ToastTitle,
  toast as sdkToast,
  type ToastActionData,
  type ToastOptions,
} from "@ui-sdk/react/toast"
import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from "lucide-react"

import { buttonVariants } from "./button"
import { cn } from "./cn"

type Content = React.ReactNode
type SdkOptions = ToastOptions<Content>

/** @deprecated sonner call shape (`action.onClick`), kept for callers; new code uses `@ui-sdk/react/toast` (`action.onAction`). */
type Options = Omit<SdkOptions, "action"> & {
  action?: { label: Content; onClick?: (event: Event | undefined) => void } | ToastActionData<Content>
}

const toSdk = ({ action, ...options }: Options = {}): SdkOptions => {
  if (!action) return options
  const { onClick, ...rest } = action as { onClick?: (event: Event | undefined) => void } & ToastActionData<Content>
  return { ...options, action: onClick ? { ...rest, onAction: (event) => onClick(event) } : rest }
}

type Show = (message: Content, options?: Options) => string
const wrap = (show: (message: Content, options?: SdkOptions) => string): Show => (message, options) => show(message, toSdk(options))

const toast = Object.assign(wrap(sdkToast), {
  message: wrap(sdkToast),
  success: wrap(sdkToast.success),
  error: wrap(sdkToast.error),
  info: wrap(sdkToast.info),
  warning: wrap(sdkToast.warning),
  loading: wrap(sdkToast.loading),
  promise: sdkToast.promise,
  dismiss: sdkToast.dismiss,
})

const icons: Record<string, React.ReactNode> = {
  success: <CircleCheckIcon className="size-4" aria-hidden="true" />,
  info: <InfoIcon className="size-4" aria-hidden="true" />,
  warning: <TriangleAlertIcon className="size-4" aria-hidden="true" />,
  error: <OctagonXIcon className="size-4" aria-hidden="true" />,
  loading: <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />,
}

type Position = "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right"

const places: Record<Position, { side: "top" | "bottom"; align: "start" | "center" | "end" }> = {
  "top-left": { side: "top", align: "start" },
  "top-center": { side: "top", align: "center" },
  "top-right": { side: "top", align: "end" },
  "bottom-left": { side: "bottom", align: "start" },
  "bottom-center": { side: "bottom", align: "center" },
  "bottom-right": { side: "bottom", align: "end" },
}

function Toaster({ position = "bottom-right", className }: { position?: Position; className?: string }) {
  return (
    <ToastRegion className={cn("w-[356px]", className)} {...places[position]}>
      {(item) => (
        <Toast className="flex-nowrap items-start gap-2.5 rounded-(--ui-radius-popup) border-border bg-popover p-3.5 text-sm text-popover-foreground shadow-(--ui-shadow-popup) transition-[opacity,scale] duration-150 ease-soft motion-reduce:transition-none data-ending-style:scale-[.96] data-ending-style:opacity-0 data-starting-style:scale-[.96] data-starting-style:opacity-0">
          {icons[item.type]}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <ToastTitle className="flex-none font-medium" />
            <ToastDescription className="order-none flex-none text-muted-foreground" />
          </div>
          <ToastAction className={buttonVariants({ variant: "outline", size: "sm" })} />
        </Toast>
      )}
    </ToastRegion>
  )
}

export { Toaster, toast }
