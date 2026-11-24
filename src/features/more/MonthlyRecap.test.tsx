import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MonthlyRecap } from './MonthlyRecap'
import { useRecapSource } from '../../hooks/useRecapSource'
import type { RecapSource } from '../../lib/recap'

vi.mock('../../hooks/useRecapSource', () => ({ useRecapSource: vi.fn() }))
vi.mock('../../hooks/useSession', () => ({
  useSession: () => ({ me: 'A', settings: { nameA: '갑', nameB: '을', startDate: null } }),
}))
vi.mock('../../lib/date', async (original) => ({
  ...(await original<typeof import('../../lib/date')>()),
  todayLocalISODate: () => '2026-10-14',
}))

function setSource(over: Partial<RecapSource> = {}) {
  vi.mocked(useRecapSource).mockReturnValue({
    source: { places: [], doodles: [], notes: [], moods: [], events: [], archive: [], answers: [], balance: [], ...over },
    loading: false,
    error: null,
  })
}

const tile = (label: string) => screen.getAllByTestId('recap-tile').find((t) => t.textContent?.includes(label))

describe('MonthlyRecap', () => {
  beforeEach(() => setSource())

  it('opens on the current month and says it is still going', () => {
    render(<MonthlyRecap />)
    expect(screen.getByText('2026년 10월')).toBeInTheDocument()
    expect(screen.getByText('10월의 우리')).toBeInTheDocument()
    expect(screen.getByText(/아직 진행 중이에요 · 10\/14까지/)).toBeInTheDocument()
  })

  it('says so when the month has nothing', () => {
    render(<MonthlyRecap />)
    expect(screen.getByText('이 달에는 남긴 기록이 없어요')).toBeInTheDocument()
    expect(screen.queryByTestId('recap-tile')).not.toBeInTheDocument()
  })

  it('shows the month in numbers and lines', () => {
    setSource({
      places: [{ name: '부산 광안리', date: '2026-10-03', region: '21' }],
      events: [{ title: '데이트', date: '2026-10-10', owner: 'both' }, { title: '데이트2', date: '2026-10-12', owner: 'both' }],
      moods: [{ date: '2026-10-06', who: 'A', value: 9 }, { date: '2026-10-06', who: 'B', value: 8 }],
      archive: [{ name: '파스타집', rating: 5, date: '2026-10-05' }],
      balance: [{ date: '2026-10-10', who: 'A', pick: 'a' }, { date: '2026-10-10', who: 'B', pick: 'a' }],
    })
    render(<MonthlyRecap />)
    expect(tile('다녀온 곳')).toHaveTextContent('1곳')
    expect(tile('함께한 일정')).toHaveTextContent('2번')
    expect(tile('낙서')).toHaveTextContent('0개')
    expect(screen.getByText('부산 광안리')).toBeInTheDocument()
    expect(screen.getByText('갑 9 · 을 8')).toBeInTheDocument()
    expect(screen.getByText('파스타집 ★★★★★')).toBeInTheDocument()
    expect(screen.getByText('1번 중 1번 통했어요')).toBeInTheDocument()
  })

  it('cannot go past the current month or before the first record', () => {
    render(<MonthlyRecap />)
    expect(screen.getByRole('button', { name: '다음 달' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '이전 달' })).toBeDisabled()
  })

  it('steps back to an earlier month with records, and forward again', async () => {
    setSource({ places: [{ name: '강릉', date: '2026-09-20', region: '32030' }] })
    render(<MonthlyRecap />)
    await userEvent.click(screen.getByRole('button', { name: '이전 달' }))
    expect(screen.getByText('2026년 9월')).toBeInTheDocument()
    expect(screen.getByText('한 달 동안 이렇게 지냈어요')).toBeInTheDocument()
    expect(screen.getByText('강릉')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '이전 달' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: '다음 달' }))
    expect(screen.getByText('2026년 10월')).toBeInTheDocument()
  })

  it('opens on the month it was sent to', () => {
    setSource({ places: [{ name: '강릉', date: '2026-09-20' }] })
    render(<MonthlyRecap startAt={{ year: 2026, month: 9 }} />)
    expect(screen.getByText('9월의 우리')).toBeInTheDocument()
  })

  it('says when the data could not be loaded', () => {
    vi.mocked(useRecapSource).mockReturnValue({
      source: { places: [], doodles: [], notes: [], moods: [], events: [], archive: [], answers: [], balance: [] },
      loading: false,
      error: 'x',
    })
    render(<MonthlyRecap />)
    expect(screen.getByText('인터넷 연결을 확인해 주세요. 연결되면 바로 다시 불러와요.')).toBeInTheDocument()
  })
})
