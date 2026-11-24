import { supabase } from './supabase'

// One shared account for the two of us; its password is the app's lock.
// Must match scripts/supabase-admin-constants.mjs.
export const LOCK_EMAIL = 'our-story@example.com'

export type UnlockResult = 'ok' | 'wrong' | 'error'

export async function hasSession(): Promise<boolean> {
  const { data } = await supabase.auth.getSession()
  return data.session !== null
}

export async function unlock(password: string): Promise<UnlockResult> {
  try {
    const { error } = await supabase.auth.signInWithPassword({ email: LOCK_EMAIL, password })
    if (!error) return 'ok'
    // 400 = the server looked and said no; anything else means we never got a real answer.
    return error.status === 400 ? 'wrong' : 'error'
  } catch {
    return 'error'
  }
}

export function onSignedOut(callback: () => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') callback()
  })
  return () => data.subscription.unsubscribe()
}
