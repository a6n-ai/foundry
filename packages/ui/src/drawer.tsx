"use client"

import * as React from "react"
import {
  Drawer as SdkDrawer,
  DrawerBackdrop,
  DrawerClose as SdkDrawerClose,
  DrawerContent as SdkDrawerContent,
  DrawerDescription as SdkDrawerDescription,
  DrawerTitle as SdkDrawerTitle,
  DrawerTrigger as SdkDrawerTrigger,
} from "@ui-sdk/react/drawer"

import { withAsChild, type AsChildProps } from "./as-child"
import { cn } from "./cn"

type DrawerSide = "top" | "bottom" | "left" | "right"

function Drawer({
  direction = "bottom",
  side,
  nested: _nested,
  handleOnly: _handleOnly,
  shouldScaleBackground: _shouldScaleBackground,
  ...props
}: React.ComponentProps<typeof SdkDrawer> & {
  /** Vaul's name for `side`. */
  direction?: DrawerSide
  /** @deprecated ui-sdk stacks a drawer opened inside another on its own. */
  nested?: boolean
  /** @deprecated ui-sdk drags a sheet from its grip and any non-scrolling area. */
  handleOnly?: boolean
  /** @deprecated Vaul scaled the page behind; ui-sdk dims it. */
  shouldScaleBackground?: boolean
}) {
  return <SdkDrawer side={side ?? direction} {...props} />
}

function DrawerTrigger(props: React.ComponentProps<typeof SdkDrawerTrigger> & AsChildProps) {
  return <SdkDrawerTrigger {...withAsChild(props)} />
}

function DrawerClose(props: React.ComponentProps<typeof SdkDrawerClose> & AsChildProps) {
  return <SdkDrawerClose {...withAsChild(props)} />
}

function DrawerOverlay({ className, ...props }: React.ComponentProps<typeof DrawerBackdrop>) {
  return <DrawerBackdrop className={cn("fixed inset-0 z-50 bg-black/50", className)} {...props} />
}

function DrawerContent({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof SdkDrawerContent>, "children"> & { children?: React.ReactNode }) {
  return (
    <>
      <DrawerOverlay />
      <SdkDrawerContent
        className={cn(
          "group/drawer-content z-50 flex h-auto flex-col bg-background",
          "data-[side=top]:max-h-[92dvh] data-[side=top]:rounded-b-lg data-[side=top]:border-b",
          "data-[side=bottom]:max-h-[92dvh] data-[side=bottom]:rounded-t-lg data-[side=bottom]:border-t",
          "data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=right]:sm:max-w-sm",
          "data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=left]:sm:max-w-sm",
          className
        )}
        {...props}
      >
        <div
          aria-hidden
          data-slot="drawer-grip"
          className="mx-auto mt-4 hidden h-2 w-[100px] shrink-0 rounded-full bg-muted group-data-[side=bottom]/drawer-content:block"
        />
        {children}
        <div
          aria-hidden
          data-slot="drawer-grip"
          className="mx-auto mb-3 hidden h-2 w-[100px] shrink-0 rounded-full bg-muted group-data-[side=top]/drawer-content:block"
        />
      </SdkDrawerContent>
    </>
  )
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn(
        "flex flex-col gap-0.5 p-4 group-data-[side=bottom]/drawer-content:text-center group-data-[side=top]/drawer-content:text-center md:gap-1.5 md:text-left",
        className
      )}
      {...props}
    />
  )
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="drawer-footer" className={cn("mt-auto flex flex-col gap-2 p-4", className)} {...props} />
}

function DrawerTitle({ className, ...props }: React.ComponentProps<typeof SdkDrawerTitle>) {
  return <SdkDrawerTitle className={cn("font-medium text-foreground", className)} {...props} />
}

function DrawerDescription({ className, ...props }: React.ComponentProps<typeof SdkDrawerDescription>) {
  return <SdkDrawerDescription className={cn("text-sm text-muted-foreground", className)} {...props} />
}

export {
  Drawer,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
}
