import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePokes } from './usePokes'
import { createItem, deleteItem } from '../lib/api'

const refresh = vi.fn()
let items: { id: string; sender: 'A' | 'B'; createdAt: number }[] = []

vi.mock('./useCollection', () => ({
  useCollection: () => ({ items, loading: false, error: null, refresh }),
}))
vi.mock('./useSession', () => ({ useSession: () => ({ me: 'A' }) }))
vi.mock('../lib/api', () => ({
  createItem: vi.fn(),
  deleteItem: vi.fn(),
}))

describe('usePokes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    items = []
    refresh.mockResolvedValue(undefined)
    vi.mocked(createItem).mockResolvedValue({})
    vi.mocked(deleteItem).mockResolvedValue(undefined)
  })

  it('sends with me as the sender and refreshes', async () => {
    const { result } = renderHook(() => usePokes())
    await result.current.send()
    expect(createItem).toHaveBeenCalledWith('pokes', { sender: 'A' })
    expect(refresh).toHaveBeenCalled()
  })

  it('rejects when saving fails and deletes nothing', async () => {
    items = [{ id: 'old', sender: 'A', createdAt: Date.now() - 1000 }]
    vi.mocked(createItem).mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => usePokes())
    await expect(result.current.send()).rejects.toThrow('boom')
    expect(deleteItem).not.toHaveBeenCalled()
  })

  it('deletes my previous pokes but never the other persons', async () => {
    items = [
      { id: 'mine1', sender: 'A', createdAt: 1 },
      { id: 'theirs', sender: 'B', createdAt: 2 },
      { id: 'mine2', sender: 'A', createdAt: 3 },
    ]
    const { result } = renderHook(() => usePokes())
    await result.current.send()
    expect(deleteItem).toHaveBeenCalledTimes(2)
    expect(deleteItem).toHaveBeenCalledWith('pokes', 'mine1')
    expect(deleteItem).toHaveBeenCalledWith('pokes', 'mine2')
    expect(deleteItem).not.toHaveBeenCalledWith('pokes', 'theirs')
  })

  it('does not reject when deleting an old poke fails', async () => {
    items = [{ id: 'mine1', sender: 'A', createdAt: 1 }]
    vi.mocked(deleteItem).mockRejectedValue(new Error('nope'))
    const { result } = renderHook(() => usePokes())
    await expect(result.current.send()).resolves.toBeUndefined()
  })

  it('exposes the other persons latest poke as received', () => {
    const now = Date.now()
    items = [
      { id: 'mine', sender: 'A', createdAt: now - 100 },
      { id: 'old', sender: 'B', createdAt: now - 5000 },
      { id: 'new', sender: 'B', createdAt: now - 1000 },
    ]
    const { result } = renderHook(() => usePokes())
    expect(result.current.received?.id).toBe('new')
  })
})
