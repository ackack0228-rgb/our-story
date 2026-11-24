export interface Doodle {
  id: string
  imageUrl: string
  sender: string
  createdAt: number
}

export interface Note {
  id: string
  text: string
  sender: string
  createdAt: number
}

export type FeedItem = ({ type: 'doodle' } & Doodle) | ({ type: 'note' } & Note)

function toMillis(ts: unknown): number {
  if (ts && typeof ts === 'object' && 'toMillis' in (ts as object)) {
    return (ts as { toMillis(): number }).toMillis()
  }
  if (ts instanceof Date) return ts.getTime()
  if (typeof ts === 'number') return ts
  return 0
}

export function mergeFeed(doodles: Doodle[], notes: Note[]): FeedItem[] {
  const items: FeedItem[] = [
    ...doodles.map((d) => ({ type: 'doodle' as const, ...d })),
    ...notes.map((n) => ({ type: 'note' as const, ...n })),
  ]
  return items.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
}
