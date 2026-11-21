"use client"

import * as React from "react"
import {
  OTPInput,
  OTPInputGroup,
  OTPInputSeparator,
  OTPInputSlot,
  type OTPInputPattern,
} from "@ui-sdk/react/otp-input"

import { cn } from "./cn"
import { MinusIcon } from "lucide-react"

const KEYWORDS = new Set(["digits", "letters", "alphanumeric"])

// input-otp took a regex source for the whole code ("^\\d+$"); ui-sdk tests one character at a time.
function toPattern(pattern: OTPInputPattern | string | undefined) {
  return typeof pattern === "string" && !KEYWORDS.has(pattern) ? new RegExp(pattern) : (pattern as OTPInputPattern | undefined)
}

function InputOTP({
  className,
  containerClassName,
  onChange,
  onComplete,
  pattern,
  ...props
}: Omit<React.ComponentProps<typeof OTPInput>, "pattern" | "onValueChange" | "onValueCommit"> & {
  containerClassName?: string
  onChange?: (value: string) => void
  onComplete?: (value: string) => void
  pattern?: OTPInputPattern | string
}) {
  const unnamed = !props["aria-label"] && !props["aria-labelledby"] && !props.id
  return (
    <OTPInput
      aria-label={unnamed ? "Verification code" : undefined}
      pattern={toPattern(pattern)}
      onValueChange={onChange && ((value) => onChange(value))}
      onValueCommit={onComplete && ((value) => onComplete(value))}
      className={cn("cn-input-otp group/input-otp flex items-center data-disabled:opacity-50", containerClassName, className)}
      {...props}
    />
  )
}

function InputOTPGroup({ className, ...props }: React.ComponentProps<typeof OTPInputGroup>) {
  return <OTPInputGroup className={cn("flex items-center rounded-lg", className)} {...props} />
}

function InputOTPSlot({
  index,
  className,
  masked,
  ...props
}: Omit<React.ComponentProps<typeof OTPInputSlot>, "children"> & {
  masked?: boolean
}) {
  return (
    <OTPInputSlot
      index={index}
      className={cn(
        "relative flex size-8 items-center justify-center border-y border-r border-input text-sm transition-colors outline-none first:rounded-l-lg first:border-l last:rounded-r-lg group-has-aria-invalid/input-otp:border-destructive data-active:z-10 data-active:border-ring data-active:ring-3 data-active:ring-ring/50 group-has-aria-invalid/input-otp:data-active:ring-destructive/20 dark:bg-input/30 dark:group-has-aria-invalid/input-otp:data-active:ring-destructive/40",
        className
      )}
      {...props}
    >
      {(state) => (
        <>
          {state.char ? (masked ? "•" : state.char) : null}
          {state.hasFakeCaret && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-4 w-px animate-caret-blink bg-foreground duration-1000" />
            </div>
          )}
        </>
      )}
    </OTPInputSlot>
  )
}

function InputOTPSeparator({ className, ...props }: React.ComponentProps<typeof OTPInputSeparator>) {
  return (
    <OTPInputSeparator className={cn("flex items-center [&_svg:not([class*='size-'])]:size-4", className)} {...props}>
      <MinusIcon />
    </OTPInputSeparator>
  )
}

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator }
