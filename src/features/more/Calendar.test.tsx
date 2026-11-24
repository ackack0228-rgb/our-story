import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Calendar } from './Calendar'
import { useEvents } from '../../hooks/useEvents'
import { useReactions } from '../../hooks/useReactions'
import type { Reaction } from '../../lib/reactions'
import type { CalendarEvent, EventInput } from '../../lib/events'

vi.mock('../../hooks/useEvents', () => ({ useEvents: vi.fn() }))
vi.mock('../../hooks/useReactions', () => ({ useReactions: vi.fn() }))
vi.mock('../../hooks/useSession', () => ({
  useSession: () => ({ me: 'A', settings: { nameA: '갑', nameB: '을', startDate: null } }),
}))
let today = '2026-10-06'
vi.mock('../../lib/date', () => ({ todayLocalISODate: () => today }))
afterEach(() => { today = '2026-10-06' })

interface FormProps {
  initial: CalendarEvent | null
  defaultDate: string
  onSave: (input: EventInput) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}
const input: EventInput = { title: '새 일정', date: '2026-10-06', endDate: '', time: '', owner: 'A', note: '' }
vi.mock('./EventFormModal', () => ({
  EventFormModal: ({ initial, defaultDate, onSave, onDelete, onClose }: FormProps) => (
    <div data-testid="form">
      <span>{initial ? `edit:${initial.id}` : `new:${defaultDate}`}</span>
      <button onClick={() => onSave(input)}>mock-save</button>
      {onDelete && <button onClick={() => { onDelete().catch(() => {}) }}>mock-delete</button>}
      <button onClick={onClose}>mock-close</button>
    </div>
  ),
}))

const add = vi.fn()
const update = vi.fn()
const remove = vi.fn()

function ev(over: Partial<CalendarEvent>): CalendarEvent {
  return { id: 'e', title: '약속', date: '2026-10-06', time: '', owner: 'A', note: '', createdBy: 'A', createdAt: 1, ...over }
}
function setEvents(items: CalendarEvent[], error: string | null = null) {
  vi.mocked(useEvents).mockReturnValue({ items, loading: false, error, add, update, remove })
}
const day = (label: string) => screen.getByRole('button', { name: label })

const toggle = vi.fn()
const clearFor = vi.fn()
function react(over: Partial<Reaction>): Reaction {
  return { id: 'r', eventId: 'e', emoji: 'heart', sender: 'B', eventTitle: '약속', createdAt: 1, ...over }
}
function setReactions(items: Reaction[]) {
  vi.mocked(useReactions).mockReturnValue({ items, loading: false, error: null, toggle, clearFor })
}
const reaction = (label: string) => screen.getByRole('button', { name: label })

// Titles also appear, clipped, under their date in the month grid; this picks the one in the day list.
const LISTED = { ignore: '[data-owner]' }

