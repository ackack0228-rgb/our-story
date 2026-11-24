import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OnThisDay } from './OnThisDay'
import { usePlaces } from '../../hooks/usePlaces'
import type { Place } from '../../lib/places'

vi.mock('../../hooks/usePlaces', () => ({ usePlaces: vi.fn() }))
let today = '2026-10-06'
vi.mock('../../lib/date', () => ({ todayLocalISODate: () => today }))
afterEach(() => { today = '2026-10-06' })

function p(over: Partial<Place>): Place {
  return {
    id: 'p', name: '강릉', date: '2025-10-06', mood: '🌊', diary: '좋았다', x: 1, y: 2,
    photoUrl: null, createdBy: 'A', createdAt: 1, ...over,
  }
}

function setPlaces(places: Place[]) {
  vi.mocked(usePlaces).mockReturnValue({
    places, loading: false, error: null, add: vi.fn(), update: vi.fn(), remove: vi.fn(),
  })
}

describe('OnThisDay', () => {
  it('renders the eyebrow and the place name with its mood', () => {
    setPlaces([p({})])
    render(<OnThisDay />)
    expect(screen.getByText('1년 전 오늘')).toBeInTheDocument()
    expect(screen.getByText('강릉 🌊')).toBeInTheDocument()
  })

  it('shows the photo only when photoUrl is set', () => {
    setPlaces([p({ photoUrl: 'https://x/p.jpg' })])
    const { unmount } = render(<OnThisDay />)
    expect(screen.getByRole('img', { name: '강릉' })).toHaveAttribute('src', 'https://x/p.jpg')
    unmount()
    setPlaces([p({ photoUrl: null })])
    render(<OnThisDay />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('hides the diary when it is empty', () => {
    setPlaces([p({ diary: '' })])
    render(<OnThisDay />)
    expect(screen.queryByText('좋았다')).not.toBeInTheDocument()
    expect(screen.getByTestId('on-this-day').querySelector('p')).toBeNull()
  })

  it('shows the diary when present', () => {
    setPlaces([p({})])
    render(<OnThisDay />)
    expect(screen.getByText('좋았다')).toBeInTheDocument()
  })

  it('renders nothing when no place matches', () => {
    setPlaces([p({ date: '2025-10-07' })])
    render(<OnThisDay />)
    expect(screen.queryByTestId('on-this-day')).toBeNull()
  })

  it('renders two memories in 1-then-2 years order', () => {
    setPlaces([p({ id: 'b', name: '부산', date: '2024-10-06' }), p({ id: 'a', name: '강릉', date: '2025-10-06' })])
    render(<OnThisDay />)
    const eyebrows = screen.getAllByTestId('on-this-day-eyebrow').map((el) => el.textContent)
    expect(eyebrows).toEqual(['1년 전 오늘', '2년 전 오늘'])
  })

  it('moves on with the date when the app stays open past midnight', () => {
    setPlaces([p({ id: 'a', name: '강릉', date: '2025-10-06' }), p({ id: 'b', name: '속초', date: '2025-10-07' })])
    const view = render(<OnThisDay />)
    expect(screen.getByText(/강릉/)).toBeInTheDocument()
    today = '2026-10-07'
    view.rerender(<OnThisDay />)
    expect(screen.queryByText(/강릉/)).not.toBeInTheDocument()
    expect(screen.getByText(/속초/)).toBeInTheDocument()
  })
})
