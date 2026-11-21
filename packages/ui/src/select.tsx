"use client"

import * as React from "react"
import {
  Select as SdkSelect,
  SelectContent as SdkSelectContent,
  SelectGroup as SdkSelectGroup,
  SelectGroupLabel as SdkSelectGroupLabel,
  SelectItem as SdkSelectItem,
  SelectItemIndicator,
  SelectLabel,
  SelectSeparator as SdkSelectSeparator,
  SelectTrigger as SdkSelectTrigger,
  SelectValue,
  type SelectProps,
} from "@ui-sdk/react/select"
import { CheckIcon, ChevronDownIcon } from "lucide-react"

import { cn } from "./cn"

type SingleSelectDetails = Parameters<NonNullable<SelectProps["onValueChange"]>>[1]

// Callers expect: "" shows the placeholder, and a change always carries a string.
function Select({
  value,
  defaultValue,
  onValueChange,
  ...props
}: Omit<SelectProps, "value" | "defaultValue" | "onValueChange"> & {
  value?: string | null
  defaultValue?: string | null
  onValueChange?: (value: string, details: SingleSelectDetails) => void
}) {
  const sdkProps = {
    ...props,
    value: value === "" ? null : value,
    defaultValue: defaultValue === "" ? null : defaultValue,
    onValueChange: onValueChange && ((next: string | null, details: SingleSelectDetails) => onValueChange(next ?? "", details)),
  } as SelectProps
  return <SdkSelect {...sdkProps} />
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: Omit<React.ComponentProps<typeof SdkSelectTrigger>, "children"> & {
  children?: React.ReactNode
  size?: "sm" | "default"
}) {
  return (
    <SdkSelectTrigger
      data-size={size}
      className={cn(
        "flex w-fit items-center justify-between gap-1.5 rounded-(--ui-radius-control) border border-input bg-transparent py-2 pr-2 pl-2.5 text-base md:text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-(length:--ui-focus-ring) focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-(length:--ui-focus-ring) aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-(--ui-radius-control-sm) *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground" />
    </SdkSelectTrigger>
  )
}

// Popups render in place and their clicks bubble, so a row or card around a select would also get them.
// The closed list stays mounted so the trigger can show the label of a value set before the first open, as before.
// A click inside a label is forwarded to the label's control, which is the trigger: cancel it so the list stays closed.
function SelectGroup({ className, ...props }: React.ComponentProps<typeof SdkSelectGroup>) {
  return <SdkSelectGroup className={cn("scroll-my-1 p-1", className)} {...props} />
}

function SelectContent({
  className,
  onClick,
  alignItemWithTrigger = true,
  keepMounted = true,
  ...props
}: React.ComponentProps<typeof SdkSelectContent>) {
  return (
    <SdkSelectContent
      alignItemWithTrigger={alignItemWithTrigger}
      keepMounted={keepMounted}
      className={cn(
        "max-h-(--available-height) min-w-[max(9rem,var(--anchor-width))] origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-(--ui-radius-popup) bg-popover p-(--ui-select-padding) text-popover-foreground shadow-(--ui-shadow-popup) outline-hidden transition-[opacity,scale] duration-150 ease-soft motion-reduce:transition-none data-ending-style:scale-[.96] data-ending-style:opacity-0 data-starting-style:scale-[.96] data-starting-style:opacity-0",
        className
      )}
      onClick={(event) => {
        onClick?.(event)
        event.preventDefault()
        event.stopPropagation()
      }}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof SdkSelectItem>, "children"> & {
  children?: React.ReactNode
}) {
  return (
    <SdkSelectItem
      className={cn(
        "relative flex h-(--ui-select-item-height) w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-(length:--ui-select-item-size) leading-5 outline-hidden select-none data-highlighted:bg-(--ui-select-highlight) data-highlighted:text-(color:--ui-select-highlight-fg) data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <SelectItemIndicator className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
        <CheckIcon className="pointer-events-none" />
      </SelectItemIndicator>
    </SdkSelectItem>
  )
}

function SelectGroupLabel({
  className,
  ...props
}: React.ComponentProps<typeof SdkSelectGroupLabel>) {
  return (
    <SdkSelectGroupLabel
      className={cn("px-1.5 py-1 text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SdkSelectSeparator>) {
  return (
    <SdkSelectSeparator
      className={cn("pointer-events-none -mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
