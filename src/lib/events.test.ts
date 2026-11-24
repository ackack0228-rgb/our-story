import { describe, it, expect } from 'vitest'
import {
  dateSpan, dayLabel, eventEnd, whenLabel, eventsOn, eventTime, isCalendarEvent, monthGrid, ownerLabel, dayPreview, shiftMonth, upcomingEvents,
  type CalendarEvent,
} from './events'

function ev(over: Partial<CalendarEvent>): CalendarEvent {
  return { id: 'e', title: '약속', date: '2026-10-12', time: '', owner: 'A', note: '', createdBy: 'A', createdAt: 1, ...over }
}

describe('monthGrid', () => {
  it('starts on Sunday and pads the first week', () => {
    const grid = monthGrid(2026, 10) // 1 Oct 2026 is a Thursday
    expect(grid.slice(0, 5)).toEqual([null, null, null, null, '2026-10-01'])
    expect(grid).toHaveLength(35)
    expect(grid.filter(Boolean)).toHaveLength(31)
    expect(grid[grid.length - 1]).toBe('2026-10-31')
  })
  it('needs no padding when the month fills whole weeks', () => {
    const grid = monthGrid(2026, 2) // 1 Feb 2026 is a Sunday, 28 days
    expect(grid).toHaveLength(28)
    expect(grid[0]).toBe('2026-02-01')
  })
  it('gives February 29 days in a leap year', () => {
    expect(monthGrid(2024, 2).filter(Boolean)).toHaveLength(29)
    expect(monthGrid(2025, 2).filter(Boolean)).toHaveLength(28)
  })
  it('always returns whole weeks', () => {
    for (let m = 1; m <= 12; m++) expect(monthGrid(2026, m).length % 7).toBe(0)
  })
})

describe('shiftMonth', () => {
  it('rolls the year over in both directions', () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 })
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 })
    expect(shiftMonth(2026, 10, 1)).toEqual({ year: 2026, month: 11 })
  })
})

describe('isCalendarEvent', () => {
  it('accepts a well-formed event', () => {
    expect(isCalendarEvent(ev({}))).toBe(true)
    expect(isCalendarEvent(ev({ owner: 'both' }))).toBe(true)
  })
  it('rejects rows without a usable date, title or owner', () => {
    expect(isCalendarEvent(null)).toBe(false)
    expect(isCalendarEvent({})).toBe(false)
    expect(isCalendarEvent({ ...ev({}), date: '10/12' })).toBe(false)
    expect(isCalendarEvent({ ...ev({}), date: undefined })).toBe(false)
    expect(isCalendarEvent({ ...ev({}), owner: 'C' })).toBe(false)
    expect(isCalendarEvent({ ...ev({}), title: 7 })).toBe(false)
  })
})

describe('eventTime', () => {
  it('is the time, or empty for all-day and malformed values', () => {
    expect(eventTime(ev({ time: '19:00' }))).toBe('19:00')
    expect(eventTime(ev({ time: '' }))).toBe('')
    expect(eventTime({ ...ev({}), time: undefined } as unknown as CalendarEvent)).toBe('')
    expect(eventTime(ev({ time: '7pm' }))).toBe('')
  })
})

describe('eventsOn', () => {
  it('returns only that day, timed first in time order, then all-day, then by creation', () => {
    const events = [
      ev({ id: 'allday2', createdAt: 5 }),
      ev({ id: 'late', time: '19:00', createdAt: 1 }),
      ev({ id: 'allday1', createdAt: 2 }),
      ev({ id: 'early', time: '09:30', createdAt: 9 }),
      ev({ id: 'other', date: '2026-10-13', time: '08:00' }),
      ev({ id: 'early2', time: '09:30', createdAt: 10 }),
    ]
    expect(eventsOn(events, '2026-10-12').map((e) => e.id)).toEqual(['early', 'early2', 'late', 'allday1', 'allday2'])
  })
  it('is empty for a day with nothing', () => {
    expect(eventsOn([ev({})], '2026-10-01')).toEqual([])
  })
  it('does not reorder the array it was given', () => {
    const events = [ev({ id: 'b', time: '10:00' }), ev({ id: 'a', time: '09:00' })]
    eventsOn(events, '2026-10-12')
    expect(events.map((e) => e.id)).toEqual(['b', 'a'])
  })
})

describe('upcomingEvents', () => {
  const today = '2026-10-06'
  it('includes today, drops the past, and sorts by date then time', () => {
    const events = [
      ev({ id: 'next', date: '2026-10-12', time: '19:00' }),
      ev({ id: 'past', date: '2026-10-05' }),
      ev({ id: 'todayAllDay', date: today }),
      ev({ id: 'todayEarly', date: today, time: '00:10' }),
      ev({ id: 'newYear', date: '2027-01-01' }),
    ]
    expect(upcomingEvents(events, today, 10).map((e) => e.id)).toEqual(['todayEarly', 'todayAllDay', 'next', 'newYear'])
  })
  it('stops at the limit', () => {
    const events = ['2026-10-09', '2026-10-07', '2026-10-08', '2026-10-10'].map((date) => ev({ id: date, date }))
    expect(upcomingEvents(events, today, 3).map((e) => e.id)).toEqual(['2026-10-07', '2026-10-08', '2026-10-09'])
  })
  it('is empty when nothing is ahead', () => {
    expect(upcomingEvents([ev({ date: '2026-01-01' })], today, 3)).toEqual([])
  })
})

