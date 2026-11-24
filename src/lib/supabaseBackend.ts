import { supabase } from './supabase'

export interface Row {
  id: string
  data: Record<string, unknown>
  created_at: number
}

export interface PushSubscriptionRow {
  endpoint: string
  p256dh: string
  auth: string
  who: 'A' | 'B'
  created_at: number
}

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T | null {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

const ROW = 'id, data, created_at'

// Supabase를 직접 부르는 유일한 곳. api.ts의 규칙(id 부여, 병합, 파일 정리)은 여기 없고,
// 테스트는 이 객체를 메모리 가짜로 바꿔 끼운다.
export const backend = {
  async selectAll(col: string): Promise<Row[]> {
    const res = await supabase.from('items').select(ROW).eq('collection', col).order('created_at', { ascending: false })
    return (unwrap(res) as Row[] | null) ?? []
  },
  async selectOne(col: string, id: string): Promise<Row | null> {
    const res = await supabase.from('items').select(ROW).eq('collection', col).eq('id', id).maybeSingle()
    return unwrap(res) as Row | null
  },
  async insert(col: string, row: Row): Promise<void> {
    unwrap(await supabase.from('items').insert({ collection: col, ...row }))
  },
  async updateData(col: string, id: string, data: Record<string, unknown>): Promise<void> {
    unwrap(await supabase.from('items').update({ data }).eq('collection', col).eq('id', id))
  },
  async remove(col: string, id: string): Promise<void> {
    unwrap(await supabase.from('items').delete().eq('collection', col).eq('id', id))
  },
  async getSettingsData(): Promise<Record<string, unknown> | null> {
    const row = unwrap(await supabase.from('settings').select('data').eq('id', 1).maybeSingle())
    return (row as { data: Record<string, unknown> } | null)?.data ?? null
  },
  async saveSettingsData(data: Record<string, unknown>): Promise<void> {
    unwrap(await supabase.from('settings').upsert({ id: 1, data }))
  },
  // Read-only for the app; rows are written by the admin script.
  async getPrivateContent(key: string): Promise<Record<string, unknown> | null> {
    const row = unwrap(await supabase.from('private_content').select('data').eq('key', key).maybeSingle())
    return (row as { data: Record<string, unknown> } | null)?.data ?? null
  },
  async uploadFile(path: string, blob: Blob): Promise<void> {
    const { error } = await supabase.storage.from('uploads').upload(path, blob, { contentType: blob.type })
    if (error) throw new Error(error.message)
  },
  async removeFiles(paths: string[]): Promise<void> {
    const { error } = await supabase.storage.from('uploads').remove(paths)
    if (error) throw new Error(error.message)
  },
  async signUrls(bucket: string, paths: string[], expiresInSeconds: number): Promise<Record<string, string>> {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrls(paths, expiresInSeconds)
    if (error) throw new Error(error.message)
    const urls: Record<string, string> = {}
    for (const entry of data ?? []) {
      if (entry.path && entry.signedUrl && !entry.error) urls[entry.path] = entry.signedUrl
    }
    return urls
  },
  async savePushSubscription(row: PushSubscriptionRow): Promise<void> {
    unwrap(await supabase.from('push_subscriptions').upsert(row))
  },
}
