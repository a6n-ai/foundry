"use client"

import * as React from "react"
import {
  Popover,
  PopoverContent as SdkPopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger as SdkPopoverTrigger,
} from "@ui-sdk/react/popover"

import { withAsChild, type AsChildProps } from "./as-child"
import { cn } from "./cn"

function PopoverTrigger(props: React.ComponentProps<typeof SdkPopoverTrigger> & AsChildProps) {
  return <SdkPopoverTrigger {...withAsChild(props)} />
}

// Popups render in place and their clicks bubble, so a row or card around a popover would also get them.
function PopoverContent({
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof SdkPopoverContent>) {
  return (
    <SdkPopoverContent
      className={cn(
        "flex w-72 origin-(--transform-origin) flex-col gap-2.5 rounded-(--ui-radius-popup) bg-popover p-(--ui-popup-padding) text-sm text-popover-foreground shadow-(--ui-shadow-popup) outline-hidden transition-[opacity,scale] duration-150 ease-soft motion-reduce:transition-none data-ending-style:scale-[.96] data-ending-style:opacity-0 data-starting-style:scale-[.96] data-starting-style:opacity-0",
        className
      )}
      onClick={(event) => {
        onClick?.(event)
        event.stopPropagation()
      }}
      {...props}
    />
  )
}

export { Popover, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger }
