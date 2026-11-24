import { describe, it, expect } from 'vitest'
import { logsInPeriod, moodPeriod } from './moodLogs'

describe('moodPeriod', () => {
  it('is the two weeks from a Monday to the Sunday after next', () => {
    expect(moodPeriod('2026-10-05')).toEqual({ start: '2026-10-05', end: '2026-10-18' })
    expect(moodPeriod('2026-10-09')).toEqual({ start: '2026-10-05', end: '2026-10-18' })
    expect(moodPeriod('2026-10-18')).toEqual({ start: '2026-10-05', end: '2026-10-18' })
  })

  it('starts over the day after the two weeks end', () => {
    expect(moodPeriod('2026-10-19')).toEqual({ start: '2026-10-19', end: '2026-11-01' })
    expect(moodPeriod('2026-11-02')).toEqual({ start: '2026-11-02', end: '2026-11-15' })
  })

  it('keeps to 14-day steps across a year end and a leap day', () => {
    expect(moodPeriod('2027-01-01')).toEqual({ start: '2026-12-28', end: '2027-01-10' })
    expect(moodPeriod('2028-02-29')).toEqual({ start: '2028-02-21', end: '2028-03-05' })
    for (const day of ['2026-12-28', '2028-02-21']) expect(new Date(`${day}T00:00:00Z`).getUTCDay()).toBe(1)
  })

  it('works for days before the first period too', () => {
    expect(moodPeriod('2026-10-04')).toEqual({ start: '2026-09-21', end: '2026-10-04' })
  })
})

describe('logsInPeriod', () => {
  const logs = ['2026-10-04', '2026-10-05', '2026-10-12', '2026-10-18', '2026-10-19'].map((date) => ({ date }))

  it('keeps only the moods of the current two weeks', () => {
    expect(logsInPeriod(logs, '2026-10-09').map((l) => l.date)).toEqual(['2026-10-05', '2026-10-12', '2026-10-18'])
  })

  it('is empty again at the start of the next two weeks, until something is recorded', () => {
    expect(logsInPeriod(logs.slice(0, 4), '2026-10-19')).toEqual([])
    expect(logsInPeriod(logs, '2026-10-19').map((l) => l.date)).toEqual(['2026-10-19'])
  })
})
