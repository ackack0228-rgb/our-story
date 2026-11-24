// 실제 Supabase 프로젝트에 대해 "비로그인은 막히고, 공용 계정은 된다"를 확인한다.
import { createClient } from '@supabase/supabase-js'
import { LOCK_EMAIL } from './supabase-admin-constants.mjs'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
const failures = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`)
  if (!ok) failures.push(name)
}
const newClient = () => createClient(url, key, { auth: { persistSession: false } })

const anon = newClient()
{
  const { data, error } = await anon.from('items').select('id')
  check('비로그인은 items를 못 읽는다', !!error || data.length === 0)
  const insert = await anon.from('items').insert({ collection: 'notes', id: 'smoke-anon', data: {}, created_at: 1 })
  check('비로그인은 items에 못 쓴다', !!insert.error)
  const letter = await anon.from('private_content').select('key')
  check('비로그인은 private_content를 못 읽는다', !!letter.error || letter.data.length === 0)
  const signed = await anon.storage.from('uploads').createSignedUrl('smoke.png', 60)
  check('비로그인은 사진 주소를 못 만든다', !!signed.error)
}

const couple = newClient()
{
  const wrong = await couple.auth.signInWithPassword({ email: LOCK_EMAIL, password: 'definitely-wrong-password' })
  check('틀린 비밀번호는 거절된다', wrong.error?.status === 400, `status=${wrong.error?.status}`)
  const login = await couple.auth.signInWithPassword({ email: LOCK_EMAIL, password: process.env.LOCK_PASSWORD })
  check('공용 비밀번호로 로그인된다', !login.error, login.error?.message)

  const row = { collection: 'notes', id: 'smoke', data: { text: 'smoke' }, created_at: Date.now() }
  check('로그인하면 쓸 수 있다', !(await couple.from('items').upsert(row)).error)
  const read = await couple.from('items').select('id').eq('collection', 'notes').eq('id', 'smoke')
  check('로그인하면 읽을 수 있다', read.data?.length === 1)
  const bad = await couple.from('items').insert({ collection: 'hacks', id: 'x', data: {}, created_at: 1 })
  check('허용되지 않은 컬렉션은 거절된다', !!bad.error)
  check('지울 수 있다', !(await couple.from('items').delete().eq('collection', 'notes').eq('id', 'smoke')).error)

  const png = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' })
  check('사진을 올릴 수 있다', !(await couple.storage.from('uploads').upload('smoke.png', png, { upsert: true })).error)
  const signed = await couple.storage.from('uploads').createSignedUrls(['smoke.png'], 60)
  check('사진 주소를 만들 수 있다', !!signed.data?.[0]?.signedUrl)
  check('사진을 지울 수 있다', !(await couple.storage.from('uploads').remove(['smoke.png'])).error)
  check('media에는 못 올린다', !!(await couple.storage.from('media').upload('smoke.png', png)).error)
  const write = await couple.from('private_content').insert({ key: 'smoke', data: {} })
  check('private_content에는 못 쓴다', !!write.error)
}

process.exit(failures.length ? 1 : 0)
