import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useReactions } from './useReactions'
import { deleteItem, putItem } from '../lib/api'

const refresh = vi.fn()
let items: unknown[] = []

vi.mock('./useCollection', () => ({
  useCollection: () => ({ items, loading: false, error: null, refresh }),
}))
vi.mock('./useSession', () => ({ useSession: () => ({ me: 'B' }) }))
vi.mock('../lib/api', () => ({ putItem: vi.fn(), deleteItem: vi.fn() }))

const event = { id: 'e1', title: '저녁 약속' }
const mine = { id: 'e1_B_heart', eventId: 'e1', emoji: 'heart', sender: 'B', eventTitle: '저녁 약속', createdAt: 1 }
const theirs = { id: 'e1_A_heart', eventId: 'e1', emoji: 'heart', sender: 'A', eventTitle: '저녁 약속', createdAt: 2 }

describe('useReactions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    items = []
    refresh.mockResolvedValue(undefined)
    vi.mocked(putItem).mockResolvedValue({})
    vi.mocked(deleteItem).mockResolvedValue(undefined)
  })

  it('adds my reaction under a fixed id, with the event title for the notification', async () => {
    const { result } = renderHook(() => useReactions())
    await result.current.toggle(event, 'heart')
    expect(putItem).toHaveBeenCalledWith('reactions', 'e1_B_heart', { eventId: 'e1', emoji: 'heart', sender: 'B', eventTitle: '저녁 약속' })
    expect(deleteItem).not.toHaveBeenCalled()
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('takes my reaction back when I already pressed it', async () => {
    items = [mine, theirs]
    const { result } = renderHook(() => useReactions())
    await result.current.toggle(event, 'heart')
    expect(deleteItem).toHaveBeenCalledWith('reactions', 'e1_B_heart')
    expect(putItem).not.toHaveBeenCalled()
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('adds mine when only the other person pressed that one', async () => {
    items = [theirs]
    const { result } = renderHook(() => useReactions())
    await result.current.toggle(event, 'heart')
    expect(putItem).toHaveBeenCalledWith('reactions', 'e1_B_heart', expect.objectContaining({ sender: 'B' }))
  })

  it('does not refresh when the write fails', async () => {
    vi.mocked(putItem).mockRejectedValueOnce(new Error('denied'))
    const { result } = renderHook(() => useReactions())
    await expect(result.current.toggle(event, 'thumb')).rejects.toThrow('denied')
    expect(refresh).not.toHaveBeenCalled()
  })

  it('clears every reaction on an event, both people, and never throws', async () => {
    items = [mine, theirs, { ...mine, id: 'e2_B_heart', eventId: 'e2' }]
    vi.mocked(deleteItem).mockRejectedValueOnce(new Error('down'))
    const { result } = renderHook(() => useReactions())
    await expect(result.current.clearFor('e1')).resolves.toBeUndefined()
    expect(vi.mocked(deleteItem).mock.calls.map(([, id]) => id).sort()).toEqual(['e1_A_heart', 'e1_B_heart'])
  })

  it('leaves malformed rows out', () => {
    items = [mine, { id: 'bad', eventId: 'e1', emoji: 'fire', sender: 'A' }, { id: 'noEvent', emoji: 'heart', sender: 'A' }]
    const { result } = renderHook(() => useReactions())
    expect(result.current.items.map((x) => x.id)).toEqual(['e1_B_heart'])
  })
})