describe('Calendar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setEvents([])
    setReactions([])
    toggle.mockResolvedValue(undefined)
    clearFor.mockResolvedValue(undefined)
    remove.mockResolvedValue(undefined)
  })

  it('opens on this month with today selected', () => {
    render(<Calendar />)
    expect(screen.getByRole('button', { name: '2026년 10월' })).toBeInTheDocument()
    expect(day('10월 6일')).toHaveAttribute('aria-pressed', 'true')
    expect(day('10월 7일')).toHaveAttribute('aria-pressed', 'false')
    expect(day('10월 31일')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '10월 32일' })).not.toBeInTheDocument()
  })

  it('moves between months, across the year end, and comes back on the month name', async () => {
    render(<Calendar />)
    await userEvent.click(screen.getByRole('button', { name: '다음 달' }))
    await userEvent.click(screen.getByRole('button', { name: '다음 달' }))
    await userEvent.click(screen.getByRole('button', { name: '다음 달' }))
    expect(screen.getByRole('button', { name: '2027년 1월' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '이전 달' }))
    expect(screen.getByRole('button', { name: '2026년 12월' })).toBeInTheDocument()
    await userEvent.click(day('12월 25일'))
    await userEvent.click(screen.getByRole('button', { name: '2026년 12월' }))
    expect(screen.getByRole('button', { name: '2026년 10월' })).toBeInTheDocument()
    expect(day('10월 6일')).toHaveAttribute('aria-pressed', 'true')
  })

  it('says so when the selected day has nothing', () => {
    render(<Calendar />)
    expect(screen.getByText('이 날은 일정이 없어요')).toBeInTheDocument()
  })

  it('lists the selected day in order, with time, owner and note', async () => {
    setEvents([
      ev({ id: 'allday', title: '휴가', owner: 'B', date: '2026-10-12' }),
      ev({ id: 'dinner', title: '저녁 약속', time: '19:00', owner: 'both', note: '강남역', date: '2026-10-12' }),
      ev({ id: 'today', title: '오늘 일정' }),
    ])
    render(<Calendar />)
    expect(screen.getByText('오늘 일정', LISTED)).toBeInTheDocument()
    await userEvent.click(day('10월 12일'))
    expect(screen.queryByText('오늘 일정', LISTED)).not.toBeInTheDocument()
    const rows = screen.getAllByTestId('event-row')
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText('19:00')).toBeInTheDocument()
    expect(within(rows[0]).getByText('저녁 약속')).toBeInTheDocument()
    expect(within(rows[0]).getByText('우리')).toBeInTheDocument()
    expect(within(rows[0]).getByText('강남역')).toBeInTheDocument()
    expect(within(rows[1]).getByText('하루 종일')).toBeInTheDocument()
    expect(within(rows[1]).getByText('을')).toBeInTheDocument()
    expect(screen.queryByText('이 날은 일정이 없어요')).not.toBeInTheDocument()
  })

  it('shows up to two event titles under a date, marked by whose they are, and counts the rest', () => {
    setEvents([
      ev({ id: '1', title: '회식', date: '2026-10-12', owner: 'A', time: '18:00' }),
      ev({ id: '2', title: '영화', date: '2026-10-12', owner: 'both', time: '20:00' }),
      ev({ id: '3', title: '야식', date: '2026-10-12', owner: 'A', time: '23:00' }),
      ev({ id: '4', title: '근무', date: '2026-10-13', owner: 'B' }),
    ])
    render(<Calendar />)
    const twelfth = day('10월 12일')
    const chips = [...twelfth.querySelectorAll('[data-owner]')]
    expect(chips.map((c) => [c.getAttribute('data-owner'), c.textContent])).toEqual([['A', '회식'], ['both', '영화']])
    expect(twelfth).toHaveTextContent('+1')
    const thirteenth = day('10월 13일')
    expect(thirteenth.querySelector('[data-owner="B"]')).toHaveTextContent('근무')
    expect(thirteenth).not.toHaveTextContent('+')
    expect(day('10월 14일').querySelector('[data-owner]')).toBeNull()
  })

  it('says whose colour is whose', () => {
    setEvents([])
    render(<Calendar />)
    for (const name of ['갑', '을', '함께']) expect(screen.getByText(name)).toBeInTheDocument()
  })

  it('shows the load error', () => {
    setEvents([], '데이터를 불러오지 못했어요.')
    render(<Calendar />)
    expect(screen.getByText('데이터를 불러오지 못했어요.')).toBeInTheDocument()
  })

  it('opens an empty form for the selected day and adds through it', async () => {
    render(<Calendar />)
    expect(screen.queryByTestId('form')).not.toBeInTheDocument()
    await userEvent.click(day('10월 9일'))
    await userEvent.click(screen.getByRole('button', { name: '+ 일정 추가' }))
    expect(screen.getByText('new:2026-10-09')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'mock-save' }))
    expect(add).toHaveBeenCalledWith(input)
    await userEvent.click(screen.getByRole('button', { name: 'mock-close' }))
    expect(screen.queryByTestId('form')).not.toBeInTheDocument()
  })

  it('opens an event for editing, and updates or removes that one', async () => {
    setEvents([ev({ id: 'dinner', title: '저녁 약속' })])
    render(<Calendar />)
    await userEvent.click(screen.getByText('저녁 약속', LISTED))
    expect(screen.getByText('edit:dinner')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'mock-save' }))
    expect(update).toHaveBeenCalledWith('dinner', input)
    await userEvent.click(screen.getByRole('button', { name: 'mock-delete' }))
    expect(remove).toHaveBeenCalledWith('dinner')
    expect(add).not.toHaveBeenCalled()
  })

  it('puts heart, thumb and cheer under each event, showing who pressed and which are mine', () => {
    setEvents([ev({})])
    setReactions([react({ id: '1', emoji: 'heart', sender: 'B' }), react({ id: '2', emoji: 'heart', sender: 'A' }), react({ id: '3', emoji: 'cheer', sender: 'B' })])
    render(<Calendar />)
    expect(reaction('❤️ 반응')).toHaveTextContent('갑 을')
    expect(reaction('❤️ 반응')).toHaveAttribute('aria-pressed', 'true')
    expect(reaction('👍 반응')).toHaveAttribute('aria-pressed', 'false')
    expect(reaction('👍 반응')).toHaveTextContent(/^👍$/)
    expect(reaction('💪 반응')).toHaveTextContent('을')
    expect(reaction('💪 반응')).toHaveAttribute('aria-pressed', 'false')
  })

  it('reacts to the event without opening the edit form', async () => {
    setEvents([ev({ id: 'dinner', title: '저녁 약속' })])
    render(<Calendar />)
    await userEvent.click(reaction('💪 반응'))
    expect(toggle).toHaveBeenCalledWith(expect.objectContaining({ id: 'dinner', title: '저녁 약속' }), 'cheer')
    expect(screen.queryByTestId('form')).not.toBeInTheDocument()
  })

  it('keeps each event’s reactions with that event', () => {
    setEvents([ev({ id: 'a', title: '첫째' }), ev({ id: 'b', title: '둘째', createdAt: 2 })])
    setReactions([react({ eventId: 'b', emoji: 'thumb', sender: 'B' })])
    render(<Calendar />)
    const [first, second] = screen.getAllByRole('button', { name: '👍 반응' })
    expect(first).toHaveTextContent(/^👍$/)
    expect(second).toHaveTextContent('을')
  })

  it('ignores a second tap while the first reaction is still being saved', async () => {
    let finish: () => void = () => {}
    toggle.mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve }))
    setEvents([ev({})])
    render(<Calendar />)
    await userEvent.click(reaction('❤️ 반응'))
    await userEvent.click(reaction('❤️ 반응'))
    await userEvent.click(reaction('👍 반응'))
    expect(toggle).toHaveBeenCalledTimes(1)
    finish()
    await waitFor(() => expect(reaction('❤️ 반응')).toBeEnabled())
  })

  it('says so when a reaction could not be saved, and lets me try again', async () => {
    toggle.mockRejectedValueOnce(new Error('denied'))
    setEvents([ev({})])
    render(<Calendar />)
    await userEvent.click(reaction('❤️ 반응'))
    expect(await screen.findByText('반응을 남기지 못했어요. 다시 시도해주세요.')).toBeInTheDocument()
    await userEvent.click(reaction('❤️ 반응'))
    expect(toggle).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(screen.queryByText('반응을 남기지 못했어요. 다시 시도해주세요.')).not.toBeInTheDocument())
  })

  it('removes an event’s reactions along with the event', async () => {
    setEvents([ev({ id: 'dinner' })])
    render(<Calendar />)
    await userEvent.click(screen.getByTestId('event-row'))
    await userEvent.click(screen.getByRole('button', { name: 'mock-delete' }))
    expect(remove).toHaveBeenCalledWith('dinner')
    await waitFor(() => expect(clearFor).toHaveBeenCalledWith('dinner'))
  })

  it('keeps the reactions when deleting the event failed', async () => {
    remove.mockRejectedValueOnce(new Error('denied'))
    setEvents([ev({ id: 'dinner' })])
    render(<Calendar />)
    await userEvent.click(screen.getByTestId('event-row'))
    await userEvent.click(screen.getByRole('button', { name: 'mock-delete' }))
    expect(remove).toHaveBeenCalledWith('dinner')
    expect(clearFor).not.toHaveBeenCalled()
  })

  it('moves on with the date when the app stays open past midnight', async () => {
    setEvents([])
    const view = render(<Calendar />)
    expect(screen.getByRole('button', { name: '10월 6일' })).toHaveAttribute('aria-pressed', 'true')
    today = '2026-11-01'
    view.rerender(<Calendar />)
    expect(screen.getByRole('button', { name: '11월 1일' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: '+ 일정 추가' }))
    expect(screen.getByText('new:2026-11-01')).toBeInTheDocument()
  })

  it('keeps a day I picked myself when the date changes', async () => {
    setEvents([])
    const view = render(<Calendar />)
    await userEvent.click(screen.getByRole('button', { name: '10월 20일' }))
    today = '2026-10-07'
    view.rerender(<Calendar />)
    expect(screen.getByRole('button', { name: '10월 20일' })).toHaveAttribute('aria-pressed', 'true')
  })
})
