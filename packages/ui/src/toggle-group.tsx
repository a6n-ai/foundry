"use client"

import * as React from "react"
import { type VariantProps } from "class-variance-authority"
import { Toggle as SdkToggle, ToggleGroup as SdkToggleGroup, type ToggleGroupOptions } from "@ui-sdk/react/toggle"

import { cn } from "./cn"
import { toggleVariants } from "./toggle"

const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants> & { spacing?: number }
>({ size: "default", variant: "default", spacing: 0 })

type SdkGroupProps = React.ComponentProps<typeof SdkToggleGroup>
type GroupDetails = Parameters<NonNullable<ToggleGroupOptions["onValueChange"]>>[1]

type ValueProps =
  | {
      type: "single"
      value?: string
      defaultValue?: string
      onValueChange?: (value: string, details: GroupDetails) => void
      multiple?: never
    }
  | {
      type: "multiple"
      value?: string[]
      defaultValue?: string[]
      onValueChange?: (value: string[], details: GroupDetails) => void
      multiple?: never
    }
  | {
      type?: undefined
      value?: string[]
      defaultValue?: string[]
      onValueChange?: (value: string[], details: GroupDetails) => void
      multiple?: boolean
    }

// Callers expect: `type` picks single or multiple, a single group's value is one string
// ("" for none), and pressing the active item clears it. Without `type` the props are ui-sdk's own.
function ToggleGroup({
  className,
  variant,
  size,
  spacing = 0,
  children,
  type,
  value,
  defaultValue,
  onValueChange,
  ...props
}: Omit<SdkGroupProps, "children" | "value" | "defaultValue" | "onValueChange" | "multiple"> &
  VariantProps<typeof toggleVariants> & { spacing?: number; children?: React.ReactNode } & ValueProps) {
  const adapted =
    type === "single"
      ? {
          multiple: false,
          deselectable: true,
          value: toArray(value as string | undefined),
          defaultValue: toArray(defaultValue as string | undefined),
          onValueChange:
            onValueChange &&
            ((next: string[], details: GroupDetails) => (onValueChange as (v: string, d: GroupDetails) => void)(next[0] ?? "", details)),
        }
      : { multiple: type === "multiple" ? true : props.multiple, value, defaultValue, onValueChange }
  return (
    <SdkToggleGroup
      data-variant={variant}
      data-size={size}
      data-spacing={spacing}
      style={{ "--gap": spacing } as React.CSSProperties}
      className={cn(
        "group/toggle-group flex w-fit items-center gap-[--spacing(var(--gap))] rounded-(--ui-radius-control) data-[spacing=default]:data-[variant=outline]:shadow-xs",
        className
      )}
      {...props}
      {...(adapted as Partial<SdkGroupProps>)}
    >
      <ToggleGroupContext.Provider value={{ variant, size, spacing }}>
        {children}
      </ToggleGroupContext.Provider>
    </SdkToggleGroup>
  )
}

const toArray = (v: string | undefined) => (v === undefined ? undefined : v === "" ? [] : [v])

function ToggleGroupItem({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof SdkToggle> &
  VariantProps<typeof toggleVariants>) {
  const context = React.useContext(ToggleGroupContext)

  return (
    <SdkToggle
      data-variant={context.variant || variant}
      data-size={context.size || size}
      data-spacing={context.spacing}
      className={cn(
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        "w-auto min-w-0 shrink-0 px-3 focus:z-10 focus-visible:z-10",
        "data-[spacing=0]:rounded-none data-[spacing=0]:shadow-none data-[spacing=0]:first:rounded-l-(--ui-radius-control) data-[spacing=0]:last:rounded-r-(--ui-radius-control) data-[spacing=0]:data-[variant=outline]:border-l-0 data-[spacing=0]:data-[variant=outline]:first:border-l",
        className
      )}
      {...props}
    />
  )
}

export { ToggleGroup, ToggleGroupItem }
