"use client"

import * as React from "react"
import {
  Calendar as SdkCalendar,
  CalendarDay,
  CalendarGrid,
  CalendarHeading,
  CalendarNext,
  CalendarPrevious,
  CalendarWeekday,
  CalendarWeekdays,
  CalendarWeeks,
  createCalendarController,
} from "@ui-sdk/react/calendar"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { cn } from "./cn"
import { buttonVariants } from "./button"

type CalendarProps = Omit<React.ComponentProps<typeof SdkCalendar>, "children" | "className"> & {
  className?: string
  autoFocus?: boolean
}

function Calendar({ className, autoFocus, controller: given, months = 1, showOutsideDays = true, ...props }: CalendarProps) {
  const [own] = React.useState(createCalendarController)
  const controller = given ?? own
  // The controller only knows its days once they have rendered in the browser, so focus waits a frame.
  React.useEffect(() => {
    if (!autoFocus) return
    const frame = requestAnimationFrame(() => controller.focus())
    return () => cancelAnimationFrame(frame)
  }, [autoFocus, controller])

  return (
    <SdkCalendar
      controller={controller}
      deselectable
      months={months}
      showOutsideDays={showOutsideDays}
      {...props}
      className={cn(
        "group/calendar relative w-fit bg-background p-2 [--cell-radius:var(--radius-md)] [--cell-size:--spacing(7)] in-data-[slot=card-content]:bg-transparent in-data-[slot=popover-content]:bg-transparent",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-x-2 top-2 flex items-center justify-between">
        <CalendarPrevious
          className={cn(buttonVariants({ variant: "ghost" }), "pointer-events-auto size-(--cell-size) p-0 select-none data-disabled:opacity-50")}
        >
          <ChevronLeftIcon className="size-4 rtl:rotate-180" aria-hidden="true" />
        </CalendarPrevious>
        <CalendarNext
          className={cn(buttonVariants({ variant: "ghost" }), "pointer-events-auto size-(--cell-size) p-0 select-none data-disabled:opacity-50")}
        >
          <ChevronRightIcon className="size-4 rtl:rotate-180" aria-hidden="true" />
        </CalendarNext>
      </div>
      <CalendarHeading className="sr-only" />
      <div className="relative flex flex-col gap-4 md:flex-row">
        {Array.from({ length: months }, (_, offset) => (
          <CalendarGrid key={offset} offset={offset} className="w-full border-separate border-spacing-x-0 border-spacing-y-1">
            {(state) => (
              <>
                {/* A flex caption stops being a table caption and lands in the first column; keep it a caption, on top. */}
                <caption aria-hidden="true" className="h-(--cell-size) caption-top text-center align-middle text-sm leading-(--cell-size) font-medium select-none">
                  {state.label}
                </caption>
                <CalendarWeekdays>
                  {(index) => (
                    <CalendarWeekday
                      index={index}
                      className="h-(--cell-size) rounded-(--cell-radius) text-footnote font-normal text-muted-foreground select-none"
                    />
                  )}
                </CalendarWeekdays>
                <CalendarWeeks>
                  {(cell) =>
                    cell.hidden ? null : (
                      <CalendarDay
                        value={cell.date}
                        className="relative z-0 h-(--cell-size) min-w-(--cell-size) cursor-pointer rounded-(--cell-radius) p-0 text-center text-sm select-none outline-none not-data-selected:not-data-disabled:not-data-unavailable:hover:bg-muted focus-visible:z-10 focus-visible:ring-[3px] focus-visible:ring-ring/50 data-outside:text-muted-foreground data-today:not-data-selected:bg-muted data-today:not-data-selected:text-foreground group-data-[mode=single]/calendar:data-selected:bg-primary group-data-[mode=single]/calendar:data-selected:text-primary-foreground data-range-start:rounded-(--cell-radius) data-range-start:bg-primary data-range-start:text-primary-foreground data-range-middle:rounded-none data-range-middle:bg-muted data-range-middle:text-foreground data-range-end:rounded-(--cell-radius) data-range-end:bg-primary data-range-end:text-primary-foreground data-preview:not-data-range-start:not-data-range-end:rounded-none data-preview:not-data-range-start:not-data-range-end:bg-muted data-disabled:cursor-default data-disabled:opacity-50 data-unavailable:cursor-default data-unavailable:opacity-50"
                      />
                    )
                  }
                </CalendarWeeks>
              </>
            )}
          </CalendarGrid>
        ))}
      </div>
    </SdkCalendar>
  )
}

export { Calendar, type CalendarProps }
