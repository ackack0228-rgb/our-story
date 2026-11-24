import { createClient } from '@supabase/supabase-js'

// 공개 키는 번들에 들어가도 되는 값이다 — 데이터는 로그인 + RLS가 막는다.
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
