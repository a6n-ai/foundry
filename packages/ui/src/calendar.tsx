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
  type CalendarValue,
} from "@ui-sdk/react/calendar"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { cn } from "./cn"
import { buttonVariants } from "./button"

type DateRange = { from?: Date; to?: Date }
type Matcher =
  | Date
  | { before: Date }
  | { after: Date }
  | { from: Date; to: Date }
  | ((date: Date) => boolean)

type CommonProps = {
  month?: Date
  defaultMonth?: Date
  onMonthChange?: (month: Date) => void
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6
  locale?: { code?: string }
  onDayClick?: (day: Date) => void
  disabled?: Matcher | Matcher[]
  numberOfMonths?: number
  showOutsideDays?: boolean
  autoFocus?: boolean
  className?: string
}

/** @deprecated react-day-picker call shape, kept for callers; new code uses `@ui-sdk/react/calendar` directly. */
type CalendarProps = CommonProps &
  (
    | { mode?: "single"; selected?: Date; onSelect?: (date: Date | undefined, day: Date) => void }
    | { mode: "range"; selected?: DateRange; onSelect?: (range: DateRange | undefined, day: Date) => void }
  )

const pad = (n: number) => String(n).padStart(2, "0")
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const toMonth = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
const fromIso = (iso: string) => {
  const [y, m, d = 1] = iso.split("-").map(Number)
  return new Date(y!, m! - 1, d)
}

function toMatcher(m: Matcher) {
  if (m instanceof Date) return toIso(m)
  if (typeof m === "function") return (iso: string) => m(fromIso(iso))
  if ("before" in m) return { before: toIso(m.before) }
  if ("after" in m) return { after: toIso(m.after) }
  return { from: toIso(m.from), to: toIso(m.to) }
}

// A press reports the day it landed on; a range only reports once both ends are in, so the day is read off the event.
const pressedDay = (event: Event | undefined) => {
  const iso = (event?.target as Element | null)?.closest?.("[data-value]")?.getAttribute("data-value")
  return iso ? fromIso(iso) : undefined
}

function Calendar(props: CalendarProps) {
  const {
    mode = "single",
    month,
    defaultMonth,
    onMonthChange,
    weekStartsOn,
    locale,
    onDayClick,
    disabled,
    numberOfMonths = 1,
    showOutsideDays = true,
    autoFocus,
    className,
  } = props
  const controlled = "selected" in props
  const [controller] = React.useState(createCalendarController)
  // The controller only knows its days once they have rendered in the browser, so focus waits a frame.
  React.useEffect(() => {
    if (!autoFocus) return
    const frame = requestAnimationFrame(() => controller.focus())
    return () => cancelAnimationFrame(frame)
  }, [autoFocus, controller])

  const value = React.useMemo<CalendarValue | undefined>(() => {
    if (!controlled) return undefined
    if (props.mode === "range") {
      const range = props.selected
      return range?.from ? [toIso(range.from), toIso(range.to ?? range.from)] : null
    }
    return props.selected ? toIso(props.selected) : null
  }, [controlled, props])

  const unavailable = React.useMemo(
    () => (disabled === undefined ? undefined : (Array.isArray(disabled) ? disabled : [disabled]).map(toMatcher)),
    [disabled]
  )

  return (
    <SdkCalendar
      mode={mode}
      controller={controller}
      deselectable
      value={value}
      onValueChange={(next, details) => {
        if (props.mode === "range") {
          const [start, end] = next as [string, string]
          const day = pressedDay(details.event) ?? fromIso(end)
          props.onSelect?.({ from: fromIso(start), to: fromIso(end) }, day)
          onDayClick?.(day)
        } else {
          const day = (next ? fromIso(next as string) : pressedDay(details.event))!
          props.onSelect?.(next ? day : undefined, day)
          onDayClick?.(day)
        }
      }}
      onAnchorChange={
        props.mode === "range"
          ? (anchor) => {
              if (!anchor) return
              props.onSelect?.({ from: fromIso(anchor), to: undefined }, fromIso(anchor))
              onDayClick?.(fromIso(anchor))
            }
          : undefined
      }
      month={month && toMonth(month)}
      defaultMonth={defaultMonth && toMonth(defaultMonth)}
      onMonthChange={onMonthChange && ((next) => onMonthChange(fromIso(next)))}
      weekStartsOn={weekStartsOn}
      locale={locale?.code}
      unavailable={unavailable}
      months={numberOfMonths}
      showOutsideDays={showOutsideDays}
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
        {Array.from({ length: numberOfMonths }, (_, offset) => (
          <CalendarGrid key={offset} offset={offset} className="w-full border-separate border-spacing-x-0 border-spacing-y-1">
            {(state) => (
              <>
                <caption aria-hidden="true" className="flex h-(--cell-size) items-center justify-center text-sm font-medium select-none">
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

export { Calendar, type CalendarProps, type DateRange }
