// Called by the items insert trigger. Tells the other person that something new was added.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { answerDay, isRepeatAnswer, itemNotification } from '../_shared/rules.ts'
import { isAuthorized, send } from '../_shared/push.ts'

Deno.serve(async (req) => {
  if (!isAuthorized(req)) return new Response('forbidden', { status: 403 })
  const { collection, data, created_at: createdAt } = await req.json().catch(() => ({}))
  const item = data && typeof data === 'object' ? data : {}
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: row } = await db.from('settings').select('data').eq('id', 1).maybeSingle()
  const names = { nameA: row?.data?.nameA ?? '나', nameB: row?.data?.nameB ?? '상대방' }
  const notification = itemNotification(String(collection ?? ''), item, names)
  if (!notification) return Response.json({ sent: 0 })
  // Only the first answer of the day buzzes the other phone; the back-and-forth after it does not.
  // "First" is judged by the row's own time, so it holds however late this function runs.
  const day = collection === 'answers' ? answerDay(item) : null
  if (day && typeof createdAt === 'number') {
    const { count } = await db.from('items').select('id', { count: 'exact', head: true })
      .eq('collection', 'answers').eq('data->>date', day.date).eq('data->>sender', day.sender)
      .lt('created_at', createdAt)
    if (isRepeatAnswer(count)) return Response.json({ sent: 0 })
  }
  return Response.json({ sent: await send(db, [notification.to], notification.body) })
})
