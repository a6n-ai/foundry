"use client"
import * as React from "react"
import { Switch as SdkSwitch, SwitchThumb as SdkSwitchThumb } from "@ui-sdk/react/switch"
import { cn } from "./cn"

function Switch({
  className,
  size = "default",
  children,
  ...props
}: React.ComponentProps<typeof SdkSwitch> & {
  size?: "sm" | "default"
}) {
  return (
    <SdkSwitch
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent outline-none transition-colors duration-150 motion-reduce:transition-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[size=default]:h-[18px] data-[size=default]:w-8 data-[size=sm]:h-3.5 data-[size=sm]:w-6 data-checked:bg-primary data-unchecked:bg-input dark:data-unchecked:bg-input/80 data-disabled:cursor-not-allowed data-disabled:opacity-50 data-readonly:cursor-default data-invalid:ring-2 data-invalid:ring-destructive/30",
        className
      )}
      {...props}
    >
      {children ?? <SwitchThumb />}
    </SdkSwitch>
  )
}

function SwitchThumb({ className, ...props }: React.ComponentProps<typeof SdkSwitchThumb>) {
  return (
    <SdkSwitchThumb
      className={cn(
        "pointer-events-none block rounded-full bg-background shadow-[0_1px_2px_rgb(0_0_0/0.2)] transition-transform duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 data-checked:translate-x-[calc(100%-2px)] data-unchecked:translate-x-0 rtl:data-checked:-translate-x-[calc(100%-2px)]",
        className
      )}
      {...props}
    />
  )
}

export { Switch, SwitchThumb }