describe('dayPreview', () => {
  const events = [
    ev({ id: 'late', title: '저녁', time: '19:00' }),
    ev({ id: 'allday', title: '휴가' }),
    ev({ id: 'early', title: '아침', time: '08:00' }),
    ev({ id: 'other', title: '다른 날', date: '2026-10-13' }),
  ]
  it('shows the first events of that day in the day order and counts the rest', () => {
    const { shown, more } = dayPreview(events, '2026-10-12', 2)
    expect(shown.map((e) => e.id)).toEqual(eventsOn(events, '2026-10-12').slice(0, 2).map((e) => e.id))
    expect(more).toBe(1)
  })
  it('has nothing more when they all fit', () => {
    expect(dayPreview(events, '2026-10-13', 2)).toEqual({ shown: [events[3]], more: 0 })
  })
  it('is empty on a day without events', () => {
    expect(dayPreview(events, '2026-10-14', 2)).toEqual({ shown: [], more: 0 })
  })
})

describe('dayLabel', () => {
  it('says 오늘 and 내일', () => {
    expect(dayLabel('2026-10-06', '2026-10-06')).toBe('오늘')
    expect(dayLabel('2026-10-07', '2026-10-06')).toBe('내일')
  })
  it('finds tomorrow across a month and a year end', () => {
    expect(dayLabel('2026-11-01', '2026-10-31')).toBe('내일')
    expect(dayLabel('2027-01-01', '2026-12-31')).toBe('내일')
  })
  it('otherwise shows month/day and the weekday', () => {
    expect(dayLabel('2026-10-12', '2026-10-06')).toBe('10/12 (월)')
    expect(dayLabel('2027-01-03', '2026-10-06')).toBe('1/3 (일)')
  })
})

describe('ownerLabel', () => {
  it('is the person\'s name, or 우리 for both', () => {
    const names = { nameA: '갑', nameB: '을' }
    expect(ownerLabel('A', names)).toBe('갑')
    expect(ownerLabel('B', names)).toBe('을')
    expect(ownerLabel('both', names)).toBe('우리')
  })
})

describe('여러 날 일정 (endDate)', () => {
  const trip = ev({ id: 'trip', title: '여행', date: '2026-11-04', endDate: '2026-11-07' })

  it('ends on its own date when endDate is missing, malformed or not after the start', () => {
    expect(eventEnd(trip)).toBe('2026-11-07')
    expect(eventEnd(ev({ date: '2026-11-04' }))).toBe('2026-11-04')
    expect(eventEnd(ev({ date: '2026-11-04', endDate: '' }))).toBe('2026-11-04')
    expect(eventEnd(ev({ date: '2026-11-04', endDate: '11/7' }))).toBe('2026-11-04')
    expect(eventEnd(ev({ date: '2026-11-04', endDate: '2026-11-02' }))).toBe('2026-11-04')
  })

  it('shows on every day from start to end', () => {
    for (const d of ['2026-11-04', '2026-11-05', '2026-11-07']) expect(eventsOn([trip], d).map((e) => e.id)).toEqual(['trip'])
    expect(eventsOn([trip], '2026-11-03')).toEqual([])
    expect(eventsOn([trip], '2026-11-08')).toEqual([])
    expect(dayPreview([trip], '2026-11-06', 2).shown.map((e) => e.id)).toEqual(['trip'])
  })

  it('stays upcoming until its last day', () => {
    expect(upcomingEvents([trip], '2026-11-06', 3).map((e) => e.id)).toEqual(['trip'])
    expect(upcomingEvents([trip], '2026-11-08', 3)).toEqual([])
  })

  it('labels the span, or nothing for a one-day event', () => {
    expect(dateSpan(trip)).toBe('11/4 ~ 11/7 · 4일')
    expect(dateSpan(ev({ date: '2026-12-31', endDate: '2027-01-01' }))).toBe('12/31 ~ 1/1 · 2일')
    expect(dateSpan(ev({ date: '2026-11-04' }))).toBe('')
  })
})

describe('whenLabel', () => {
  const today = '2026-11-05'
  it('is the day label for a one-day event', () => {
    expect(whenLabel(ev({ date: today }), today)).toBe('오늘')
  })
  it('adds the last day for a multi-day one, and starts from 오늘 once it is under way', () => {
    expect(whenLabel(ev({ date: '2026-11-06', endDate: '2026-11-08' }), today)).toBe('내일 ~ 11/8')
    expect(whenLabel(ev({ date: '2026-11-04', endDate: '2026-11-07' }), today)).toBe('오늘 ~ 11/7')
  })
})

describe('여러 날 일정의 순서', () => {
  it('puts multi-day events first in a day, so the strip keeps its line across the days', () => {
    const dinner = ev({ id: 'dinner', date: '2026-11-05', time: '19:00', createdAt: 1 })
    const trip = ev({ id: 'trip', date: '2026-11-04', endDate: '2026-11-07', createdAt: 2 })
    expect(eventsOn([dinner, trip], '2026-11-05').map((e) => e.id)).toEqual(['trip', 'dinner'])
  })
})
