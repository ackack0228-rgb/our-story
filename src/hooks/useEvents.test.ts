import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useEvents } from './useEvents'
import { createItem, deleteItem, patchItem } from '../lib/api'

const refresh = vi.fn()
let items: unknown[] = []

vi.mock('./useCollection', () => ({
  useCollection: () => ({ items, loading: false, error: null, refresh }),
}))
vi.mock('./useSession', () => ({ useSession: () => ({ me: 'B' }) }))
vi.mock('../lib/api', () => ({ createItem: vi.fn(), patchItem: vi.fn(), deleteItem: vi.fn() }))

const input = { title: '저녁 약속', date: '2026-10-12', endDate: '', time: '19:00', owner: 'both' as const, note: '' }

describe('useEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    items = []
    refresh.mockResolvedValue(undefined)
    vi.mocked(createItem).mockResolvedValue({})
    vi.mocked(patchItem).mockResolvedValue({})
    vi.mocked(deleteItem).mockResolvedValue(undefined)
  })

  it('adds with me as the author and refreshes', async () => {
    const { result } = renderHook(() => useEvents())
    await result.current.add(input)
    expect(createItem).toHaveBeenCalledWith('events', { ...input, createdBy: 'B' })
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('updates without touching who created it', async () => {
    const { result } = renderHook(() => useEvents())
    await result.current.update('e1', input)
    expect(patchItem).toHaveBeenCalledWith('events', 'e1', input)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('removes and refreshes', async () => {
    const { result } = renderHook(() => useEvents())
    await result.current.remove('e1')
    expect(deleteItem).toHaveBeenCalledWith('events', 'e1')
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('does not refresh when the write fails', async () => {
    vi.mocked(createItem).mockRejectedValueOnce(new Error('denied'))
    const { result } = renderHook(() => useEvents())
    await expect(result.current.add(input)).rejects.toThrow('denied')
    expect(refresh).not.toHaveBeenCalled()
  })

  it('leaves malformed rows out', () => {
    items = [
      { id: 'ok', ...input, createdBy: 'A', createdAt: 1 },
      { id: 'noDate', title: 'x', owner: 'A', createdAt: 2 },
      { id: 'badOwner', ...input, owner: 'C', createdAt: 3 },
    ]
    const { result } = renderHook(() => useEvents())
    expect(result.current.items.map((e) => e.id)).toEqual(['ok'])
  })
})
