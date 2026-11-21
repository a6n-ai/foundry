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

// Sonner-style stack from the ui-sdk hooks. --dir is -1 for a bottom region (stack grows up), 1 for top.
// A popover region keeps the UA's overflow/background, hence the resets; its height tracks the stack so
// hovering the gaps between fanned-out toasts keeps it expanded.
const regionClass = [
  "group/region m-4 w-[min(356px,calc(100vw_-_2rem))] overflow-visible border-0 bg-transparent p-0 data-[align=center]:mx-0",
  "h-(--toast-front-height) data-expanded:h-[calc(var(--toast-stack-height)_+_(var(--toast-count)_-_1)_*_14px)]",
].join(" ")

const toastClass = [
  "flex flex-nowrap items-start gap-2.5 overflow-hidden rounded-(--ui-radius-popup) border-border bg-popover p-3.5 text-sm text-popover-foreground shadow-(--ui-shadow-popup) select-none",
  "absolute inset-x-0 bottom-0 group-data-[side=top]/region:top-0 group-data-[side=top]/region:bottom-auto",
  "origin-bottom group-data-[side=top]/region:origin-top [--dir:-1] group-data-[side=top]/region:[--dir:1]",
  "z-[calc(100_-_var(--toast-index))] h-(--toast-height) not-data-front:not-data-expanded:h-(--toast-front-height)",
  "[--y:calc(var(--toast-index)_*_var(--dir)_*_14px)] data-expanded:[--y:calc((var(--toast-offset)_+_var(--toast-index)_*_14px)_*_var(--dir))]",
  "[translate:var(--toast-swipe-x,0px)_calc(var(--y)_+_var(--toast-swipe-y,0px))] [scale:calc(1_-_var(--toast-index)_*_.05)] data-expanded:[scale:1]",
  "transition-[translate,scale,opacity,height] duration-400 ease-[cubic-bezier(0.21,1.02,0.73,1)] motion-reduce:transition-[opacity] data-swiping:transition-none",
  "data-starting-style:transition-none data-starting-style:data-front:[--y:calc(var(--dir)_*_-100%)] data-starting-style:opacity-0",
  "data-ending-style:opacity-0 data-ending-style:not-data-swiping:[--y:calc(var(--dir)_*_-100%)]",
].join(" ")

function Toaster({ position = "bottom-right", className }: { position?: Position; className?: string }) {
  return (
    <ToastRegion className={cn(regionClass, className)} {...places[position]}>
      {(item) => (
        <Toast className={toastClass}>
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
