import { describe, it, expect } from 'vitest'
import { earliestMonth, monthRecap, recapToAnnounce, shiftRecapMonth, type RecapSource } from './recap'

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).getTime()
const OCT = { year: 2026, month: 10 }

function source(over: Partial<RecapSource> = {}): RecapSource {
  return { places: [], doodles: [], notes: [], moods: [], events: [], archive: [], answers: [], balance: [], ...over }
}

describe('monthRecap', () => {
  it('is empty for a month with nothing in it', () => {
    const recap = monthRecap(source(), OCT, '2026-10-14')
    expect(recap.empty).toBe(true)
    expect(recap.mood).toEqual({ A: null, B: null })
  })

  it('lists the places of the month oldest first and counts their areas', () => {
    const recap = monthRecap(source({
      places: [
        { name: '경주', date: '2026-10-20', region: '37020' },
        { name: '부산 광안리', date: '2026-10-03', region: '21' },
        { name: '해운대', date: '2026-10-04', region: '21' },
        { name: '강릉', date: '2026-09-30', region: '32030' },
      ],
    }), OCT, '2026-10-31')
    expect(recap.places).toEqual(['부산 광안리', '해운대', '경주'])
    expect(recap.regions).toBe(2)
    expect(recap.empty).toBe(false)
  })

  it('counts 함께 events only once their day has come', () => {
    const events = [
      { title: '데이트', date: '2026-10-10', owner: 'both' },
      { title: '오늘', date: '2026-10-14', owner: 'both' },
      { title: '다음 주', date: '2026-10-21', owner: 'both' },
      { title: '근무', date: '2026-10-11', owner: 'A' },
    ]
    expect(monthRecap(source({ events }), OCT, '2026-10-14').together).toBe(2)
    expect(monthRecap(source({ events }), OCT, '2026-11-02').together).toBe(3)
  })

  it('counts doodles and notes by the local month they were made in', () => {
    const recap = monthRecap(source({
      doodles: [{ createdAt: at(2026, 10, 1) }, { createdAt: at(2026, 10, 31) }, { createdAt: at(2026, 11, 1) }],
      notes: [{ createdAt: at(2026, 10, 5) }, { createdAt: 'broken' }, null],
    }), OCT, '2026-11-02')
    expect(recap.doodles).toBe(2)
    expect(recap.notes).toBe(1)
  })

  it('counts the days both answered the daily question', () => {
    const recap = monthRecap(source({
      answers: [
        { date: '2026-10-08', sender: 'A', text: 'a' },
        { date: '2026-10-08', sender: 'B', text: 'b' },
        { date: '2026-10-08', sender: 'B', text: 'b2' },
        { date: '2026-10-09', sender: 'A', text: 'a' },
      ],
    }), OCT, '2026-10-14')
    expect(recap.chats).toBe(1)
  })

  it('picks the best-rated review', () => {
    const recap = monthRecap(source({
      archive: [
        { name: '파스타집', rating: 4, date: '2026-10-02' },
        { name: '영화', rating: 5, date: '2026-10-05' },
        { name: '지난달', rating: 5, date: '2026-09-05' },
      ],
    }), OCT, '2026-10-14')
    expect(recap.reviews).toBe(2)
    expect(recap.bestReview).toEqual({ name: '영화', rating: 5 })
  })

  it('averages each person\'s mood to one decimal', () => {
    const recap = monthRecap(source({
      moods: [
        { date: '2026-10-06', who: 'A', value: 9 },
        { date: '2026-10-07', who: 'A', value: 8 },
        { date: '2026-10-08', who: 'A', value: 8 },
        { date: '2026-09-08', who: 'B', value: 2 },
      ],
    }), OCT, '2026-10-14')
    expect(recap.mood).toEqual({ A: 8.3, B: null })
    expect(recap.empty).toBe(false)
  })

  it('counts balance games both picked, and how many matched', () => {
    const recap = monthRecap(source({
      balance: [
        { date: '2026-10-10', who: 'A', pick: 'a' },
        { date: '2026-10-10', who: 'B', pick: 'a' },
        { date: '2026-10-11', who: 'A', pick: 'a' },
        { date: '2026-10-11', who: 'B', pick: 'b' },
        { date: '2026-10-12', who: 'A', pick: 'b' },
      ],
    }), OCT, '2026-10-14')
    expect(recap.balance).toEqual({ played: 2, matched: 1 })
  })
})

describe('earliestMonth', () => {
  it('is the current month when nothing is older', () => {
    expect(earliestMonth(source(), '2026-10-14')).toEqual(OCT)
  })

  it('goes back to the oldest record, dated or made', () => {
    expect(earliestMonth(source({
      places: [{ name: '부산', date: '2026-08-15' }],
      notes: [{ createdAt: at(2026, 7, 2) }],
    }), '2026-10-14')).toEqual({ year: 2026, month: 7 })
  })

  it('ignores records dated after this month', () => {
    expect(earliestMonth(source({ events: [{ date: '2026-12-25' }] }), '2026-10-14')).toEqual(OCT)
  })
})

describe('shiftRecapMonth', () => {
  it('crosses the year', () => {
    expect(shiftRecapMonth({ year: 2027, month: 1 }, -1)).toEqual({ year: 2026, month: 12 })
  })
})

describe('recapToAnnounce', () => {
  it('points at last month during the first week', () => {
    expect(recapToAnnounce('2026-11-01')).toEqual(OCT)
    expect(recapToAnnounce('2026-11-07')).toEqual(OCT)
    expect(recapToAnnounce('2027-01-03')).toEqual({ year: 2026, month: 12 })
  })

  it('is quiet after that', () => {
    expect(recapToAnnounce('2026-11-08')).toBeNull()
  })
})
