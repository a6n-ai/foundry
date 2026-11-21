"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Toggle as SdkToggle } from "@ui-sdk/react/toggle"

import { cn } from "./cn"

const toggleVariants = cva(
  "group/toggle inline-flex shrink-0 items-center justify-center gap-1.5 rounded-(--ui-radius-control) text-sm font-medium whitespace-nowrap transition-colors outline-none select-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-(length:--ui-focus-ring) focus-visible:ring-ring/50 data-disabled:pointer-events-none data-disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-pressed:bg-primary/6 data-pressed:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline:
          // The dark: base styles outrank a plain data-pressed rule, so the pressed look is repeated under dark: too.
          "border border-border bg-background text-muted-foreground data-pressed:border-primary/50 dark:border-input dark:bg-input/30 dark:data-pressed:border-primary/50 dark:data-pressed:bg-primary/8",
      },
      size: {
        default: "h-8 min-w-8 px-2.5",
        sm: "h-7 min-w-7 rounded-(--ui-radius-control-sm) px-2 text-footnote",
        lg: "h-9 min-w-9 px-3",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof SdkToggle> &
  VariantProps<typeof toggleVariants>) {
  return (
    <SdkToggle
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
