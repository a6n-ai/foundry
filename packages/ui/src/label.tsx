"use client"

import * as React from "react"
import { Label as SdkLabel } from "@ui-sdk/react/label"

import { withAsChild, type AsChildProps } from "./as-child"
import { cn } from "./cn"

function Label({
  className,
  ...props
}: React.ComponentProps<typeof SdkLabel> & AsChildProps) {
  return (
    <SdkLabel
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...withAsChild(props)}
    />
  )
}

export { Label }
