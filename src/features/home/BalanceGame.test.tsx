import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BalanceGame } from './BalanceGame'
import { useBalance } from '../../hooks/useBalance'

vi.mock('../../hooks/useBalance', () => ({ useBalance: vi.fn() }))
vi.mock('../../hooks/useSession', () => ({
  useSession: () => ({ me: 'A', settings: { nameA: '갑', nameB: '을', startDate: null } }),
}))
vi.mock('../../lib/date', async (original) => ({
  ...(await original<typeof import('../../lib/date')>()),
  todayLocalISODate: () => '2026-10-14',
}))

const pick = vi.fn()
const TODAY = { date: '2026-10-14', a: '바다 여행', b: '산 여행', createdAt: 1 }
function setPicks(items: object[], error: string | null = null) {
  vi.mocked(useBalance).mockReturnValue({ items: items as never, loading: false, error, pick })
}
const sea = () => screen.getByRole('button', { name: /바다 여행/ })
const mountain = () => screen.getByRole('button', { name: /산 여행/ })

describe('BalanceGame', () => {
  beforeEach(() => {
    pick.mockReset().mockResolvedValue(undefined)
    // The other person's pick carries today's two choices, as every saved pick does.
    setPicks([{ id: 'b', who: 'B', pick: 'b', ...TODAY }])
  })

  it('keeps the other person\'s pick hidden until I pick', () => {
    render(<BalanceGame />)
    expect(screen.getByText('을이 골랐어요 · 고르면 볼 수 있어요')).toBeInTheDocument()
    expect(mountain()).not.toHaveTextContent('을')
    expect(sea()).toBeEnabled()
  })

  it('saves my pick', async () => {
    render(<BalanceGame />)
    await userEvent.click(sea())
    expect(pick).toHaveBeenCalledWith('a')
  })

  it('locks both choices once I have picked, and waits', () => {
    setPicks([{ id: 'a', who: 'A', pick: 'a', ...TODAY }])
    render(<BalanceGame />)
    expect(sea()).toBeDisabled()
    expect(mountain()).toBeDisabled()
    expect(sea()).toHaveAttribute('aria-pressed', 'true')
    expect(sea()).toHaveTextContent('갑')
    expect(screen.getByText('을의 선택을 기다리는 중')).toBeInTheDocument()
  })

  it('shows who picked what once both have picked', () => {
    setPicks([{ id: 'a', who: 'A', pick: 'a', ...TODAY }, { id: 'b', who: 'B', pick: 'b', ...TODAY }])
    render(<BalanceGame />)
    expect(sea()).toHaveTextContent('갑')
    expect(mountain()).toHaveTextContent('을')
    expect(screen.getByText('이번엔 달랐어요 😆')).toBeInTheDocument()
  })

  it('celebrates the same pick', () => {
    setPicks([{ id: 'a', who: 'A', pick: 'b', ...TODAY }, { id: 'b', who: 'B', pick: 'b', ...TODAY }])
    render(<BalanceGame />)
    expect(mountain()).toHaveTextContent('갑 · 을')
    expect(screen.getByText('통했어요! 🎉')).toBeInTheDocument()
  })

  it('says so when the pick could not be saved, and lets me try again', async () => {
    pick.mockRejectedValueOnce(new Error('denied'))
    render(<BalanceGame />)
    await userEvent.click(sea())
    expect(await screen.findByText('저장하지 못했어요. 다시 시도해주세요.')).toBeInTheDocument()
    expect(sea()).toBeEnabled()
  })

  it('folds out earlier games', async () => {
    const day = { date: '2026-10-13', a: '찍먹', b: '부먹', createdAt: 1 }
    setPicks([{ id: '1', who: 'A', pick: 'a', ...day }, { id: '2', who: 'B', pick: 'b', ...day }])
    render(<BalanceGame />)
    expect(screen.queryByTestId('past-game')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '지난 게임 1번 보기' }))
    expect(screen.getByTestId('past-game')).toHaveTextContent('10/13갑 찍먹 · 을 부먹😆')
  })

  it('has no earlier-games button before there are any', () => {
    setPicks([])
    render(<BalanceGame />)
    expect(screen.queryByRole('button', { name: /지난 게임/ })).not.toBeInTheDocument()
    expect(screen.getByText('하나를 골라 보세요')).toBeInTheDocument()
  })
})
