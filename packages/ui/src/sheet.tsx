"use client"

import * as React from "react"
import {
  Drawer,
  DrawerBackdrop as SdkDrawerBackdrop,
  DrawerClose,
  DrawerContent as SdkDrawerContent,
  DrawerDescription as SdkDrawerDescription,
  DrawerTitle as SdkDrawerTitle,
  DrawerTrigger as SdkDrawerTrigger,
} from "@ui-sdk/react/drawer"
import { XIcon } from "lucide-react"

import { withAsChild, type AsChildProps } from "./as-child"
import { cn } from "./cn"
import { Button } from "./button"

function SheetTrigger(props: React.ComponentProps<typeof SdkDrawerTrigger> & AsChildProps) {
  return <SdkDrawerTrigger {...withAsChild(props)} />
}

function Sheet({ side = "right", ...props }: React.ComponentProps<typeof Drawer>) {
  return <Drawer side={side} {...props} />
}

function SheetBackdrop({ className, ...props }: React.ComponentProps<typeof SdkDrawerBackdrop>) {
  return (
    <SdkDrawerBackdrop
      className={cn("fixed inset-0 z-50 bg-(--ui-modal-backdrop) supports-backdrop-filter:backdrop-blur-(--ui-modal-blur)", className)}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: Omit<React.ComponentProps<typeof SdkDrawerContent>, "children"> & {
  children?: React.ReactNode
  showCloseButton?: boolean
}) {
  return (
    <>
      <SheetBackdrop />
      <SdkDrawerContent
        className={cn(
          "z-50 flex flex-col gap-4 bg-popover bg-clip-padding text-sm text-popover-foreground shadow-lg data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=bottom]:pb-[env(safe-area-inset-bottom)] data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=left]:pt-[env(safe-area-inset-top)] data-[side=left]:pb-[env(safe-area-inset-bottom)] data-[side=left]:sm:max-w-sm data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=right]:pt-[env(safe-area-inset-top)] data-[side=right]:pb-[env(safe-area-inset-bottom)] data-[side=right]:sm:max-w-sm data-[side=top]:h-auto data-[side=top]:border-b data-[side=top]:pt-[env(safe-area-inset-top)]",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DrawerClose render={<Button variant="ghost" className="absolute top-3 right-3" size="icon-sm" />}>
            <XIcon />
            <span className="sr-only">Close</span>
          </DrawerClose>
        )}
      </SdkDrawerContent>
    </>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-header" className={cn("flex flex-col gap-0.5 p-4", className)} {...props} />
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-footer" className={cn("mt-auto flex flex-col gap-2 p-4", className)} {...props} />
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SdkDrawerTitle>) {
  return <SdkDrawerTitle className={cn("font-heading text-base font-medium text-foreground", className)} {...props} />
}

function SheetDescription({ className, ...props }: React.ComponentProps<typeof SdkDrawerDescription>) {
  return <SdkDrawerDescription className={cn("text-sm text-muted-foreground", className)} {...props} />
}

export {
  Sheet,
  SheetTrigger,
  DrawerClose as SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
