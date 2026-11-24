import { backend } from './supabaseBackend'

export interface CalendarFeed {
  https: string
  webcal: string
}

// The address the iPhone Calendar app subscribes to. Its key is readable only after logging in, so
// the address never appears in the public bundle. null until the key has been set up.
export async function getCalendarFeed(): Promise<CalendarFeed | null> {
  const key = (await backend.getPrivateContent('calendar_feed'))?.key
  if (typeof key !== 'string' || key === '') return null
  const https = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calendar?key=${encodeURIComponent(key)}`
  return { https, webcal: https.replace(/^https?:\/\//, 'webcal://') }
}
