import webpush from 'npm:web-push@3.6.7'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import type { Who } from './rules.ts'

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT')!,
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

export const isAuthorized = (req: Request) => {
  const secret = Deno.env.get('HOOK_SECRET')
  return !!secret && req.headers.get('x-hook-secret') === secret
}

// Sends one notification to every phone belonging to the given people. Subscriptions the push
// service says are gone (404/410) are deleted; any other failure is logged and skipped.
export async function send(db: SupabaseClient, to: Who[], body: string): Promise<number> {
  const { data: subscriptions, error } = await db.from('push_subscriptions').select('endpoint, p256dh, auth').in('who', to)
  if (error) throw new Error(error.message)
  let sent = 0
  for (const sub of subscriptions ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title: '우리의 이야기', body }),
      )
      sent++
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) await db.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      else console.error('push failed', status, err)
    }
  }
  return sent
}
