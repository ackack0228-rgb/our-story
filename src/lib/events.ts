import { ISO_DATE, pad2 } from './isoDate'

export type EventOwner = 'A' | 'B' | 'both'

export interface CalendarEvent {
  id: string
  title: string
  date: string
  /** Last day of a multi-day event. Missing or '' = just `date`. */
  endDate?: string
  time: string
  owner: EventOwner
  note: string
  createdBy?: 'A' | 'B'
  createdAt: number
}

export interface EventInput {
  title: string
  date: string
  /** '' for a one-day event. */
  endDate: string
  time: string
  owner: EventOwner
  note: string
}

export const TITLE_MAX = 40
export const NOTE_MAX = 200

const TIME = /^\d{2}:\d{2}$/
const OWNERS: EventOwner[] = ['A', 'B', 'both']
export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

const isoDate = (y: number, m: number, d: number) => `${y}-${pad2(m)}-${pad2(d)}`

// Rows are free-form JSON. Anything without a usable date, title or owner is left off the calendar
// rather than breaking it.
export function isCalendarEvent(v: unknown): v is CalendarEvent {
  const e = v as Partial<CalendarEvent> | null
  return !!e && typeof e.title === 'string' && typeof e.date === 'string' && ISO_DATE.test(e.date)
    && OWNERS.includes(e.owner as EventOwner)
}

// 'HH:MM', or '' for an all-day event.
export function eventTime(e: CalendarEvent): string {
  return typeof e.time === 'string' && TIME.test(e.time) ? e.time : ''
}

// The event's last day: endDate when it is a real date after the start, otherwise the start itself.
export function eventEnd(e: Pick<CalendarEvent, 'date' | 'endDate'>): string {
  return typeof e.endDate === 'string' && ISO_DATE.test(e.endDate) && e.endDate > e.date ? e.endDate : e.date
}

const shortDate = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8))}`
const dayNumber = (date: string) => Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8))) / 86_400_000

// '11/4 ~ 11/7 · 4일' for a multi-day event, '' for a one-day one.
export function dateSpan(e: Pick<CalendarEvent, 'date' | 'endDate'>): string {
  const end = eventEnd(e)
  if (end === e.date) return ''
  return `${shortDate(e.date)} ~ ${shortDate(end)} · ${dayNumber(end) - dayNumber(e.date) + 1}일`
}

// One cell per day in Sunday-first weeks; cells outside the month are null. month is 1-12.
export function monthGrid(year: number, month: number): (string | null)[] {
  const lead = new Date(year, month - 1, 1).getDay()
  const days = new Date(year, month, 0).getDate()
  const cells: (string | null)[] = Array(lead).fill(null)
  for (let d = 1; d <= days; d++) cells.push(isoDate(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month - 1 + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

// Multi-day events first (earliest start first), so a trip keeps the top line in every day it covers.
// Then timed events in time order, then all-day ones, then by when they were added.
function compareInDay(a: CalendarEvent, b: CalendarEvent): number {
  const ma = eventEnd(a) !== a.date
  const mb = eventEnd(b) !== b.date
  if (ma !== mb) return ma ? -1 : 1
  if (ma && a.date !== b.date) return a.date < b.date ? -1 : 1
  const ta = eventTime(a)
  const tb = eventTime(b)
  if (ta !== tb) {
    if (!ta) return 1
    if (!tb) return -1
    return ta < tb ? -1 : 1
  }
  return a.createdAt - b.createdAt
}

export function eventsOn(events: CalendarEvent[], date: string): CalendarEvent[] {
  return events.filter((e) => e.date <= date && date <= eventEnd(e)).sort(compareInDay)
}

// Today counts as upcoming for the whole day, even after the event's time has passed. A multi-day
// event stays until its last day.
export function upcomingEvents(events: CalendarEvent[], today: string, limit: number): CalendarEvent[] {
  return events
    .filter((e) => eventEnd(e) >= today)
    .sort((a, b) => (a.date === b.date ? compareInDay(a, b) : a.date < b.date ? -1 : 1))
    .slice(0, limit)
}

// What a day's cell in the month grid shows: its first few events in the day's order, and how many more there are.
export function dayPreview(events: CalendarEvent[], date: string, limit: number): { shown: CalendarEvent[]; more: number } {
  const all = eventsOn(events, date)
  return { shown: all.slice(0, limit), more: Math.max(0, all.length - limit) }
}

// '오늘', '내일', or '10/12 (월)'.
export function dayLabel(date: string, today: string): string {
  if (date === today) return '오늘'
  const [ty, tm, td] = today.split('-').map(Number)
  const next = new Date(ty, tm - 1, td + 1)
  if (date === isoDate(next.getFullYear(), next.getMonth() + 1, next.getDate())) return '내일'
  const [y, m, d] = date.split('-').map(Number)
  return `${m}/${d} (${WEEKDAYS[new Date(y, m - 1, d).getDay()]})`
}

export function ownerLabel(owner: EventOwner, names: { nameA: string; nameB: string }): string {
  if (owner === 'both') return '우리'
  return owner === 'A' ? names.nameA : names.nameB
}

// When an upcoming event happens: '내일', or '오늘 ~ 11/7' for a trip that is already under way.
export function whenLabel(e: CalendarEvent, today: string): string {
  const end = eventEnd(e)
  const start = dayLabel(e.date < today ? today : e.date, today)
  return end === e.date ? start : `${start} ~ ${shortDate(end)}`
}
