"use client"

import * as React from "react"
import {
  Menu,
  MenuCheckboxItem as SdkMenuCheckboxItem,
  MenuContent as SdkMenuContent,
  MenuGroup,
  MenuGroupLabel as SdkMenuGroupLabel,
  MenuItem as SdkMenuItem,
  MenuItemIndicator,
  MenuRadioGroup,
  MenuRadioItem as SdkMenuRadioItem,
  MenuSeparator as SdkMenuSeparator,
  MenuShortcut as SdkMenuShortcut,
  MenuSub,
  MenuSubContent as SdkMenuSubContent,
  MenuSubTrigger as SdkMenuSubTrigger,
  MenuTrigger,
} from "@ui-sdk/react/menu"
import { CheckIcon, ChevronRightIcon } from "lucide-react"

import { cn } from "./cn"

// Popups render in place and their clicks bubble, so a row or card around a menu would also get them.
function MenuContent({ className, onClick, ...props }: React.ComponentProps<typeof SdkMenuContent>) {
  return (
    <SdkMenuContent
      className={cn(
        "w-(--anchor-width) min-w-32 max-h-(--available-height) origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-(--ui-radius-popup) bg-popover p-(--ui-menu-padding) text-popover-foreground shadow-(--ui-shadow-popup) outline-hidden transition-[opacity,scale] duration-150 ease-soft motion-reduce:transition-none data-ending-style:scale-[.96] data-ending-style:opacity-0 data-starting-style:scale-[.96] data-starting-style:opacity-0",
        className
      )}
      onClick={(event) => {
        onClick?.(event)
        event.stopPropagation()
      }}
      {...props}
    />
  )
}

function MenuSubContent({ className, onClick, ...props }: React.ComponentProps<typeof SdkMenuSubContent>) {
  return (
    <SdkMenuSubContent
      className={cn(
        "w-max min-w-[96px] origin-(--transform-origin) overflow-hidden rounded-(--ui-radius-popup) bg-popover p-(--ui-menu-padding) text-popover-foreground shadow-(--ui-shadow-popup) outline-hidden transition-[opacity,scale] duration-150 ease-soft motion-reduce:transition-none data-ending-style:scale-[.96] data-ending-style:opacity-0 data-starting-style:scale-[.96] data-starting-style:opacity-0",
        className
      )}
      onClick={(event) => {
        onClick?.(event)
        event.stopPropagation()
      }}
      {...props}
    />
  )
}

const itemClass =
  "relative flex h-(--ui-select-item-height) cursor-default items-center gap-1.5 rounded-(--ui-menu-item-radius) px-1.5 py-1 text-(length:--ui-select-item-size) leading-5 outline-hidden select-none group/menu-item data-highlighted:bg-(--ui-select-highlight) data-highlighted:text-(color:--ui-select-highlight-fg) data-destructive:text-destructive data-destructive:data-highlighted:bg-destructive/10 data-destructive:data-highlighted:text-destructive dark:data-destructive:data-highlighted:bg-destructive/20 data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"

function MenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: React.ComponentProps<typeof SdkMenuItem> & {
  inset?: boolean
  variant?: "default" | "destructive"
}) {
  return (
    <SdkMenuItem
      data-inset={inset}
      destructive={variant === "destructive"}
      className={cn(itemClass, className)}
      {...props}
    />
  )
}

function MenuCheckboxItem({
  className,
  children,
  inset,
  ...props
}: Omit<React.ComponentProps<typeof SdkMenuCheckboxItem>, "children"> & {
  children?: React.ReactNode
  inset?: boolean
}) {
  return (
    <SdkMenuCheckboxItem
      data-inset={inset}
      className={cn(itemClass, "pr-8", className)}
      {...props}
    >
      {children}
      <MenuItemIndicator className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
        <CheckIcon className="pointer-events-none" />
      </MenuItemIndicator>
    </SdkMenuCheckboxItem>
  )
}

function MenuRadioItem({
  className,
  children,
  inset,
  ...props
}: Omit<React.ComponentProps<typeof SdkMenuRadioItem>, "children"> & {
  children?: React.ReactNode
  inset?: boolean
}) {
  return (
    <SdkMenuRadioItem
      data-inset={inset}
      className={cn(itemClass, "pr-8", className)}
      {...props}
    >
      {children}
      <MenuItemIndicator className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
        <CheckIcon className="pointer-events-none" />
      </MenuItemIndicator>
    </SdkMenuRadioItem>
  )
}

function MenuGroupLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof SdkMenuGroupLabel> & {
  inset?: boolean
}) {
  return (
    <SdkMenuGroupLabel
      data-inset={inset}
      className={cn("px-1.5 py-1 text-xs font-medium text-muted-foreground data-inset:pl-7", className)}
      {...props}
    />
  )
}

function MenuSeparator({ className, ...props }: React.ComponentProps<typeof SdkMenuSeparator>) {
  return <SdkMenuSeparator className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />
}

function MenuShortcut({ className, ...props }: React.ComponentProps<typeof SdkMenuShortcut>) {
  return (
    <SdkMenuShortcut
      className={cn(
        "ml-auto font-(family-name:--ui-menu-shortcut-font) text-xs tracking-widest text-muted-foreground group-data-highlighted/menu-item:text-(color:--ui-select-highlight-fg)",
        className
      )}
      {...props}
    />
  )
}

function MenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: Omit<React.ComponentProps<typeof SdkMenuSubTrigger>, "children"> & {
  children?: React.ReactNode
  inset?: boolean
}) {
  return (
    <SdkMenuSubTrigger
      data-inset={inset}
      className={cn(itemClass, "data-open:bg-(--ui-select-highlight) data-open:text-(color:--ui-select-highlight-fg)", className)}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto" />
    </SdkMenuSubTrigger>
  )
}

const DropdownMenu = Menu
const DropdownMenuTrigger = MenuTrigger
const DropdownMenuContent = MenuContent
const DropdownMenuGroup = MenuGroup
const DropdownMenuLabel = MenuGroupLabel
const DropdownMenuItem = MenuItem
const DropdownMenuCheckboxItem = MenuCheckboxItem
const DropdownMenuRadioGroup = MenuRadioGroup
const DropdownMenuRadioItem = MenuRadioItem
const DropdownMenuSeparator = MenuSeparator
const DropdownMenuShortcut = MenuShortcut
const DropdownMenuSub = MenuSub
const DropdownMenuSubTrigger = MenuSubTrigger
const DropdownMenuSubContent = MenuSubContent

export {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuItemIndicator,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuShortcut,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
}
