// 한 번씩만 쓰는 Supabase 관리 작업. 사용: npm run sb:admin -- <command>
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { LOCK_EMAIL } from './supabase-admin-constants.mjs'

const env = (name) => {
  const value = process.env[name]
  if (!value) throw new Error(`.env에 ${name} 값이 없어요`)
  return value
}

async function management(method, path, body) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${env('SUPABASE_PROJECT_REF')}${path}`, {
    method,
    headers: { Authorization: `Bearer ${env('SUPABASE_ACCESS_TOKEN')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) {
    let detail = ''
    try {
      const message = JSON.parse(text)?.message
      if (typeof message === 'string') {
        const secret = process.env.HOOK_SECRET
        detail = ` ${(secret ? message.replaceAll(secret, '***') : message).slice(0, 200)}`
      }
    } catch {
      // 본문이 JSON이 아니면 상태 코드만 보여준다
    }
    throw new Error(`${method} ${path} → ${res.status}${detail}`)
  }
  return text
}

const sqlString = (value) => `'${value.replaceAll("'", "''")}'`

const commands = {
  async 'create-lock-user'() {
    const admin = createClient(env('VITE_SUPABASE_URL'), env('SUPABASE_SECRET_KEY'), { auth: { persistSession: false } })
    const { error } = await admin.auth.admin.createUser({
      email: LOCK_EMAIL,
      password: env('LOCK_PASSWORD'),
      email_confirm: true,
    })
    if (error && !/already/i.test(error.message)) throw error
    console.log(error ? '공용 계정이 이미 있어요' : '공용 계정을 만들었어요')
  },
  // Sets the shared lock account's password to LOCK_PASSWORD from .env (never printed).
  async 'set-lock-password'() {
    const password = env('LOCK_PASSWORD')
    if (password.length < 12) throw new Error('LOCK_PASSWORD는 12자 이상으로 해 주세요')
    const admin = createClient(env('VITE_SUPABASE_URL'), env('SUPABASE_SECRET_KEY'), { auth: { persistSession: false } })
    const { data, error } = await admin.auth.admin.listUsers()
    if (error) throw error
    const user = data.users.find((u) => u.email === LOCK_EMAIL)
    if (!user) throw new Error('공용 계정을 찾지 못했어요')
    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, { password })
    if (updateError) throw updateError
    console.log('공용 비밀번호를 바꿨어요')
  },
  async 'disable-signup'() {
    await management('PATCH', '/config/auth', { disable_signup: true })
    console.log('새 계정 가입을 막았어요')
  },
  async 'set-vault'() {
    const query = `
      delete from vault.secrets where name in ('project_url', 'hook_secret');
      select vault.create_secret(${sqlString(env('VITE_SUPABASE_URL'))}, 'project_url');
      select vault.create_secret(${sqlString(env('HOOK_SECRET'))}, 'hook_secret');`
    await management('POST', '/database/query', { query })
    console.log('Vault 값을 넣었어요')
  },
  // `supabase db push`가 이 프로젝트에선 안 돼서(DB 비밀번호 거부) 관리 API로 마이그레이션을 적용한다.
  async 'apply-sql'() {
    const file = process.argv[3]
    if (!file) throw new Error('적용할 SQL 파일 경로를 알려주세요. 예: npm run sb:admin -- apply-sql supabase/migrations/<파일>.sql')
    if (!fs.existsSync(file)) throw new Error(`파일을 찾을 수 없어요: ${file}`)
    const base = path.basename(file)
    const underscore = base.indexOf('_')
    const version = underscore === -1 ? base.replace(/\.sql$/, '') : base.slice(0, underscore)
    const name = underscore === -1 ? '' : base.slice(underscore + 1).replace(/\.sql$/, '')
    if (!/^\d+$/.test(version)) throw new Error(`파일 이름이 숫자_이름.sql 모양이어야 해요: ${base}`)
    const sql = fs.readFileSync(file, 'utf8')

    await management('POST', '/database/query', {
      query:
        'create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);',
    })
    const found = JSON.parse(
      await management('POST', '/database/query', {
        query: `select version from supabase_migrations.schema_migrations where version = ${sqlString(version)}`,
      }),
    )
    if (Array.isArray(found) && found.length > 0) {
      console.log(`이미 적용된 마이그레이션이에요: ${version}`)
      return
    }
    await management('POST', '/database/query', {
      query: `begin;\n${sql}\n;insert into supabase_migrations.schema_migrations (version, name) values (${sqlString(version)}, ${sqlString(name)});\ncommit;`,
    })
    console.log(`적용했어요: ${version} ${name}`)
  },
  // 아이폰 캘린더 구독 주소의 열쇠를 새로 만든다. 다시 실행하면 예전 주소는 더 이상 열리지 않는다.
  async 'set-calendar-key'() {
    const key = randomBytes(32).toString('base64url')
    await management('POST', '/database/query', {
      query: `insert into public.private_content (key, data) values ('calendar_feed', jsonb_build_object('key', ${sqlString(key)}))
              on conflict (key) do update set data = excluded.data;`,
    })
    console.log('달력 구독 주소를 새로 만들었어요. 예전 주소로 연결한 폰은 앱 설정에서 다시 연결해야 해요.')
  },
  async 'set-function-secrets'() {
    const names = ['VAPID_PRIVATE_KEY', 'VAPID_SUBJECT', 'HOOK_SECRET']
    const pairs = [`VAPID_PUBLIC_KEY=${env('VITE_VAPID_PUBLIC_KEY')}`, ...names.map((n) => `${n}=${env(n)}`)]
    const result = spawnSync('npx', ['supabase', 'secrets', 'set', ...pairs], { stdio: 'inherit', shell: true })
    process.exit(result.status ?? 1)
  },
}

const command = commands[process.argv[2]]
if (!command) {
  console.error(`사용: npm run sb:admin -- <${Object.keys(commands).join(' | ')}>`)
  process.exit(1)
}
await command()
