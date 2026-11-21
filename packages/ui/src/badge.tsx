import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { renderElement } from "@ui-sdk/react/primitive"

import { cn } from "./cn"

export const badgeTone = {
  neutral: "[--ui-badge-tone:var(--muted-foreground)]",
  info: "[--ui-badge-tone:var(--info)]",
  success: "[--ui-badge-tone:var(--success)]",
  warning: "[--ui-badge-tone:var(--warning)]",
  danger: "[--ui-badge-tone:var(--destructive)]",
  brand: "[--ui-badge-tone:var(--primary)]",
} as const

const subtle =
  "bg-[color-mix(in_oklch,var(--ui-badge-tone)_14%,transparent)] text-(color:--ui-badge-tone)"

const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-(--ui-radius-badge) border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-colors focus-visible:border-ring focus-visible:ring-(length:--ui-focus-ring) focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: `bg-primary text-primary-foreground [a]:hover:bg-primary/80 ${badgeTone.brand}`,
        secondary: `bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80 ${badgeTone.neutral}`,
        destructive: `bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20 ${badgeTone.danger}`,
        outline: `border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground ${badgeTone.neutral}`,
        ghost: `hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50 ${badgeTone.neutral}`,
        link: "text-primary underline-offset-4 hover:underline",
        neutral: `${badgeTone.neutral} ${subtle}`,
        info: `${badgeTone.info} ${subtle}`,
        success: `${badgeTone.success} ${subtle}`,
        warning: `${badgeTone.warning} ${subtle}`,
        danger: `${badgeTone.danger} ${subtle}`,
        brand: `${badgeTone.brand} ${subtle}`,
      },
      size: {
        default: "h-5",
        sm: "h-4.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  size = "default",
  render,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { render?: React.ReactElement }) {
  return renderElement(
    "span",
    {
      "data-slot": "badge",
      "data-variant": variant,
      className: cn(badgeVariants({ variant, size }), className),
      ...props,
    },
    render
  )
}

export { Badge, badgeVariants }
