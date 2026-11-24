import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { useReactions } from '../../hooks/useReactions'
import type { Reaction } from '../../lib/reactions'
import { render, screen } from '@testing-library/react'
import { UpcomingEvents } from './UpcomingEvents'
import { useEvents } from '../../hooks/useEvents'
import type { CalendarEvent } from '../../lib/events'

vi.mock('../../hooks/useEvents', () => ({ useEvents: vi.fn() }))
vi.mock('../../hooks/useReactions', () => ({ useReactions: vi.fn() }))
vi.mock('../../hooks/useSession', () => ({
  useSession: () => ({ me: 'A', settings: { nameA: '갑', nameB: '을', startDate: null } }),
}))
let today = '2026-10-06'
vi.mock('../../lib/date', () => ({ todayLocalISODate: () => today }))
afterEach(() => { today = '2026-10-06' })

function ev(over: Partial<CalendarEvent>): CalendarEvent {
  return { id: 'e', title: '약속', date: '2026-10-12', time: '', owner: 'A', note: '', createdBy: 'A', createdAt: 1, ...over }
}
function setEvents(items: CalendarEvent[]) {
  vi.mocked(useEvents).mockReturnValue({ items, loading: false, error: null, add: vi.fn(), update: vi.fn(), remove: vi.fn() })
}
const lines = () => screen.getAllByTestId('upcoming-row').map((el) => el.textContent)
function setReactions(items: Reaction[]) {
  vi.mocked(useReactions).mockReturnValue({ items, loading: false, error: null, toggle: vi.fn(), clearFor: vi.fn() })
}

describe('UpcomingEvents', () => {
  beforeEach(() => setReactions([]))

  it('shows the reactions an event has received, to look at only', () => {
    setEvents([ev({ id: 'a', title: '회식', date: '2026-10-06' }), ev({ id: 'b', title: '시험', date: '2026-10-07' })])
    setReactions([
      { id: '1', eventId: 'a', emoji: 'cheer', sender: 'B', createdAt: 1 },
      { id: '2', eventId: 'a', emoji: 'heart', sender: 'A', createdAt: 2 },
    ])
    render(<UpcomingEvents />)
    expect(lines()).toEqual(['오늘회식 · 갑❤️💪', '내일시험 · 갑'])
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders nothing when no event is ahead', () => {
    setEvents([ev({ date: '2026-10-05' })])
    render(<UpcomingEvents />)
    expect(screen.queryByTestId('upcoming-events')).toBeNull()
  })

  it('shows date, weekday, time, title and whose it is', () => {
    setEvents([ev({ title: '저녁 약속', time: '19:00', owner: 'B' })])
    render(<UpcomingEvents />)
    expect(screen.getByText('📅 다가오는 일정')).toBeInTheDocument()
    expect(lines()).toEqual(['10/12 (월) 19:00저녁 약속 · 을'])
  })

  it('says 오늘 and 내일, and leaves the time off all-day events', () => {
    setEvents([
      ev({ id: 'tomorrow', title: '시험', date: '2026-10-07', owner: 'both' }),
      ev({ id: 'today', title: '회식', date: '2026-10-06', time: '18:30' }),
    ])
    render(<UpcomingEvents />)
    expect(lines()).toEqual(['오늘 18:30회식 · 갑', '내일시험 · 우리'])
  })

  it('shows at most three, nearest first', () => {
    setEvents(['2026-10-20', '2026-10-08', '2026-10-15', '2026-10-09'].map((date) => ev({ id: date, title: date, date })))
    render(<UpcomingEvents />)
    const rows = screen.getAllByTestId('upcoming-row')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent('2026-10-08')
    expect(rows[2]).toHaveTextContent('2026-10-15')
  })

  it('moves on with the date when the app stays open past midnight', () => {
    setEvents([ev({ id: 'a', title: '회식', date: '2026-10-06' }), ev({ id: 'b', title: '시험', date: '2026-10-07' })])
    const view = render(<UpcomingEvents />)
    expect(lines()).toEqual(['오늘회식 · 갑', '내일시험 · 갑'])
    today = '2026-10-07'
    view.rerender(<UpcomingEvents />)
    expect(lines()).toEqual(['오늘시험 · 갑'])
  })
})
