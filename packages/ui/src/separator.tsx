"use client"

import * as React from "react"
import { Separator as SdkSeparator } from "@ui-sdk/react/separator"

import { cn } from "./cn"

function Separator({
  className,
  decorative = true,
  ...props
}: React.ComponentProps<typeof SdkSeparator>) {
  return (
    <SdkSeparator
      decorative={decorative}
      className={cn(
        "shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px data-[orientation=vertical]:self-stretch",
        className
      )}
      {...props}
    />
  )
}

export { Separator }
