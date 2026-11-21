"use client"

import * as React from "react"
import { Checkbox as SdkCheckbox, CheckboxIndicator } from "@ui-sdk/react/checkbox"
import { CheckIcon } from "lucide-react"

import { cn } from "./cn"

function Checkbox({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SdkCheckbox>) {
  return (
    <SdkCheckbox
      className={cn(
        "peer size-4 shrink-0 rounded-[4px] border border-input outline-none focus-visible:border-ring focus-visible:ring-(length:--ui-focus-ring) focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground data-indeterminate:border-primary data-indeterminate:bg-primary data-indeterminate:text-primary-foreground data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children ?? (
        <CheckboxIndicator className="grid place-content-center text-current">
          <CheckIcon className="size-3.5" />
        </CheckboxIndicator>
      )}
    </SdkCheckbox>
  )
}

export { Checkbox }
