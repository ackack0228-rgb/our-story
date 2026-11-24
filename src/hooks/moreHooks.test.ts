import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useBucket } from './useBucket'
import { useArchive } from './useArchive'
import { useVotes } from './useVotes'
import { createItem, patchItem } from '../lib/api'

vi.mock('./useCollection', () => ({
  useCollection: () => ({ items: [], loading: false, error: null, refresh: vi.fn().mockResolvedValue(undefined) }),
}))
vi.mock('./useSession', () => ({ useSession: () => ({ me: 'B' }) }))
vi.mock('../lib/api', () => ({
  createItem: vi.fn().mockResolvedValue({}),
  patchItem: vi.fn().mockResolvedValue({}),
  deleteItem: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../lib/date', () => ({ todayLocalISODate: () => '2026-10-06' }))

describe('who added it', () => {
  beforeEach(() => vi.clearAllMocks())

  it('bucket items record who added them', async () => {
    const { result } = renderHook(() => useBucket())
    await result.current.add('부산 가기', 'destination')
    expect(createItem).toHaveBeenCalledWith('bucket', { text: '부산 가기', category: 'destination', done: false, createdBy: 'B' })
  })

  it('bucket edits patch the item in place', async () => {
    const { result } = renderHook(() => useBucket())
    const changes = { text: '부산 1박', category: 'destination' as const, note: null, link: null }
    await result.current.edit('b1', changes)
    expect(patchItem).toHaveBeenCalledWith('bucket', 'b1', changes)
  })

  it('archive items record who added them', async () => {
    const { result } = renderHook(() => useArchive())
    await result.current.add('food', '국밥집', 5, '맛있음')
    expect(createItem).toHaveBeenCalledWith('archive', {
      type: 'food', name: '국밥집', rating: 5, note: '맛있음', date: '2026-10-06', createdBy: 'B',
    })
  })

  it('travel votes record who suggested them', async () => {
    const { result } = renderHook(() => useVotes())
    await result.current.add('제주', '가을에')
    expect(createItem).toHaveBeenCalledWith('votes', { name: '제주', note: '가을에', likedBy: [], createdBy: 'B' })
  })
})
