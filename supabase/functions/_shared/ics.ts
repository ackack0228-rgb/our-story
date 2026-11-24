// Turns the shared calendar into an iCalendar feed the iPhone Calendar app can subscribe to.
// Pure, like rules.ts: it runs in Deno (Edge Functions) and in Vitest.
import type { Names } from './rules.ts'

export interface EventRow {
  id: string
  data: Record<string, unknown>
  created_at: number
}

const CALENDAR_NAME = '우리의 이야기'
const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000
const MIN_KEY_LENGTH = 32

// The feed has no login, so the key in its address is the only lock. Compares every character
// rather than stopping at the first difference.
export function keysMatch(given: string, expected: unknown): boolean {
  if (typeof expected !== 'string' || expected.length < MIN_KEY_LENGTH) return false
  let diff = given.length ^ expected.length
  for (let i = 0; i < expected.length; i++) diff |= (given.charCodeAt(i) || 0) ^ expected.charCodeAt(i)
  return diff === 0
}

const pad = (n: number) => String(n).padStart(2, '0')
const utcDate = (ms: number) => {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`
}
const utcStamp = (ms: number) => {
  const d = new Date(ms)
  return `${utcDate(ms)}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

const escapeText = (text: string) =>
  text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

// Lines may be at most 75 bytes; longer ones continue on the next line after a space. Korean is
// three bytes a character, so this counts bytes and never cuts inside a character.
function fold(line: string): string {
  const encoder = new TextEncoder()
  const parts: string[] = []
  let current = ''
  let size = 0
  for (const char of line) {
    const bytes = encoder.encode(char).length
    if (size + bytes > 75) {
      parts.push(current)
      current = ' '
      size = 1
    }
    current += char
    size += bytes
  }
  parts.push(current)
  return parts.join('\r\n')
}

interface Parsed {
  id: string
  title: string
  owner: 'A' | 'B' | 'both'
  note: string
  dayStart: number // UTC midnight of the calendar date
  lastDay: number // UTC midnight of the last day (same as dayStart for a one-day event)
  minutes: number | null // minutes after midnight in Korea, null for all day
  stamp: number
}

function parse(row: EventRow): Parsed | null {
  const { title, date, endDate, time, owner, note } = row.data
  if (typeof title !== 'string' || title.trim() === '') return null
  if (owner !== 'A' && owner !== 'B' && owner !== 'both') return null
  const match = typeof date === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(date) : null
  if (!match) return null
  const dayStart = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  // Rejects impossible dates like 2026-02-31, which Date.UTC would silently roll over.
  if (utcDate(dayStart) !== `${match[1]}${match[2]}${match[3]}`) return null
  const endMatch = typeof endDate === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(endDate) : null
  const end = endMatch ? Date.UTC(Number(endMatch[1]), Number(endMatch[2]) - 1, Number(endMatch[3])) : NaN
  const lastDay = endMatch && utcDate(end) === `${endMatch[1]}${endMatch[2]}${endMatch[3]}` && end > dayStart ? end : dayStart
  const clock = typeof time === 'string' ? /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time) : null
  return {
    id: row.id,
    title: title.trim(),
    owner,
    note: typeof note === 'string' ? note.trim() : '',
    dayStart,
    lastDay,
    minutes: clock ? Number(clock[1]) * 60 + Number(clock[2]) : null,
    stamp: Number.isFinite(row.created_at) ? row.created_at : 0,
  }
}

function summary(e: Parsed, names: Names): string {
  if (e.owner === 'both') return `💗 ${e.title}`
  return `${e.owner === 'A' ? names.nameA : names.nameB} · ${e.title}`
}

// Times are sent in UTC: Korea has no daylight saving, so the nine-hour offset never changes and
// the feed needs no time zone table. A timed event is shown as one hour long (on its last day, for
// a multi-day one).
function eventLines(e: Parsed, names: Names): string[] {
  const out = ['BEGIN:VEVENT', `UID:${e.id}@our-story`, `DTSTAMP:${utcStamp(e.stamp)}`]
  if (e.minutes === null) {
    out.push(`DTSTART;VALUE=DATE:${utcDate(e.dayStart)}`, `DTEND;VALUE=DATE:${utcDate(e.lastDay + 24 * HOUR_MS)}`)
  } else {
    const start = e.dayStart + e.minutes * 60_000 - KST_OFFSET_MS
    out.push(`DTSTART:${utcStamp(start)}`, `DTEND:${utcStamp(start + (e.lastDay - e.dayStart) + HOUR_MS)}`)
  }
  out.push(`SUMMARY:${escapeText(summary(e, names))}`)
  if (e.note) out.push(`DESCRIPTION:${escapeText(e.note)}`)
  out.push('END:VEVENT')
  return out
}

export function buildCalendar(rows: EventRow[], names: Names): string {
  const events = rows
    .map(parse)
    .filter((e): e is Parsed => e !== null)
    .sort((a, b) => a.dayStart - b.dayStart || (a.minutes ?? 1440) - (b.minutes ?? 1440) || a.stamp - b.stamp)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//our-story//shared calendar//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(CALENDAR_NAME)}`,
    'X-WR-TIMEZONE:Asia/Seoul',
    'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
    'X-PUBLISHED-TTL:PT15M',
    ...events.flatMap((e) => eventLines(e, names)),
    'END:VCALENDAR',
  ]
  return lines.map(fold).join('\r\n') + '\r\n'
}
