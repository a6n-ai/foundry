import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from "@foundry/ui/avatar"
import { initials } from "@foundry/ui/initials"
import { useEffect, useState } from "react"
import type { Awareness } from "y-protocols/awareness"

type Person = { name: string; color: string }

const MAX_SHOWN = 5

function people(awareness: Awareness): Person[] {
  const seen = new Map<string, Person>()
  for (const state of awareness.getStates().values()) {
    const user = (state as { user?: Partial<Person> }).user
    // awareness is client-supplied, so take only well-formed entries
    if (typeof user?.name !== "string" || typeof user.color !== "string") continue
    seen.set(`${user.name}|${user.color}`, { name: user.name, color: user.color })
  }
  return [...seen.values()]
}

export function PresenceAvatars({ provider }: { provider: { awareness: Awareness } }) {
  const [list, setList] = useState<Person[]>([])
  useEffect(() => {
    const read = () => setList(people(provider.awareness))
    read()
    provider.awareness.on("change", read)
    return () => provider.awareness.off("change", read)
  }, [provider])

  if (!list.length) return null
  return (
    <AvatarGroup aria-label={`In this doc: ${list.map((p) => p.name).join(", ")}`}>
      {list.slice(0, MAX_SHOWN).map((p) => (
        <Avatar key={`${p.name}|${p.color}`} size="sm" title={p.name}>
          <AvatarFallback style={{ backgroundColor: p.color, color: "#0d0d0d" }}>{initials(p.name)}</AvatarFallback>
        </Avatar>
      ))}
      {list.length > MAX_SHOWN && <AvatarGroupCount>+{list.length - MAX_SHOWN}</AvatarGroupCount>}
    </AvatarGroup>
  )
}
