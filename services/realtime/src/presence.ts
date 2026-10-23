import type { RealtimeRole } from "@foundry/realtime";

export type Att = { userId: string; role: RealtimeRole };

export function onlineSnapshot(others: Att[]): Att[] {
  const seen = new Map<string, Att>();
  for (const a of others) if (!seen.has(a.userId)) seen.set(a.userId, a);
  return [...seen.values()];
}

export const isFirstSocketFor = (others: Att[], userId: string) => !others.some((a) => a.userId === userId);
export const isLastSocketFor = isFirstSocketFor;
