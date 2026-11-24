import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MoodTracker } from './MoodTracker'
import { todayLocalISODate } from '../../lib/date'
import { moodPeriod } from '../../lib/moodLogs'

const saveToday = vi.fn().mockResolvedValue(undefined)
let mockLogs: Array<{ id: string; date: string; value: number; who: string; createdAt: number }> = []

vi.mock('../../hooks/useMoodLogs', () => ({
  useMoodLogs: () => ({ logs: mockLogs, loading: false, saveToday }),
}))
vi.mock('../../hooks/useSession', () => ({
  useSession: () => ({ me: 'A', settings: { nameA: '나', nameB: '상대방', startDate: null } }),
}))

describe('MoodTracker', () => {
  it('shows the legend with both display names', () => {
    render(<MoodTracker />)
    expect(screen.getByText('나')).toBeInTheDocument()
    expect(screen.getByText('상대방')).toBeInTheDocument()
  })

  it('saves the current slider value when the button is clicked', async () => {
    mockLogs = []
    render(<MoodTracker />)
    const slider = screen.getByRole('slider')
    fireEventChange(slider, '8')
    await userEvent.click(screen.getByRole('button', { name: /오늘 기분 기록하기/ }))
    expect(saveToday).toHaveBeenCalledWith(8)
  })

  it('initializes the slider from a value already saved today', () => {
    mockLogs = [{ id: 'x', date: todayLocalISODate(), value: 9, who: 'A', createdAt: 1 }]
    render(<MoodTracker />)
    expect(screen.getByRole('slider')).toHaveValue('9')
    mockLogs = []
  })

  it('confirms that the mood was saved', async () => {
    mockLogs = []
    render(<MoodTracker />)
    await userEvent.click(screen.getByRole('button', { name: /오늘 기분 기록하기/ }))
    expect(await screen.findByText(/기록했어요/)).toBeInTheDocument()
  })

  it("shows each person's mood for today even before there is a graph", () => {
    const today = todayLocalISODate()
    mockLogs = [
      { id: 'a', date: today, value: 9, who: 'A', createdAt: 1 },
      { id: 'b', date: today, value: 3, who: 'B', createdAt: 2 },
    ]
    render(<MoodTracker />)
    expect(screen.getByText('😆 9')).toBeInTheDocument()
    expect(screen.getByText('😕 3')).toBeInTheDocument()
    mockLogs = []
  })

  it('draws the graph from the first recorded day', () => {
    mockLogs = []
    const { unmount } = render(<MoodTracker />)
    expect(screen.getByText(/기록하면 그래프가 나타나요/)).toBeInTheDocument()
    unmount()

    mockLogs = [{ id: 'a', date: todayLocalISODate(), value: 9, who: 'A', createdAt: 1 }]
    render(<MoodTracker />)
    expect(screen.queryByText(/그래프가/)).not.toBeInTheDocument()
    mockLogs = []
  })

  it('shows an error message when saving fails', async () => {
    mockLogs = []
    saveToday.mockRejectedValueOnce(new Error('denied'))
    render(<MoodTracker />)
    await userEvent.click(screen.getByRole('button', { name: /오늘 기분 기록하기/ }))
    expect(await screen.findByText(/저장하지 못했어요/)).toBeInTheDocument()
  })

  it('ignores a second tap while the first save is still going', async () => {
    mockLogs = []
    saveToday.mockClear()
    let finish: () => void = () => {}
    saveToday.mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve }))
    render(<MoodTracker />)
    const button = screen.getByRole('button', { name: /오늘 기분 기록하기/ })
    await userEvent.click(button)
    expect(button).toBeDisabled()
    await userEvent.click(button)
    expect(saveToday).toHaveBeenCalledTimes(1)
    finish()
    expect(await screen.findByText('오늘 기분을 기록했어요 ✓')).toBeInTheDocument()
    expect(button).toBeEnabled()
  })
})

function fireEventChange(el: HTMLElement, value: string) {
  const input = el as HTMLInputElement
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
  setter.call(input, value)
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

describe('MoodTracker graph period', () => {
  it('shows which two weeks the graph covers', () => {
    mockLogs = []
    render(<MoodTracker />)
    const { start, end } = moodPeriod(todayLocalISODate())
    const short = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`
    expect(screen.getByText(`${short(start)} ~ ${short(end)}`)).toBeInTheDocument()
    expect(screen.getByText('그래프는 2주마다 새로 시작해요')).toBeInTheDocument()
  })

  it('starts the graph over when moods are only from before these two weeks', () => {
    const { start } = moodPeriod(todayLocalISODate())
    const before = new Date(`${start}T00:00:00Z`)
    before.setUTCDate(before.getUTCDate() - 1)
    mockLogs = [{ id: 'old', date: before.toISOString().slice(0, 10), value: 9, who: 'A', createdAt: 1 }]
    render(<MoodTracker />)
    expect(screen.getByText(/기록하면 그래프가 나타나요/)).toBeInTheDocument()
    mockLogs = []
  })
})
