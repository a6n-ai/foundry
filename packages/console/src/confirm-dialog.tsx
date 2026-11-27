import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@foundry/ui/alert-dialog"
import { Button } from "@foundry/ui/button"
import { Input } from "@foundry/ui/input"
import { Label } from "@foundry/ui/label"
import { type ReactNode, useRef, useState } from "react"
import { FormError } from "./form-error"

// Exact and case-sensitive: the name is the safeguard.
export const typedMatches = (typed: string | undefined, text: string) => typed === undefined || text === typed

export const confirmReady = (typed: string | undefined, text: string, confirmDisabled = false) => !confirmDisabled && typedMatches(typed, text)

// The reminder waits until the text is as long as the answer, so it does not nag from the first key.
export const typedHint = (typed: string, text: string) =>
  text.length >= typed.length && text !== typed ? "Type it exactly as shown, including capitals." : undefined

// Pass open and onOpenChange to drive it from outside (a router blocker); omit trigger then.
// onConfirm must return a promise that rejects on failure: the dialog stays open while it runs and shows the error message inline.
// typed: the exact text to type, case-sensitive; shown in mono.
// Cancel takes the initial focus, so Enter never confirms by accident. confirmLabel is Verb + noun ("Delete app").
// children sit under the description (a preview); confirmDisabled holds the confirm until they are satisfied.
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  dismissLabel = "Cancel",
  destructive = true,
  typed,
  onConfirm,
  open,
  onOpenChange,
  children,
  confirmDisabled = false,
}: {
  trigger?: string
  title: string
  description?: string
  confirmLabel: string
  dismissLabel?: string
  destructive?: boolean
  typed?: string
  onConfirm: () => Promise<void>
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: ReactNode
  confirmDisabled?: boolean
}) {
  const [innerOpen, setInnerOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [text, setText] = useState("")
  const cancelRef = useRef<HTMLButtonElement>(null)
  const isOpen = open ?? innerOpen
  const ready = confirmReady(typed, text, confirmDisabled)
  const hint = typed !== undefined ? typedHint(typed, text) : undefined

  function setOpen(next: boolean) {
    if (pending) return
    if (!next) {
      setError(null)
      setText("")
    }
    setInnerOpen(next)
    onOpenChange?.(next)
  }

  async function confirm() {
    if (!ready || pending) return
    setPending(true)
    setError(null)
    try {
      await onConfirm()
      setPending(false)
      setOpen(false)
    } catch (err) {
      setPending(false)
      setError(err instanceof Error && err.message ? err.message : "Something went wrong. Try again.")
    }
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setOpen}>
      {trigger !== undefined ? <AlertDialogTrigger render={<Button variant="outline" />}>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent initialFocus={() => cancelRef.current}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        {children}
        {typed !== undefined ? (
          <div className="grid gap-1.5">
            <Label htmlFor="confirm-typed">
              Type <code className="rounded-sm bg-muted px-1 font-mono text-xs text-foreground">{typed}</code> to confirm
            </Label>
            <Input
              id="confirm-typed"
              className="font-mono"
              value={text}
              aria-describedby={hint ? "confirm-typed-hint" : undefined}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  void confirm()
                }
              }}
              autoComplete="off"
              spellCheck={false}
            />
            {hint ? (
              <p id="confirm-typed-hint" className="text-xs text-muted-foreground">
                {hint}
              </p>
            ) : null}
          </div>
        ) : null}
        <FormError error={error} />
        <AlertDialogFooter>
          <AlertDialogClose render={<Button ref={cancelRef} variant="ghost" disabled={pending} />}>{dismissLabel}</AlertDialogClose>
          <Button variant={destructive ? "destructive" : "default"} disabled={!ready || pending} onClick={() => void confirm()}>
            {pending ? `${confirmLabel}…` : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
