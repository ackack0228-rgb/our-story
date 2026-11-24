import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { PokeButton, POKE_COOLDOWN_MS } from './PokeButton'

const send = vi.fn()
let received: { id: string; sender: 'A' | 'B'; createdAt: number } | null = null

vi.mock('../../hooks/usePokes', () => ({
  usePokes: () => ({ received, send }),
}))
vi.mock('../../hooks/useSession', () => ({
  useSession: () => ({ me: 'A', settings: { nameA: '갑', nameB: '민수', startDate: '2025-09-29' } }),
}))

describe('PokeButton', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    send.mockReset()
    send.mockResolvedValue(undefined)
    received = null
  })
  afterEach(() => vi.useRealTimers())

  it('sends once on tap and shows a disabled confirmation', async () => {
    render(<PokeButton />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '💗 보고 싶어' })) })
    expect(send).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: '전했어요 💗' })).toBeDisabled()
  })

  it('returns to the idle button after the cooldown', async () => {
    render(<PokeButton />)
    await act(async () => { fireEvent.click(screen.getByRole('button')) })
    act(() => { vi.advanceTimersByTime(POKE_COOLDOWN_MS - 1) })
    expect(screen.getByRole('button', { name: '전했어요 💗' })).toBeDisabled()
    act(() => { vi.advanceTimersByTime(1) })
    expect(screen.getByRole('button', { name: '💗 보고 싶어' })).toBeEnabled()
  })

  it('does not send again during the cooldown', async () => {
    render(<PokeButton />)
    await act(async () => { fireEvent.click(screen.getByRole('button')) })
    await act(async () => { fireEvent.click(screen.getByRole('button')) })
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('is disabled while the request is in flight', async () => {
    let resolve!: () => void
    send.mockReturnValue(new Promise<void>((r) => { resolve = r }))
    render(<PokeButton />)
    await act(async () => { fireEvent.click(screen.getByRole('button')) })
    expect(screen.getByRole('button')).toBeDisabled()
    await act(async () => { resolve() })
    expect(screen.getByRole('button', { name: '전했어요 💗' })).toBeDisabled()
  })

  it('shows an error and stays usable when saving fails', async () => {
    send.mockRejectedValue(new Error('fail'))
    render(<PokeButton />)
    await act(async () => { fireEvent.click(screen.getByRole('button')) })
    expect(screen.getByText('전하지 못했어요. 다시 눌러주세요.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '💗 보고 싶어' })).toBeEnabled()
  })

  it('shows what the other person sent, with the right particle and elapsed time', () => {
    received = { id: 'p', sender: 'B', createdAt: Date.now() - 5 * 60_000 }
    render(<PokeButton />)
    expect(screen.getByText('민수가 보고 싶대요 💗 · 5분 전')).toBeInTheDocument()
  })

  it('shows no received line when there is none', () => {
    render(<PokeButton />)
    expect(screen.queryByText(/보고 싶대요/)).not.toBeInTheDocument()
  })
})
