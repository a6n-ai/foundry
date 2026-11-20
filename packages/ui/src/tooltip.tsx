"use client"

import * as React from "react"
import {
  Tooltip as SdkTooltip,
  TooltipArrow as SdkTooltipArrow,
  TooltipContent as SdkTooltipContent,
  TooltipTrigger as SdkTooltipTrigger,
} from "@ui-sdk/react/tooltip"

import { withAsChild, type AsChildProps } from "./as-child"
import { cn } from "./cn"

/** @deprecated ui-sdk tooltips need no provider. */
function TooltipProvider({
  children,
}: {
  children?: React.ReactNode
  delayDuration?: number
  skipDelayDuration?: number
  disableHoverableContent?: boolean
}) {
  return <>{children}</>
}

function TooltipTrigger(props: React.ComponentProps<typeof SdkTooltipTrigger> & AsChildProps) {
  return <SdkTooltipTrigger {...withAsChild(props)} />
}

function Tooltip({
  delay = 150,
  ...props
}: React.ComponentProps<typeof SdkTooltip>) {
  return <SdkTooltip delay={delay} {...props} />
}

function TooltipContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SdkTooltipContent>) {
  return (
    <SdkTooltipContent
      className={cn(
        "inline-flex w-fit max-w-xs origin-(--transform-origin) items-center gap-1.5 rounded-(--ui-tooltip-radius) bg-foreground p-(--ui-tooltip-padding) text-xs text-background transition-[opacity,scale] duration-150 ease-soft motion-reduce:transition-none data-ending-style:scale-[.96] data-ending-style:opacity-0 data-instant:transition-none data-starting-style:scale-[.96] data-starting-style:opacity-0",
        className
      )}
      {...props}
    >
      {(state) => (
        <>
          <SdkTooltipArrow className="absolute size-2.5 rotate-45 rounded-[2px] bg-foreground data-[side=bottom]:-top-[5px] data-[side=left]:-right-[5px] data-[side=right]:-left-[5px] data-[side=top]:-bottom-[5px]" />
          {typeof children === "function" ? children(state) : children}
        </>
      )}
    </SdkTooltipContent>
  )
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger }
