export interface Poke {
  id: string
  sender: 'A' | 'B'
  createdAt: number
}

export const POKE_VISIBLE_MS = 24 * 60 * 60 * 1000

// Most recent poke sent by `from` within the last 24h, or null.
export function latestPokeFrom(pokes: Poke[], from: 'A' | 'B', now: number): Poke | null {
  let best: Poke | null = null
  for (const p of pokes) {
    if (p.sender !== from || now - p.createdAt >= POKE_VISIBLE_MS) continue
    if (!best || p.createdAt > best.createdAt) best = p
  }
  return best
}

export function formatAgo(elapsedMs: number): string {
  const minutes = Math.floor(elapsedMs / 60_000)
  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  return `${Math.floor(minutes / 60)}시간 전`
}
