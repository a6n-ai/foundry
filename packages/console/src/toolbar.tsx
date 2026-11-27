import { InputGroup, InputGroupAddon, InputGroupInput } from "@foundry/ui/input-group"
import { Kbd } from "@foundry/ui/kbd"
import { SearchIcon } from "lucide-react"
import { type ReactNode, useEffect, useRef } from "react"

function isTypingTarget(el: HTMLElement | null): boolean {
  if (!el) return false
  return el.isContentEditable === true || el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT"
}

export function Toolbar({ search, filters, view, children }: { search?: ReactNode; filters?: ReactNode; view?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-3">
      {search ? <div className="w-full sm:min-w-48 sm:max-w-md sm:flex-1">{search}</div> : null}
      {filters}
      {view ? <div className="ml-auto">{view}</div> : null}
      {children ? <div className={`${view ? "" : "ml-auto "}flex items-center gap-2`}>{children}</div> : null}
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder = "Search" }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return
      if (isTypingTarget(document.activeElement as HTMLElement | null)) return
      e.preventDefault()
      ref.current?.focus()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])
  return (
    <InputGroup>
      <InputGroupAddon>
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput ref={ref} type="search" value={value} placeholder={placeholder} aria-label={placeholder} onChange={(e) => onChange(e.target.value)} />
      <InputGroupAddon align="inline-end">
        <Kbd>/</Kbd>
      </InputGroupAddon>
    </InputGroup>
  )
}
