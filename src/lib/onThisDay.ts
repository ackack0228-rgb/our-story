import type { Place } from './places'

export interface Memory { place: Place; yearsAgo: number }

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

function parse(date: unknown): { year: number; monthDay: string } | null {
  if (typeof date !== 'string') return null
  const m = ISO_DATE.exec(date)
  if (!m) return null
  return { year: Number(m[1]), monthDay: `${m[2]}-${m[3]}` }
}

// today is a local date string 'YYYY-MM-DD'. Pure string comparison, no Date conversion.
export function onThisDay(places: Place[], today: string): Memory[] {
  const t = parse(today)
  if (!t) return []
  const memories: Memory[] = []
  for (const place of places) {
    const d = parse(place.date)
    if (!d || d.monthDay !== t.monthDay || d.year >= t.year) continue
    memories.push({ place, yearsAgo: t.year - d.year })
  }
  // Array.prototype.sort is stable: equal years keep input order.
  return memories.sort((a, b) => a.yearsAgo - b.yearsAgo)
}
