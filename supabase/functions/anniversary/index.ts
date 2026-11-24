// Called once a day at 09:00 KST by pg_cron. Tells both phones when today is D+100n or an anniversary.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { anniversaryNotification, kstDate } from '../_shared/rules.ts'
import { isAuthorized, send } from '../_shared/push.ts'

Deno.serve(async (req) => {
  if (!isAuthorized(req)) return new Response('forbidden', { status: 403 })
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: row } = await db.from('settings').select('data').eq('id', 1).maybeSingle()
  const body = anniversaryNotification(row?.data?.startDate, kstDate(new Date()))
  if (!body) return Response.json({ sent: 0 })
  return Response.json({ sent: await send(db, ['A', 'B'], body) })
})
