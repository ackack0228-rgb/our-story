import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useCollection, POLL_INTERVAL_MS } from './useCollection'
import { listItems } from '../lib/api'

vi.mock('../lib/api', () => ({ listItems: vi.fn() }))
const listMock = vi.mocked(listItems)

describe('useCollection', () => {
  beforeEach(() => {
    listMock.mockReset()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })
  afterEach(() => vi.useRealTimers())

  it('loads immediately and then polls', async () => {
    listMock.mockResolvedValueOnce([{ id: '1' }]).mockResolvedValue([{ id: '1' }, { id: '2' }])
    const { result } = renderHook(() => useCollection<{ id: string }>('notes'))
    await waitFor(() => expect(result.current.items).toHaveLength(1))
    expect(result.current.loading).toBe(false)
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS))
    await waitFor(() => expect(result.current.items).toHaveLength(2))
  })

  it('shows an error and clears it once a later poll succeeds', async () => {
    listMock.mockRejectedValueOnce(new Error('down')).mockResolvedValue([])
    const { result } = renderHook(() => useCollection('notes'))
    await waitFor(() => expect(result.current.error).toBe('인터넷 연결을 확인해 주세요. 연결되면 바로 다시 불러와요.'))
    expect(result.current.loading).toBe(false)
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS))
    await waitFor(() => expect(result.current.error).toBeNull())
  })

  it('stops polling on unmount', async () => {
    listMock.mockResolvedValue([])
    const { unmount } = renderHook(() => useCollection('notes'))
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1))
    unmount()
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3))
    expect(listMock).toHaveBeenCalledTimes(1)
  })

  it('shares one request between every screen showing the same collection', async () => {
    // e.g. Home counts places while its "N년 전 오늘" card lists them.
    listMock.mockResolvedValue([{ id: '1' }])
    const count = renderHook(() => useCollection<{ id: string }>('places'))
    const card = renderHook(() => useCollection<{ id: string }>('places'))
    await waitFor(() => expect(card.result.current.items).toHaveLength(1))
    expect(count.result.current.items).toHaveLength(1)
    expect(listMock).toHaveBeenCalledTimes(1)
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS))
    expect(listMock).toHaveBeenCalledTimes(2)
  })

  it('polls each collection on its own', async () => {
    listMock.mockResolvedValue([])
    renderHook(() => useCollection('places'))
    renderHook(() => useCollection('notes'))
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2))
    expect(listMock.mock.calls.map(([name]) => name).sort()).toEqual(['notes', 'places'])
  })

  it('keeps polling for the screens still open when another one closes', async () => {
    listMock.mockResolvedValue([])
    const staying = renderHook(() => useCollection('places'))
    const leaving = renderHook(() => useCollection('places'))
    await waitFor(() => expect(staying.result.current.loading).toBe(false))
    leaving.unmount()
    listMock.mockResolvedValue([{ id: 'later' }])
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS))
    expect(staying.result.current.items).toEqual([{ id: 'later' }])
  })

  it('gives a screen that opens later what is already loaded, without a spinner', async () => {
    listMock.mockResolvedValue([{ id: '1' }])
    const first = renderHook(() => useCollection<{ id: string }>('places'))
    await waitFor(() => expect(first.result.current.items).toHaveLength(1))
    const second = renderHook(() => useCollection<{ id: string }>('places'))
    expect(second.result.current.loading).toBe(false)
    expect(second.result.current.items).toEqual([{ id: '1' }])
  })

  it('starts from scratch after every screen showing a collection has closed', async () => {
    listMock.mockResolvedValue([{ id: '1' }])
    const first = renderHook(() => useCollection<{ id: string }>('places'))
    await waitFor(() => expect(first.result.current.items).toHaveLength(1))
    first.unmount()
    const again = renderHook(() => useCollection<{ id: string }>('places'))
    expect(again.result.current.loading).toBe(true)
    expect(again.result.current.items).toEqual([])
    await waitFor(() => expect(again.result.current.loading).toBe(false))
  })

  it('refresh() on one instance also refreshes every other instance of the same collection', async () => {
    // e.g. PlaceFormModal saves a place → MapView's own useCollection('places') must show the pin now,
    // not on its next poll.
    listMock.mockResolvedValue([])
    const map = renderHook(() => useCollection<{ id: string }>('places'))
    const modal = renderHook(() => useCollection<{ id: string }>('places'))
    await waitFor(() => expect(map.result.current.loading).toBe(false))
    await waitFor(() => expect(modal.result.current.loading).toBe(false))
    listMock.mockResolvedValue([{ id: 'new' }])
    await act(() => modal.result.current.refresh())
    expect(map.result.current.items).toEqual([{ id: 'new' }])
  })

  it('ignores a stale response that resolves after a newer one', async () => {
    // A poll sent just before a write can land after the post-write refresh; it must not undo the write.
    listMock.mockResolvedValueOnce([])
    const { result } = renderHook(() => useCollection<{ id: string; done: boolean }>('bucket'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    let resolveStale!: (v: unknown[]) => void
    listMock.mockImplementationOnce(() => new Promise((r) => { resolveStale = r }))
    listMock.mockResolvedValueOnce([{ id: 'b', done: true }])
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)) // stale poll in flight
    await act(() => result.current.refresh()) // post-write refresh wins
    expect(result.current.items).toEqual([{ id: 'b', done: true }])
    await act(async () => resolveStale([{ id: 'b', done: false }]))
    expect(result.current.items).toEqual([{ id: 'b', done: true }])
  })
})
