import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAnswers } from './useAnswers'
import { createItem } from '../lib/api'

const refresh = vi.fn()
let items: unknown[] = []

vi.mock('./useCollection', () => ({
  useCollection: () => ({ items, loading: false, error: null, refresh }),
}))
vi.mock('./useSession', () => ({ useSession: () => ({ me: 'B' }) }))
vi.mock('../lib/api', () => ({ createItem: vi.fn() }))
vi.mock('../lib/date', () => ({ todayLocalISODate: () => '2026-10-08' }))
vi.mock('../lib/questions', () => ({ pickTodayQuestion: () => '오늘의 질문' }))

describe('useAnswers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    items = []
    refresh.mockResolvedValue(undefined)
    vi.mocked(createItem).mockResolvedValue({})
  })

  it('sends under today, with the question on screen and me as the sender, then refreshes', async () => {
    const { result } = renderHook(() => useAnswers())
    await result.current.send('  여행 갔던 날  ')
    expect(createItem).toHaveBeenCalledWith('answers', {
      date: '2026-10-08', question: '오늘의 질문', text: '여행 갔던 날', sender: 'B',
    })
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('keeps the question the day already started with', async () => {
    items = [{ id: 'a', date: '2026-10-08', question: '먼저 저장된 질문', text: '답', sender: 'A', createdAt: 1 }]
    const { result } = renderHook(() => useAnswers())
    await result.current.send('나도')
    expect(createItem).toHaveBeenCalledWith('answers', expect.objectContaining({ question: '먼저 저장된 질문' }))
  })

  it('cuts an overlong answer at 300 characters', async () => {
    const { result } = renderHook(() => useAnswers())
    await result.current.send('가'.repeat(350))
    expect(createItem).toHaveBeenCalledWith('answers', expect.objectContaining({ text: '가'.repeat(300) }))
  })

  it('does not refresh when the write fails', async () => {
    vi.mocked(createItem).mockRejectedValueOnce(new Error('denied'))
    const { result } = renderHook(() => useAnswers())
    await expect(result.current.send('답')).rejects.toThrow('denied')
    expect(refresh).not.toHaveBeenCalled()
  })

  it('leaves malformed rows out', () => {
    items = [
      { id: 'ok', date: '2026-10-08', question: 'q', text: '답', sender: 'A', createdAt: 1 },
      { id: 'noDate', text: '답', sender: 'A', createdAt: 2 },
      { id: 'noText', date: '2026-10-08', sender: 'A', createdAt: 3 },
      { id: 'badSender', date: '2026-10-08', text: '답', sender: 'C', createdAt: 4 },
    ]
    const { result } = renderHook(() => useAnswers())
    expect(result.current.items.map((a) => a.id)).toEqual(['ok'])
  })
})
