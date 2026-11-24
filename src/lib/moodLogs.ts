import { pad2 } from './isoDate'

export interface MoodLog {
  id: string
  date: string
  value: number
  who: string
  createdAt: number
}

// The graph covers two weeks at a time — a Monday to the Sunday after next — and starts over empty
// when the next two weeks begin. Nothing is deleted: older moods stay stored, just off the graph.
// The count runs from this Monday, the week the first moods were recorded.
const PERIOD_ANCHOR = '2026-10-05'
const PERIOD_DAYS = 14
const DAY_MS = 86_400_000

// Calendar dates only, so the arithmetic is done in UTC where every day is 24 hours.
const dayNumber = (date: string) => {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / DAY_MS
}
const isoOfDay = (day: number) => {
  const d = new Date(day * DAY_MS)
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
}

/** The two weeks `today` falls in, first and last day included. */
export function moodPeriod(today: string): { start: string; end: string } {
  const anchor = dayNumber(PERIOD_ANCHOR)
  const start = anchor + Math.floor((dayNumber(today) - anchor) / PERIOD_DAYS) * PERIOD_DAYS
  return { start: isoOfDay(start), end: isoOfDay(start + PERIOD_DAYS - 1) }
}

/** The moods that belong on the graph today. */
export function logsInPeriod<T extends { date: string }>(logs: T[], today: string): T[] {
  const { start, end } = moodPeriod(today)
  return logs.filter((l) => l.date >= start && l.date <= end)
}
