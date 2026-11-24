import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MapView } from './MapView'

const places = [
  { id: 'p1', name: '안목해변', date: '2026-01-01', mood: '🌊', diary: '', region: '32030', photoUrl: null, createdBy: 'A', createdAt: 1 },
  { id: 'p2', name: '광안리', date: '2026-03-01', mood: '🥰', diary: '', region: '21', photoUrl: null, createdBy: 'A', createdAt: 2 },
  { id: 'p3', name: '해운대', date: '2026-05-01', mood: '😆', diary: '', region: '21', photoUrl: null, createdBy: 'B', createdAt: 3 },
  { id: 'old', name: '예전 기록', date: '2025-12-01', mood: '', diary: '', x: 30, y: 40, photoUrl: null, createdBy: 'A', createdAt: 0 },
]

vi.mock('../../hooks/usePlaces', () => ({ usePlaces: () => ({ places, loading: false, add: vi.fn(), update: vi.fn(), remove: vi.fn() }) }))
vi.mock('./PlaceFormModal', () => ({
  PlaceFormModal: ({ existing, region }: { existing: { id: string } | null; region: string | null }) => (
    <div>Modal-{existing ? existing.id : `new-${region}`}</div>
  ),
}))

const area = (container: HTMLElement, id: string) => container.querySelector(`[data-region="${id}"]`)!

describe('MapView', () => {
  it('draws every area and colours the ones with a place', () => {
    const { container } = render(<MapView />)
    expect(container.querySelectorAll('[data-region]')).toHaveLength(161)
    const coloured = [...container.querySelectorAll('[data-region]')].filter((el) => el.getAttribute('data-visits') !== '0')
    expect(coloured.map((el) => el.getAttribute('data-region')).sort()).toEqual(['21', '32030'])
  })

  it('writes each area’s name on the map, without the name taking the press', () => {
    const { container } = render(<MapView />)
    const names = container.querySelectorAll('[data-label]')
    expect(names).toHaveLength(161)
    expect(container.querySelector('[data-label="21"]')).toHaveTextContent('부산')
    expect(container.querySelector('[data-label="32030"]')).toHaveTextContent('강릉')
  })

  it('can be enlarged and put back', async () => {
    const { container } = render(<MapView />)
    const wrap = container.querySelector('svg')!.parentElement!
    const zoom = screen.getByRole('button', { name: /크게 보기/ })
    expect(zoom).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(zoom)
    expect(screen.getByRole('button', { name: '작게 보기' })).toHaveAttribute('aria-pressed', 'true')
    expect(wrap.className).toMatch(/zoomed/)
    await userEvent.click(screen.getByRole('button', { name: '작게 보기' }))
    expect(wrap.className).not.toMatch(/zoomed/)
  })

  it('says how many areas have been visited, counting each once', () => {
    render(<MapView />)
    expect(screen.getByText('161곳')).toBeInTheDocument()
    expect(screen.getByText('2곳')).toBeInTheDocument()
  })

  it('shows an area’s name and its places, newest first, when the area is pressed', async () => {
    const { container } = render(<MapView />)
    await userEvent.click(area(container, '21'))
    expect(screen.getByText('부산', { selector: 'div' })).toBeInTheDocument()
    const rows = screen.getAllByRole('button').filter((b) => /광안리|해운대/.test(b.textContent ?? ''))
    expect(rows.map((b) => b.textContent)).toEqual(['😆해운대2026-05-01✏️ 수정', '🥰광안리2026-03-01✏️ 수정'])
    expect(screen.queryByText(/안목해변/)).not.toBeInTheDocument()
  })

  it('says so when a pressed area has no places yet', async () => {
    const { container } = render(<MapView />)
    await userEvent.click(area(container, '11'))
    expect(screen.getByText('아직 여기 남긴 기록이 없어요')).toBeInTheDocument()
  })

  it('opens a place for editing from the list', async () => {
    const { container } = render(<MapView />)
    await userEvent.click(area(container, '32030'))
    await userEvent.click(screen.getByRole('button', { name: /안목해변/ }))
    expect(screen.getByText('Modal-p1')).toBeInTheDocument()
  })

  it('adds a new place in the pressed area', async () => {
    const { container } = render(<MapView />)
    await userEvent.click(area(container, '39010'))
    await userEvent.click(screen.getByRole('button', { name: '+ 여기에 장소 추가' }))
    expect(screen.getByText('Modal-new-39010')).toBeInTheDocument()
  })

  it('reaches an area from the list too, for the ones too small to press', async () => {
    render(<MapView />)
    await userEvent.selectOptions(screen.getByLabelText('지역 고르기'), '경기 구리시')
    expect(screen.getByText('경기 구리시', { selector: 'div' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ 여기에 장소 추가' })).toBeInTheDocument()
  })

  it('lists places saved before the map had areas, so they can be given one', async () => {
    render(<MapView />)
    expect(screen.getByText('지역을 아직 안 정한 기록')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /예전 기록/ }))
    expect(screen.getByText('Modal-old')).toBeInTheDocument()
  })

  it('credits the source of the map', () => {
    render(<MapView />)
    expect(screen.getByText(/통계청/)).toBeInTheDocument()
  })
})
