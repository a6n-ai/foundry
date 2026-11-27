import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

// One shape everywhere: an icon, a title, a line and, when there is something to do, the action.
export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 px-4 py-20 text-center">
      <Icon className="size-8 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
      <div className="space-y-1.5">
        <p className="text-base font-medium">{title}</p>
        {description ? <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}
