import { Badge } from "@foundry/ui/badge"
import { Button } from "@foundry/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@foundry/ui/dropdown-menu"
import { ListFilterIcon, XIcon } from "lucide-react"
import { type Facet, chipsFrom, withoutKey } from "./filters"
import type { ConsoleSearch } from "./router"

export function FilterMenu({
  facets,
  value,
  onChange,
}: {
  facets: Facet[]
  value: ConsoleSearch
  onChange: (next: ConsoleSearch) => void
}) {
  const chips = chipsFrom(value, facets)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" />}>
          <ListFilterIcon />
          Filter
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {facets.map((f) => (
            <DropdownMenuGroup key={f.key}>
              <DropdownMenuLabel>{f.label}</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={typeof value[f.key] === "string" ? (value[f.key] as string) : ""}
                onValueChange={(v) => onChange(v ? { ...value, [f.key]: String(v) } : withoutKey(value, f.key))}
              >
                <DropdownMenuRadioItem value="">Any</DropdownMenuRadioItem>
                {f.options.map((o) => (
                  <DropdownMenuRadioItem key={o.value} value={o.value}>
                    {o.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {chips.map((c) => (
        <Badge key={c.key} variant="outline" className="gap-1 pr-1">
          {c.label}: {c.valueLabel}
          <button
            type="button"
            aria-label={`Remove ${c.label} filter`}
            className="rounded-full p-0.5 hover:bg-muted"
            onClick={() => onChange(withoutKey(value, c.key))}
          >
            <XIcon />
          </button>
        </Badge>
      ))}
      {chips.length > 0 ? (
        <Button variant="ghost" onClick={() => onChange(chips.reduce((s, c) => withoutKey(s, c.key), value))}>
          Clear
        </Button>
      ) : null}
    </div>
  )
}
