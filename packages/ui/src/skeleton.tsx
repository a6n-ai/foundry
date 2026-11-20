import { cn } from "./cn"

const radius = {
  rounded: "rounded-(--ui-radius-skeleton)",
  pill: "rounded-full",
  squared: "rounded-none",
} as const

type SkeletonProps = React.ComponentProps<"div"> & {
  shape?: keyof typeof radius
  animated?: boolean
}

function Skeleton({ className, shape = "rounded", animated = true, ...props }: SkeletonProps) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(radius[shape], animated && "animate-pulse skeleton-shimmer", "bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
