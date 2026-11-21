"use client"

import * as React from "react"
import {
  Slider as SdkSlider,
  SliderControl,
  SliderIndicator,
  SliderThumb,
  SliderTrack,
} from "@ui-sdk/react/slider"

import { cn } from "./cn"

type SliderProps = Omit<React.ComponentProps<typeof SdkSlider<number[]>>, "children">

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: SliderProps) {
  const thumbs = (value ?? defaultValue ?? [min, max]).length

  return (
    <SdkSlider<number[]>
      defaultValue={defaultValue ?? (value === undefined ? [min, max] : undefined)}
      value={value}
      min={min}
      max={max}
      className={cn(
        "relative flex w-full select-none data-disabled:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-40 data-[orientation=vertical]:w-auto",
        className
      )}
      {...props}
    >
      <SliderControl className="flex w-full items-center data-[orientation=vertical]:h-full data-[orientation=vertical]:w-3 data-[orientation=vertical]:justify-center data-[orientation=horizontal]:h-3">
        <SliderTrack className="relative grow rounded-full bg-muted data-[orientation=horizontal]:h-1 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1">
          <SliderIndicator className="rounded-full bg-primary" />
          {Array.from({ length: thumbs }, (_, index) => (
            <SliderThumb
              key={index}
              index={index}
              className="block size-3 shrink-0 rounded-full border border-ring bg-white ring-ring/50 select-none after:absolute after:-inset-2 hover:ring-3 has-focus-visible:ring-3 data-dragging:ring-3 data-disabled:pointer-events-none"
            />
          ))}
        </SliderTrack>
      </SliderControl>
    </SdkSlider>
  )
}

export { Slider }
