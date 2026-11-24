// The shared calendar as a feed for the iPhone Calendar app (and its widget). The Calendar app
// cannot log in, so the long random key in the address is what keeps the feed private; a wrong
// or missing key gets the same answer as an address that does not exist.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { buildCalendar, keysMatch } from '../_shared/ics.ts'

const notFound = () => new Response('not found', { status: 404 })

Deno.serve(async (req) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return notFound()
  const given = new URL(req.url).searchParams.get('key') ?? ''
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: secret } = await db.from('private_content').select('data').eq('key', 'calendar_feed').maybeSingle()
  if (!keysMatch(given, secret?.data?.key)) return notFound()

  const { data: rows, error } = await db.from('items').select('id, data, created_at').eq('collection', 'events')
  if (error) return new Response('temporarily unavailable', { status: 503 })
  const { data: settings } = await db.from('settings').select('data').eq('id', 1).maybeSingle()
  const names = { nameA: settings?.data?.nameA ?? '나', nameB: settings?.data?.nameB ?? '상대방' }
  return new Response(req.method === 'HEAD' ? null : buildCalendar(rows ?? [], names), {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'no-store' },
  })
})
