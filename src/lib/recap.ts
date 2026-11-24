import { pad2 } from './isoDate'
import type { Who } from '../../supabase/functions/_shared/rules'

// What the monthly recap reads. Rows are free-form JSON, so every field is looked at before it is used.
export interface RecapSource {
  places: unknown[]
  doodles: unknown[]
  notes: unknown[]
  moods: unknown[]
  events: unknown[]
  archive: unknown[]
  answers: unknown[]
  balance: unknown[]
}

export interface YearMonth {
  year: number
  month: number
}

export interface MonthRecap {
  /** Places dated in the month, oldest first. */
  places: string[]
  /** How many different map areas those places are in. */
  regions: number
  /** 함께 events of the month that have already come (today included). */
  together: number
  doodles: number
  notes: number
  /** Days both of us answered the daily question. */
  chats: number
  reviews: number
  /** The best-rated review of the month, the latest one on a tie. */
  bestReview: { name: string; rating: number } | null
  /** Average mood of the month to one decimal, null with nothing recorded. */
  mood: Record<Who, number | null>
  /** Balance game days both of us picked, and how many of those we picked the same. */
  balance: { played: number; matched: number }
  empty: boolean
}

type Row = Record<string, unknown>

const rows = (items: unknown[]): Row[] => items.filter((v): v is Row => !!v && typeof v === 'object')
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const isWho = (v: unknown): v is Who => v === 'A' || v === 'B'

export const monthKey = ({ year, month }: YearMonth) => `${year}-${pad2(month)}`

/** The month a 'YYYY-MM-DD' day is in. */
export function monthOf(date: string): YearMonth {
  return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) }
}

// Rows without their own date (낙서, 한마디) count in the month they were made, local time.
function createdMonth(row: Row): string {
  const at = row.createdAt
  if (typeof at !== 'number' || !Number.isFinite(at)) return ''
  const d = new Date(at)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}

const datedIn = (key: string) => (row: Row) => typeof row.date === 'string' && row.date.startsWith(`${key}-`)

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
}

// Days on which both A and B have a row, with each one's row for that day.
function sharedDays(items: Row[]): { A: Row; B: Row }[] {
  const days = new Map<string, Partial<Record<Who, Row>>>()
  for (const row of items) {
    const who = isWho(row.sender) ? row.sender : row.who
    if (!isWho(who) || typeof row.date !== 'string') continue
    const day = days.get(row.date) ?? {}
    day[who] ??= row
    days.set(row.date, day)
  }
  return [...days.values()].filter((d): d is { A: Row; B: Row } => !!d.A && !!d.B)
}

export function monthRecap(source: RecapSource, month: YearMonth, today: string): MonthRecap {
  const key = monthKey(month)
  const inMonth = datedIn(key)

  const places = rows(source.places).filter(inMonth).filter((p) => text(p.name) !== '')
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
  const regions = new Set(places.map((p) => text(p.region)).filter(Boolean))

  const together = rows(source.events).filter(inMonth)
    .filter((e) => e.owner === 'both' && String(e.date) <= today).length

  const doodles = rows(source.doodles).filter((d) => createdMonth(d) === key).length
  const notes = rows(source.notes).filter((n) => createdMonth(n) === key).length
  const chats = sharedDays(rows(source.answers).filter(inMonth)).length

  const reviews = rows(source.archive).filter(inMonth).filter((r) => text(r.name) !== '')
  const rated = reviews.filter((r) => typeof r.rating === 'number' && r.rating >= 1)
    .sort((a, b) => (b.rating as number) - (a.rating as number) || String(b.date).localeCompare(String(a.date)))
  const bestReview = rated.length > 0 ? { name: text(rated[0].name), rating: rated[0].rating as number } : null

  const moods = rows(source.moods).filter(inMonth).filter((m) => typeof m.value === 'number' && Number.isFinite(m.value))
  const moodOf = (who: Who) => average(moods.filter((m) => m.who === who).map((m) => m.value as number))

  const games = sharedDays(rows(source.balance).filter(inMonth).filter((b) => b.pick === 'a' || b.pick === 'b'))
  const balance = { played: games.length, matched: games.filter((g) => g.A.pick === g.B.pick).length }

  const mood = { A: moodOf('A'), B: moodOf('B') }
  const empty = places.length + together + doodles + notes + chats + reviews.length + balance.played === 0
    && mood.A === null && mood.B === null

  return {
    places: places.map((p) => text(p.name)),
    regions: regions.size,
    together,
    doodles,
    notes,
    chats,
    reviews: reviews.length,
    bestReview,
    mood,
    balance,
    empty,
  }
}

/** The first month with anything to look back on — ‹ stops there. Never later than the current month. */
export function earliestMonth(source: RecapSource, today: string): YearMonth {
  const now = today.slice(0, 7)
  let first = now
  const see = (key: string) => {
    if (/^\d{4}-\d{2}$/.test(key) && key < first) first = key
  }
  for (const list of [source.places, source.events, source.archive, source.answers, source.moods, source.balance]) {
    for (const row of rows(list)) if (typeof row.date === 'string') see(row.date.slice(0, 7))
  }
  for (const list of [source.doodles, source.notes]) for (const row of rows(list)) see(createdMonth(row))
  return monthOf(`${first}-01`)
}

export function shiftRecapMonth({ year, month }: YearMonth, delta: number): YearMonth {
  const d = new Date(year, month - 1 + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

/** For the first week of a month the home screen points at last month's recap. Null the rest of the time. */
export function recapToAnnounce(today: string): YearMonth | null {
  return Number(today.slice(8, 10)) <= 7 ? shiftRecapMonth(monthOf(today), -1) : null
}
