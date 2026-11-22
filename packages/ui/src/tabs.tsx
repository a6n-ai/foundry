"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import {
  Tabs as SdkTabs,
  TabsIndicator,
  TabsList as SdkTabsList,
  TabsPanel,
  TabsTab,
} from "@ui-sdk/react/tabs"

import { cn } from "./cn"

function Tabs({ className, ...props }: React.ComponentProps<typeof SdkTabs>) {
  return (
    <SdkTabs
      className={cn("group/tabs flex gap-2 data-[orientation=horizontal]:flex-col", className)}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col items-center justify-center text-muted-foreground data-[variant=line]:rounded-none max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
  {
    variants: {
      variant: {
        default: "rounded-lg bg-muted p-(--ui-tabs-list-inset)",
        line: "relative gap-1 border-b-(length:--ui-tabs-rule-width) border-border bg-transparent p-(--ui-tabs-line-inset)",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  children,
  ...props
}: Omit<React.ComponentProps<typeof SdkTabsList>, "children"> & {
  children?: React.ReactNode
} & VariantProps<typeof tabsListVariants>) {
  return (
    <SdkTabsList
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    >
      {children}
      {variant === "line" && (
        <TabsIndicator className="absolute left-(--active-tab-left) top-[calc(var(--active-tab-top)+var(--active-tab-height)+var(--ui-tabs-indicator-offset))] h-(--ui-tabs-indicator-height) w-(--active-tab-width) bg-foreground transition-[left,top,width] duration-150 ease-(--ease-soft) data-[activation-direction=none]:transition-none motion-reduce:transition-none" />
      )}
    </SdkTabsList>
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsTab>) {
  return (
    <TabsTab
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-(length:--ui-tabs-size) font-(weight:--ui-tabs-weight) whitespace-nowrap text-foreground/60 transition-colors duration-150 group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-(length:--ui-focus-ring) focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 motion-reduce:transition-none dark:text-muted-foreground dark:hover:text-foreground data-selected:bg-background data-selected:text-foreground dark:data-selected:border-input dark:data-selected:bg-input/30 dark:data-selected:text-foreground group-data-[variant=default]/tabs-list:data-selected:shadow-sm group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-selected:bg-transparent group-data-[variant=line]/tabs-list:data-selected:shadow-none dark:group-data-[variant=line]/tabs-list:data-selected:border-transparent dark:group-data-[variant=line]/tabs-list:data-selected:bg-transparent [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPanel>) {
  return (
    <TabsPanel
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
