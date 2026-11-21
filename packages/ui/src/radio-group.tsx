"use client"

import * as React from "react"
import { Radio, RadioGroup as SdkRadioGroup, RadioIndicator, type RadioGroupOptions } from "@ui-sdk/react/radio"

import { withAsChild, type AsChildProps } from "./as-child"
import { cn } from "./cn"

type GroupDetails = Parameters<NonNullable<RadioGroupOptions["onValueChange"]>>[1]

// Callers were written for Radix: a change always carries a string.
function RadioGroup({
  className,
  onValueChange,
  ...props
}: Omit<React.ComponentProps<typeof SdkRadioGroup>, "onValueChange"> & {
  onValueChange?: (value: string, details: GroupDetails) => void
}) {
  return (
    <SdkRadioGroup
      className={cn("grid w-full gap-2", className)}
      onValueChange={onValueChange && ((next, details) => onValueChange(next ?? "", details))}
      {...props}
    />
  )
}

function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof Radio> & AsChildProps) {
  return (
    <Radio
      className={cn(
        "group/radio-group-item peer relative flex aspect-square size-4 shrink-0 rounded-full border border-input outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-(length:--ui-focus-ring) focus-visible:ring-ring/50 data-disabled:cursor-not-allowed data-disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 aria-invalid:data-checked:border-primary dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground dark:data-checked:bg-primary",
        className
      )}
      {...withAsChild(props)}
    >
      <RadioIndicator className="flex size-4 items-center justify-center">
        <span className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-foreground" />
      </RadioIndicator>
    </Radio>
  )
}

export { RadioGroup, RadioGroupItem }
