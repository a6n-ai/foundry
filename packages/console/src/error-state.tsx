import { Button } from "@foundry/ui/button"
import { AlertCircleIcon, LockIcon } from "lucide-react"
import { EmptyState } from "./empty-state"

const DEFAULT_MESSAGE = "Something went wrong. Try again."

export function ErrorState({ error, onRetry, errorText }: { error: unknown; onRetry?: () => void; errorText?: (err: unknown) => string }) {
  return (
    <EmptyState
      icon={AlertCircleIcon}
      title={errorText ? errorText(error) : DEFAULT_MESSAGE}
      action={onRetry ? <Button variant="outline" onClick={onRetry}>Retry</Button> : undefined}
    />
  )
}

export function DeniedState({ title = "No access", description = "Ask an admin to give you access to this page." }: { title?: string; description?: string }) {
  return <EmptyState icon={LockIcon} title={title} description={description} />
}
