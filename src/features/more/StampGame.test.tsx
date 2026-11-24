import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StampGame } from './StampGame'

const submit = vi.fn()
let records: unknown[] = []

vi.mock('../../hooks/useSession', () => ({
  useSession: () => ({ me: 'A', settings: { nameA: '갑', nameB: '을', startDate: null } }),
}))
vi.mock('../../hooks/useGameRecords', () => ({
  useGameRecords: () => ({ records, loading: false, error: null, submit }),
}))

beforeEach(() => {
  // jsdom has no canvas; the game skips drawing without one.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  submit.mockReset()
  records = []
})

describe('StampGame', () => {
  it('shows both best scores side by side, 0 for someone who has not played', () => {
    records = [{ id: 'stack_B', game: 'stack', who: 'B', best: 12, createdAt: 1 }]
    render(<StampGame />)
    expect(screen.getByText('갑').nextSibling).toHaveTextContent('0층')
    expect(screen.getByText('을').nextSibling).toHaveTextContent('12층')
  })

  it('starts on a tap and shows the floor count from 0', () => {
    render(<StampGame />)
    expect(screen.getByText('눌러서 시작')).toBeInTheDocument()
    fireEvent.pointerDown(screen.getByText('눌러서 시작'))
    expect(screen.queryByText('눌러서 시작')).not.toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
  })
})
