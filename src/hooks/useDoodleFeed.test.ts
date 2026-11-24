import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useDoodleFeed } from './useDoodleFeed'
import { createItem, discardUpload, uploadImage } from '../lib/api'

const refresh = vi.fn().mockResolvedValue(undefined)
vi.mock('./useCollection', () => ({
  useCollection: (name: string) => ({
    items:
      name === 'doodles'
        ? [{ id: 'd1', imageUrl: '/uploads/d.png', sender: 'A', createdAt: 1 }]
        : [{ id: 'n1', text: 'hi', sender: 'B', createdAt: 2 }],
    loading: false,
    error: null,
    refresh,
  }),
}))
vi.mock('./useSession', () => ({ useSession: () => ({ me: 'A' }) }))
vi.mock('../lib/imageResize', () => ({ blobToDataUrl: vi.fn().mockResolvedValue('data:image/png;base64,AAA') }))
vi.mock('../lib/api', () => ({
  createItem: vi.fn().mockResolvedValue({}),
  uploadImage: vi.fn().mockResolvedValue('/uploads/new.png'),
  discardUpload: vi.fn().mockResolvedValue(undefined),
}))

describe('useDoodleFeed', () => {
  beforeEach(() => vi.clearAllMocks())

  it('merges doodles and notes newest first', async () => {
    const { result } = renderHook(() => useDoodleFeed())
    await waitFor(() => expect(result.current.items.map((i) => i.id)).toEqual(['n1', 'd1']))
  })

  it('uploads the doodle image and records me as sender', async () => {
    const { result } = renderHook(() => useDoodleFeed())
    await result.current.sendDoodle(new Blob(['x'], { type: 'image/png' }))
    expect(uploadImage).toHaveBeenCalledWith('data:image/png;base64,AAA')
    expect(createItem).toHaveBeenCalledWith('doodles', { imageUrl: '/uploads/new.png', sender: 'A' })
    expect(refresh).toHaveBeenCalled()
  })

  it('removes the uploaded image when saving the doodle fails', async () => {
    vi.mocked(createItem).mockRejectedValueOnce(new Error('down'))
    const { result } = renderHook(() => useDoodleFeed())
    await expect(result.current.sendDoodle(new Blob(['x'], { type: 'image/png' }))).rejects.toThrow('down')
    expect(discardUpload).toHaveBeenCalledWith('/uploads/new.png')
  })

  it('sends a note as me', async () => {
    const { result } = renderHook(() => useDoodleFeed())
    await result.current.sendNote('안녕')
    expect(createItem).toHaveBeenCalledWith('notes', { text: '안녕', sender: 'A' })
  })
})
