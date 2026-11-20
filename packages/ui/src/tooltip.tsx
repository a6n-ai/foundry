"use client"

import * as React from "react"
import {
  Tooltip as SdkTooltip,
  TooltipContent as SdkTooltipContent,
  TooltipTrigger,
} from "@ui-sdk/react/tooltip"

import { cn } from "./cn"

function Tooltip({
  delay = 300,
  ...props
}: React.ComponentProps<typeof SdkTooltip>) {
  return <SdkTooltip delay={delay} {...props} />
}

function TooltipContent({
  className,
  ...props
}: React.ComponentProps<typeof SdkTooltipContent>) {
  return (
    <SdkTooltipContent
      className={cn(
        "inline-flex w-fit max-w-xs origin-(--transform-origin) items-center gap-1.5 rounded-(--ui-radius-control) bg-foreground px-2 py-1 text-xs text-background transition-[opacity,scale] duration-150 ease-soft motion-reduce:transition-none data-ending-style:scale-[.96] data-ending-style:opacity-0 data-instant:transition-none data-starting-style:scale-[.96] data-starting-style:opacity-0",
        className
      )}
      {...props}
    />
  )
}

export { Tooltip, TooltipContent, TooltipTrigger }
