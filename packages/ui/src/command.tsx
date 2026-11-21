"use client"

import * as React from "react"
import {
  Command as SdkCommand,
  CommandEmpty as SdkCommandEmpty,
  CommandGroup as SdkCommandGroup,
  CommandGroupLabel,
  CommandInput as SdkCommandInput,
  CommandItem as SdkCommandItem,
  CommandList as SdkCommandList,
  CommandSeparator as SdkCommandSeparator,
  type CommandProps as SdkCommandProps,
} from "@ui-sdk/react/command"

import { cn } from "./cn"
import { useIsomorphicLayoutEffect } from "./use-isomorphic-layout-effect"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./dialog"
import {
  InputGroup,
  InputGroupAddon,
} from "./input-group"
import { SearchIcon, CheckIcon } from "lucide-react"

type ValueChangeDetails = Parameters<NonNullable<SdkCommandProps["onValueChange"]>>[1]

type InputBridge = {
  query: string
  setQuery: (query: string) => void
  onInputChange: React.RefObject<((value: string) => void) | undefined>
}

const InputBridgeContext = React.createContext<InputBridge | null>(null)

// Callers were written for cmdk: `shouldFilter={false}` turns filtering off, "" highlights nothing,
// highlight changes carry a string, and the input's `value`/`onValueChange` own the search text.
// The root keeps the query itself so a CommandInput that is only given `value` can still drive it.
function Command({
  className,
  shouldFilter = true,
  filter,
  value,
  defaultValue,
  onValueChange,
  query: controlledQuery,
  defaultQuery = "",
  onQueryChange,
  ...props
}: Omit<SdkCommandProps, "value" | "defaultValue" | "onValueChange"> & {
  shouldFilter?: boolean
  value?: string | null
  defaultValue?: string | null
  onValueChange?: (value: string, details: ValueChangeDetails) => void
}) {
  const [ownQuery, setOwnQuery] = React.useState(defaultQuery)
  const onInputChange = React.useRef<((value: string) => void) | undefined>(undefined)
  const query = controlledQuery ?? ownQuery
  const bridge = React.useMemo(
    () => ({ query, setQuery: setOwnQuery, onInputChange }),
    [query]
  )
  return (
    <InputBridgeContext value={bridge}>
      <SdkCommand
        data-slot="command"
        className={cn(
          "flex size-full flex-col overflow-hidden rounded-xl! bg-popover p-1 text-popover-foreground",
          className
        )}
        {...(shouldFilter ? filter !== undefined && { filter } : { filter: false as const })}
        {...(value !== undefined && { value: value === "" ? null : value })}
        {...(defaultValue !== undefined && { defaultValue: defaultValue === "" ? null : defaultValue })}
        onValueChange={onValueChange && ((next, details) => onValueChange(next ?? "", details))}
        query={query}
        onQueryChange={(next, details) => {
          setOwnQuery(next)
          onInputChange.current?.(next)
          onQueryChange?.(next, details)
        }}
        {...props}
      />
    </InputBridgeContext>
  )
}

function CommandDialog({
  title = "Command Palette",
  description = "Search for a command to run...",
  children,
  className,
  showCloseButton = false,
  ...props
}: React.ComponentProps<typeof Dialog> & {
  title?: string
  description?: string
  className?: string
  showCloseButton?: boolean
}) {
  return (
    <Dialog {...props}>
      <DialogContent
        className={cn(
          "top-1/3 translate-y-0 overflow-hidden rounded-(--ui-radius-modal)! p-0",
          className
        )}
        showCloseButton={showCloseButton}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}

function CommandInput({
  className,
  value,
  onValueChange,
  ...props
}: Omit<React.ComponentProps<typeof SdkCommandInput>, "value" | "onChange"> & {
  value?: string
  onValueChange?: (value: string) => void
}) {
  const bridge = React.useContext(InputBridgeContext)
  useIsomorphicLayoutEffect(() => {
    if (!bridge) return
    bridge.onInputChange.current = onValueChange
    if (value !== undefined && value !== bridge.query) bridge.setQuery(value)
  })
  return (
    <div data-slot="command-input-wrapper" className="p-1 pb-0">
      <InputGroup className="h-8! rounded-lg! border-input/30 bg-input/30 shadow-none! *:data-[slot=input-group-addon]:pl-2!">
        <SdkCommandInput
          // Chrome autofill injects autofill-prediction/-information attrs on the
          // input before hydration; suppress the resulting benign attr mismatch.
          suppressHydrationWarning
          aria-label={props["aria-label"] ?? props.placeholder ?? "Search"}
          className={cn(
            "w-full text-base md:text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          {...props}
        />
        <InputGroupAddon>
          <SearchIcon className="size-4 shrink-0 opacity-50" />
        </InputGroupAddon>
      </InputGroup>
    </div>
  )
}

function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof SdkCommandList>) {
  return (
    <SdkCommandList
      className={cn(
        "no-scrollbar max-h-72 scroll-py-1 overflow-x-hidden overflow-y-auto outline-none",
        className
      )}
      {...props}
    />
  )
}

function CommandEmpty({
  className,
  ...props
}: React.ComponentProps<typeof SdkCommandEmpty>) {
  return (
    <SdkCommandEmpty
      className={cn("py-6 text-center text-sm", className)}
      {...props}
    />
  )
}

function CommandGroup({
  className,
  heading,
  children,
  ...props
}: Omit<React.ComponentProps<typeof SdkCommandGroup>, "heading" | "children"> & {
  heading?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <SdkCommandGroup
      className={cn(
        "overflow-hidden p-1 text-foreground **:data-[slot=command-group-label]:px-2 **:data-[slot=command-group-label]:py-1.5 **:data-[slot=command-group-label]:text-xs **:data-[slot=command-group-label]:font-medium **:data-[slot=command-group-label]:text-muted-foreground",
        className
      )}
      {...props}
    >
      {heading != null && <CommandGroupLabel>{heading}</CommandGroupLabel>}
      {children}
    </SdkCommandGroup>
  )
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SdkCommandSeparator>) {
  return (
    <SdkCommandSeparator
      className={cn("-mx-1 h-px bg-border", className)}
      {...props}
    />
  )
}

// cmdk matched on `value`, not on the text; the label keeps that for rows whose text differs.
// Without a value, cmdk used the text, and `onSelect` got it.
function CommandItem({
  className,
  children,
  value,
  label,
  onSelect,
  ...props
}: Omit<React.ComponentProps<typeof SdkCommandItem>, "onSelect" | "children"> & {
  children?: React.ReactNode
  onSelect?: (value: string) => void
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  return (
    <SdkCommandItem
      ref={ref}
      value={value}
      label={label ?? value}
      onSelect={
        onSelect &&
        (() => {
          onSelect(value ?? ref.current?.textContent?.trim() ?? "")
        })
      }
      className={cn(
        "group/command-item relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none in-data-[slot=dialog-content]:rounded-lg! data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-muted data-highlighted:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-highlighted:*:[svg]:text-foreground",
        className
      )}
      {...props}
    >
      {children}
      <CheckIcon className="ml-auto opacity-0 group-has-data-[slot=command-shortcut]/command-item:hidden group-data-[checked=true]/command-item:opacity-100" />
    </SdkCommandItem>
  )
}

function CommandShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground group-data-highlighted/command-item:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
}
