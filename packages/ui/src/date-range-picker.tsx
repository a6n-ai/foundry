"use client";

import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { CalendarIcon } from "lucide-react";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { tzOffsetMinutes, zonedDateIso } from "@foundry/commons";
import { cn } from "./cn";

const fmt = (ms: number, timeZone: string) =>
  new Date(ms).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone });

// The calendar hands back browser-local Dates; only their y/m/d is the picked day.
// Day bounds are taken in `timeZone` so a staff browser in another zone filters
// the business day, not its own.
export function zonedStartOfDay(y: number, m: number, d: number, timeZone: string): number {
  const guess = Date.UTC(y, m, d);
  const first = guess - tzOffsetMinutes(timeZone, guess) * 60000;
  // Second pass lands on the right offset when a DST switch sits between guess and midnight.
  return guess - tzOffsetMinutes(timeZone, first) * 60000;
}

export const zonedEndOfDay = (y: number, m: number, d: number, timeZone: string) =>
  zonedStartOfDay(y, m, d + 1, timeZone) - 1;

const startOfDay = (d: Date, tz: string) => zonedStartOfDay(d.getFullYear(), d.getMonth(), d.getDate(), tz);
const endOfDay = (d: Date, tz: string) => zonedEndOfDay(d.getFullYear(), d.getMonth(), d.getDate(), tz);

// Epoch ms -> a browser-local Date on the same calendar day as `ms` in `timeZone`.
const toCalendarDay = (ms: number, tz: string) => {
  const [y, m, d] = zonedDateIso(ms, tz).split("-").map(Number);
  return new Date(y!, m! - 1, d!);
};

function preset(days: number, tz: string): { from: number; to: number } {
  const today = toCalendarDay(Date.now(), tz);
  const start = new Date(today);
  start.setDate(start.getDate() - (days - 1));
  return { from: startOfDay(start, tz), to: endOfDay(today, tz) };
}

export function DateRangePicker({
  from, to, onChange, label = "Any date", timeZone,
}: {
  from?: number;
  to?: number;
  onChange: (r: { from?: number; to?: number }) => void;
  label?: string;
  /** IANA zone the picked days mean. Defaults to the browser's. */
  timeZone?: string;
}) {
  const [open, setOpen] = useState(false);
  const tz = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const selected: DateRange | undefined =
    from != null
      ? { from: toCalendarDay(from, tz), to: to != null ? toCalendarDay(to, tz) : undefined }
      : undefined;
  const triggerLabel =
    from != null ? `${fmt(from, tz)}${to != null ? ` – ${fmt(to, tz)}` : ""}` : label;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-start gap-2 font-normal tabular-nums transition-transform active:scale-[0.97]",
            from == null && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="size-4 text-muted-foreground" />
          {triggerLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-wrap gap-1 border-b p-2">
          {[
            { label: "Today", days: 1 },
            { label: "7 days", days: 7 },
            { label: "30 days", days: 30 },
          ].map((p) => (
            <Button
              key={p.label}
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange(preset(p.days, tz));
                setOpen(false);
              }}
            >
              {p.label}
            </Button>
          ))}
          {from != null && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto text-muted-foreground"
              onClick={() => {
                onChange({});
                setOpen(false);
              }}
            >
              Clear
            </Button>
          )}
        </div>
        <Calendar
          mode="range"
          numberOfMonths={2}
          selected={selected}
          defaultMonth={selected?.from}
          onSelect={(r) =>
            onChange({
              from: r?.from ? startOfDay(r.from, tz) : undefined,
              to: r?.to ? endOfDay(r.to, tz) : undefined,
            })
          }
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function DatePicker({
  value, onChange, placeholder = "Pick a date",
}: {
  value?: string;
  onChange: (iso: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(`${value}T00:00:00`) : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-start gap-2 font-normal tabular-nums",
            !value && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="size-4 text-muted-foreground" />
          {value
            ? new Date(`${value}T00:00:00`).toLocaleDateString("en-CA", {
                month: "short", day: "numeric", year: "numeric",
              })
            : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(d) => {
            if (d) onChange(toIso(d));
            setOpen(false);
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
