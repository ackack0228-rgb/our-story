import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getCalendarFeed } from './calendarFeed'
import { backend } from './supabaseBackend'

vi.mock('./supabaseBackend', () => ({ backend: { getPrivateContent: vi.fn() } }))

describe('getCalendarFeed', () => {
  beforeEach(() => {
    vi.mocked(backend.getPrivateContent).mockReset()
    vi.stubEnv('VITE_SUPABASE_URL', 'https://abc.supabase.co')
  })

  it('builds the subscription address from the stored key', async () => {
    vi.mocked(backend.getPrivateContent).mockResolvedValue({ key: 'se-cr_et' })
    expect(await getCalendarFeed()).toEqual({
      https: 'https://abc.supabase.co/functions/v1/calendar?key=se-cr_et',
      webcal: 'webcal://abc.supabase.co/functions/v1/calendar?key=se-cr_et',
    })
    expect(backend.getPrivateContent).toHaveBeenCalledWith('calendar_feed')
  })

  it('keeps an unusual key intact inside the address', async () => {
    vi.mocked(backend.getPrivateContent).mockResolvedValue({ key: 'a b&c' })
    expect((await getCalendarFeed())?.https).toBe('https://abc.supabase.co/functions/v1/calendar?key=a%20b%26c')
  })

  it('is null when no key has been set up', async () => {
    vi.mocked(backend.getPrivateContent).mockResolvedValue(null)
    expect(await getCalendarFeed()).toBeNull()
    vi.mocked(backend.getPrivateContent).mockResolvedValue({})
    expect(await getCalendarFeed()).toBeNull()
    vi.mocked(backend.getPrivateContent).mockResolvedValue({ key: '' })
    expect(await getCalendarFeed()).toBeNull()
    vi.mocked(backend.getPrivateContent).mockResolvedValue({ key: 42 })
    expect(await getCalendarFeed()).toBeNull()
  })
})
