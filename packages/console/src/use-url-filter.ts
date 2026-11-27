"use client"

import { useEffect, useRef, useState } from "react"
import { useConsoleRouter } from "./router"
import { withParam } from "./search-param"

// The URL is the source of truth: follow it (nav link, Back), push typed text to it `delay` ms after typing stops.
export function useUrlFilter(key: string, { reset = [], delay = 300 }: { reset?: string[]; delay?: number } = {}): [string, (value: string) => void] {
  const router = useConsoleRouter()
  const navigate = router.useNavigate()
  const raw = router.useSearch()[key]
  const current = typeof raw === "string" ? raw : ""
  const [value, setValue] = useState(current)
  const pushed = useRef(current)
  const resetKey = reset.join("\0")

  useEffect(() => {
    if (current === pushed.current) return
    pushed.current = current
    setValue(current)
  }, [current])

  useEffect(() => {
    const next = value.trim()
    if (next === pushed.current) return
    const t = setTimeout(() => {
      pushed.current = next
      navigate({ search: (prev) => withParam(prev, key, next, resetKey ? resetKey.split("\0") : []), replace: true })
    }, delay)
    return () => clearTimeout(t)
  }, [value, key, resetKey, delay, navigate])

  return [value, setValue]
}
