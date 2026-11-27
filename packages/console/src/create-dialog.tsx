"use client"

import { Button } from "@foundry/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@foundry/ui/dialog"
import { type ReactNode, useState } from "react"

// lock(true) while a one-time secret is showing: Esc and outside click are ignored, so only Done closes it.
export function CreateDialog({
  trigger,
  title,
  open: controlledOpen,
  onOpenChange,
  children,
}: {
  trigger?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  title: string
  children: (done: () => void, lock: (locked: boolean) => void) => ReactNode
}) {
  const [innerOpen, setInnerOpen] = useState(false)
  const open = controlledOpen ?? innerOpen
  const setOpen = (next: boolean) => {
    setInnerOpen(next)
    onOpenChange?.(next)
  }
  const [locked, setLocked] = useState(false)
  const done = () => {
    setLocked(false)
    setOpen(false)
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next || !locked) setOpen(next)
      }}
    >
      {trigger ? <DialogTrigger render={<Button />}>{trigger}</DialogTrigger> : null}
      <DialogContent showCloseButton={!locked}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children(done, setLocked)}
      </DialogContent>
    </Dialog>
  )
}
