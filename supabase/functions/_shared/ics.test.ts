import { describe, it, expect } from 'vitest'
import { buildCalendar, keysMatch, type EventRow } from './ics'

const names = { nameA: '갑', nameB: '을' }

function row(id: string, data: Record<string, unknown>, created_at = Date.UTC(2026, 9, 6, 3, 4, 5)): EventRow {
  return { id, data, created_at }
}
// Unfolded lines, without the trailing empty one.
const lines = (ics: string) => ics.replace(/\r\n /g, '').split('\r\n').filter(Boolean)
const eventLines = (ics: string) => {
  const all = lines(ics)
  return all.slice(all.indexOf('BEGIN:VEVENT'), all.indexOf('END:VEVENT') + 1)
}

describe('buildCalendar', () => {
  it('is a named, empty calendar when there are no events', () => {
    const all = lines(buildCalendar([], names))
    expect(all[0]).toBe('BEGIN:VCALENDAR')
    expect(all).toContain('VERSION:2.0')
    expect(all).toContain('X-WR-CALNAME:우리의 이야기')
    expect(all[all.length - 1]).toBe('END:VCALENDAR')
    expect(all).not.toContain('BEGIN:VEVENT')
  })

  it('ends every line with CRLF', () => {
    const ics = buildCalendar([row('e1', { title: '약속', date: '2026-10-12', time: '', owner: 'A' })], names)
    expect(ics.endsWith('\r\n')).toBe(true)
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
  })

  it('writes an all-day event as a date that ends the next day', () => {
    const ev = eventLines(buildCalendar([row('e1', { title: '야간 근무', date: '2026-10-31', time: '', owner: 'A' })], names))
    expect(ev).toContain('UID:e1@our-story')
    expect(ev).toContain('DTSTAMP:20261006T030405Z')
    expect(ev).toContain('DTSTART;VALUE=DATE:20261031')
    expect(ev).toContain('DTEND;VALUE=DATE:20261101')
    expect(ev).toContain('SUMMARY:갑 · 야간 근무')
  })

  it('writes a timed event as one hour starting at that Korean time, in UTC', () => {
    const ev = eventLines(buildCalendar([row('e2', { title: '저녁 약속', date: '2026-10-12', time: '19:00', owner: 'both' })], names))
    expect(ev).toContain('DTSTART:20261012T100000Z')
    expect(ev).toContain('DTEND:20261012T110000Z')
    expect(ev).toContain('SUMMARY:💗 저녁 약속')
  })

  it('moves an early-morning Korean time to the previous UTC day', () => {
    const ev = eventLines(buildCalendar([row('e3', { title: '첫차', date: '2027-01-01', time: '05:30', owner: 'B' })], names))
    expect(ev).toContain('DTSTART:20261231T203000Z')
    expect(ev).toContain('DTEND:20261231T213000Z')
    expect(ev).toContain('SUMMARY:을 · 첫차')
  })

  it('includes the note, and leaves the line out when there is none', () => {
    const withNote = eventLines(buildCalendar([row('e1', { title: '약속', date: '2026-10-12', owner: 'A', note: '강남역' })], names))
    expect(withNote).toContain('DESCRIPTION:강남역')
    const without = eventLines(buildCalendar([row('e1', { title: '약속', date: '2026-10-12', owner: 'A', note: '' })], names))
    expect(without.some((l) => l.startsWith('DESCRIPTION'))).toBe(false)
  })

  it('escapes commas, semicolons, backslashes and line breaks', () => {
    const ev = eventLines(buildCalendar([row('e1', { title: '밥, 영화; 산책\\', date: '2026-10-12', owner: 'both', note: '첫 줄\n둘째 줄' })], names))
    expect(ev).toContain('SUMMARY:💗 밥\\, 영화\\; 산책\\\\')
    expect(ev).toContain('DESCRIPTION:첫 줄\\n둘째 줄')
  })

  it('folds long lines at 75 bytes without splitting a character', () => {
    const title = '가'.repeat(40)
    const ics = buildCalendar([row('e1', { title, date: '2026-10-12', owner: 'B' })], names)
    const bytes = (s: string) => new TextEncoder().encode(s).length
    for (const physical of ics.split('\r\n')) expect(bytes(physical)).toBeLessThanOrEqual(75)
    expect(lines(ics)).toContain(`SUMMARY:을 · ${title}`)
    expect(ics).not.toContain('�')
  })

  it('skips rows without a usable title, date or owner', () => {
    const ics = buildCalendar([
      row('ok', { title: '약속', date: '2026-10-12', owner: 'A' }),
      row('noTitle', { date: '2026-10-12', owner: 'A' }),
      row('blank', { title: '   ', date: '2026-10-12', owner: 'A' }),
      row('badDate', { title: 'x', date: '10/12', owner: 'A' }),
      row('noSuchDay', { title: 'x', date: '2026-02-31', owner: 'A' }),
      row('badOwner', { title: 'x', date: '2026-10-12', owner: 'C' }),
    ], names)
    expect(lines(ics).filter((l) => l.startsWith('UID:'))).toEqual(['UID:ok@our-story'])
  })

  it('treats a malformed time as all day', () => {
    const ev = eventLines(buildCalendar([row('e1', { title: '약속', date: '2026-10-12', time: '7pm', owner: 'A' })], names))
    expect(ev).toContain('DTSTART;VALUE=DATE:20261012')
  })

  it('lists events in date order whatever order the rows come in', () => {
    const ics = buildCalendar([
      row('later', { title: 'b', date: '2026-11-01', owner: 'A' }),
      row('sooner', { title: 'a', date: '2026-10-07', owner: 'A' }),
    ], names)
    expect(lines(ics).filter((l) => l.startsWith('UID:'))).toEqual(['UID:sooner@our-story', 'UID:later@our-story'])
  })

  it('gives the same text for the same rows', () => {
    const rows = [row('e1', { title: '약속', date: '2026-10-12', time: '19:00', owner: 'A' })]
    expect(buildCalendar(rows, names)).toBe(buildCalendar(rows, names))
  })
})

