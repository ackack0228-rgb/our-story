import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { usePlaces } from './usePlaces'
import { createItem, discardUpload, patchItem, uploadIfDataUrl } from '../lib/api'

const refresh = vi.fn().mockResolvedValue(undefined)
vi.mock('./useCollection', () => ({
  useCollection: () => ({
    items: [{ id: 'p1', name: '강릉', date: '2026-01-01', mood: '❤️', diary: '', x: 1, y: 2, photoUrl: null, createdBy: 'A', createdAt: 1 }],
    loading: false,
    error: null,
    refresh,
  }),
}))
vi.mock('./useSession', () => ({ useSession: () => ({ me: 'B' }) }))
vi.mock('../lib/api', () => ({
  createItem: vi.fn().mockResolvedValue({}),
  patchItem: vi.fn().mockResolvedValue({}),
  deleteItem: vi.fn().mockResolvedValue(undefined),
  discardUpload: vi.fn().mockResolvedValue(undefined),
  uploadIfDataUrl: vi.fn(async (v: string | null) => (v && v.startsWith('data:') ? '/uploads/new.jpg' : v)),
}))

const base = { name: 'n', date: '2026-01-01', mood: '❤️', diary: '', x: 1, y: 2 }

describe('usePlaces', () => {
  beforeEach(() => vi.clearAllMocks())

  it('exposes places from the collection', async () => {
    const { result } = renderHook(() => usePlaces())
    await waitFor(() => expect(result.current.places[0].name).toBe('강릉'))
  })

  it('uploads a new photo, tags createdBy with me, and refreshes', async () => {
    const { result } = renderHook(() => usePlaces())
    await result.current.add({ ...base, photoUrl: 'data:image/jpeg;base64,AAA' })
    expect(createItem).toHaveBeenCalledWith('places', { ...base, photoUrl: '/uploads/new.jpg', createdBy: 'B' })
    expect(refresh).toHaveBeenCalled()
  })

  it('removes a freshly uploaded photo when saving the place fails', async () => {
    vi.mocked(createItem).mockRejectedValueOnce(new Error('down'))
    const { result } = renderHook(() => usePlaces())
    await expect(result.current.add({ ...base, photoUrl: 'data:image/jpeg;base64,AAA' })).rejects.toThrow('down')
    expect(discardUpload).toHaveBeenCalledWith('/uploads/new.jpg')
  })

  it('leaves storage alone when a place without a new photo fails to save', async () => {
    vi.mocked(createItem).mockRejectedValueOnce(new Error('down'))
    const { result } = renderHook(() => usePlaces())
    await expect(result.current.add({ ...base, photoUrl: null })).rejects.toThrow('down')
    expect(discardUpload).not.toHaveBeenCalled()
  })

  it('removes a freshly uploaded photo when editing a place fails to save', async () => {
    vi.mocked(patchItem).mockRejectedValueOnce(new Error('down'))
    const { result } = renderHook(() => usePlaces())
    await expect(result.current.update('p1', { photoUrl: 'data:image/jpeg;base64,AAA' })).rejects.toThrow('down')
    expect(discardUpload).toHaveBeenCalledWith('/uploads/new.jpg')
  })

  it('leaves storage alone when an edit without a new photo fails to save', async () => {
    vi.mocked(patchItem).mockRejectedValueOnce(new Error('down'))
    const { result } = renderHook(() => usePlaces())
    await expect(result.current.update('p1', { name: 'x' })).rejects.toThrow('down')
    vi.mocked(patchItem).mockRejectedValueOnce(new Error('down'))
    await expect(result.current.update('p1', { photoUrl: 'old.jpg' })).rejects.toThrow('down')
    expect(discardUpload).not.toHaveBeenCalled()
  })

  it('does not upload or touch photoUrl when editing without a new photo', async () => {
    const { result } = renderHook(() => usePlaces())
    await result.current.update('p1', { name: 'x' })
    expect(uploadIfDataUrl).not.toHaveBeenCalled()
    expect(patchItem).toHaveBeenCalledWith('places', 'p1', { name: 'x' })
  })
})
