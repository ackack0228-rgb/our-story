import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { resolveUrls, toStoragePath, clearSignedUrlCache, SIGN_TTL_S } from './signedUrls'
import { backend } from './supabaseBackend'

vi.mock('./supabaseBackend', () => ({ backend: { signUrls: vi.fn() } }))
const signUrls = vi.mocked(backend.signUrls)
let counter = 0

beforeEach(() => {
  clearSignedUrlCache()
  counter = 0
  signUrls.mockReset().mockImplementation(async (bucket, paths) =>
    Object.fromEntries(paths.map((p) => [p, `https://x.supabase.co/storage/v1/object/sign/${bucket}/${p}?token=${++counter}`])),
  )
})
afterEach(() => vi.useRealTimers())

describe('resolveUrls', () => {
  it('signs each path once and reuses the same URL on later calls', async () => {
    const first = await resolveUrls('uploads', ['a.jpg', 'b.png'])
    const second = await resolveUrls('uploads', ['a.jpg', 'b.png'])
    expect(second).toEqual(first)
    expect(signUrls).toHaveBeenCalledTimes(1)
  })

  it('only signs paths it has not seen', async () => {
    await resolveUrls('uploads', ['a.jpg'])
    await resolveUrls('uploads', ['a.jpg', 'c.jpg'])
    expect(signUrls).toHaveBeenLastCalledWith('uploads', ['c.jpg'], SIGN_TTL_S)
  })

  it('asks for duplicates only once', async () => {
    await resolveUrls('uploads', ['a.jpg', 'a.jpg'])
    expect(signUrls).toHaveBeenCalledWith('uploads', ['a.jpg'], SIGN_TTL_S)
  })

  it('re-signs when less than a day of validity is left', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-01T00:00:00Z'))
    const first = await resolveUrls('uploads', ['a.jpg'])
    vi.setSystemTime(new Date('2026-10-07T12:00:00Z'))
    const later = await resolveUrls('uploads', ['a.jpg'])
    expect(later['a.jpg']).not.toBe(first['a.jpg'])
  })

  it('survives a reload by keeping the cache in localStorage', async () => {
    const first = await resolveUrls('uploads', ['a.jpg'])
    const stored = localStorage.getItem('signedUrls')
    clearSignedUrlCache()
    localStorage.setItem('signedUrls', stored!)
    expect(await resolveUrls('uploads', ['a.jpg'])).toEqual(first)
    expect(signUrls).toHaveBeenCalledTimes(1)
  })

  it('keeps buckets apart', async () => {
    const a = await resolveUrls('uploads', ['x.mp3'])
    const b = await resolveUrls('media', ['x.mp3'])
    expect(a['x.mp3']).not.toBe(b['x.mp3'])
  })

  it('leaves out paths the server could not sign', async () => {
    signUrls.mockResolvedValueOnce({})
    expect(await resolveUrls('uploads', ['gone.jpg'])).toEqual({})
  })

  it('still works when localStorage is unavailable or holds garbage', async () => {
    localStorage.setItem('signedUrls', '{not json')
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    try {
      expect((await resolveUrls('uploads', ['a.jpg']))['a.jpg']).toContain('a.jpg')
    } finally {
      setItem.mockRestore()
    }
  })
})

describe('toStoragePath', () => {
  it('turns a signed URL back into its bucket path', () => {
    expect(toStoragePath('https://x.supabase.co/storage/v1/object/sign/uploads/ab%20c.jpg?token=t')).toBe('ab c.jpg')
  })
  it('strips the old local-server prefix', () => {
    expect(toStoragePath('/uploads/old.png')).toBe('old.png')
  })
  it('leaves a bare path alone', () => {
    expect(toStoragePath('abc.jpg')).toBe('abc.jpg')
  })
})