describe('keysMatch', () => {
  const key = 'k'.repeat(43)
  it('accepts only the exact key', () => {
    expect(keysMatch(key, key)).toBe(true)
    expect(keysMatch(key.slice(0, -1) + 'x', key)).toBe(false)
    expect(keysMatch(key + 'k', key)).toBe(false)
    expect(keysMatch('', key)).toBe(false)
  })
  it('refuses everything when no proper key is configured', () => {
    expect(keysMatch('', '')).toBe(false)
    expect(keysMatch('short', 'short')).toBe(false)
    expect(keysMatch('undefined', undefined)).toBe(false)
    expect(keysMatch(key, { key })).toBe(false)
  })
})

describe('buildCalendar — 여러 날 일정', () => {
  it('writes an all-day span ending the day after its last day', () => {
    const ev = eventLines(buildCalendar([row('t', { title: '여행', date: '2026-11-04', endDate: '2026-11-07', time: '', owner: 'both' })], names))
    expect(ev).toContain('DTSTART;VALUE=DATE:20261104')
    expect(ev).toContain('DTEND;VALUE=DATE:20261108')
  })

  it('runs a timed span from the start time on the first day to an hour later on the last', () => {
    const ev = eventLines(buildCalendar([row('t', { title: '출장', date: '2026-11-04', endDate: '2026-11-05', time: '10:00', owner: 'A' })], names))
    expect(ev).toContain('DTSTART:20261104T010000Z')
    expect(ev).toContain('DTEND:20261105T020000Z')
  })

  it('ignores an end date that is not after the start', () => {
    const ev = eventLines(buildCalendar([row('t', { title: '약속', date: '2026-11-04', endDate: '2026-11-01', time: '', owner: 'A' })], names))
    expect(ev).toContain('DTEND;VALUE=DATE:20261105')
  })
})
