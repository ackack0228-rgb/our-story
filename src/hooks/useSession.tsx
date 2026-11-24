import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { getSettings, putSettings, type Settings } from '../lib/api'
import { hasSession, onSignedOut } from '../lib/auth'
import { syncPushWho } from '../lib/push'
import { LockScreen } from '../features/onboarding/LockScreen'
import { WhoAmIScreen } from '../features/onboarding/WhoAmIScreen'
import { POLL_INTERVAL_MS } from './useCollection'
import type { Who } from '../../supabase/functions/_shared/rules'

export type { Who }
export const WHO_KEY = 'whoAmI'

export interface SessionValue {
  me: Who
  settings: Settings
  updateSettings: (patch: Partial<Settings>) => Promise<void>
  switchUser: () => void
}

const SessionContext = createContext<SessionValue | null>(null)

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within a SessionProvider')
  return ctx
}

function readWho(): Who | null {
  try {
    const v = localStorage.getItem(WHO_KEY)
    return v === 'A' || v === 'B' ? v : null
  } catch {
    return null
  }
}

type Phase =
  | { kind: 'checking' }
  | { kind: 'locked' }
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; settings: Settings }

export function SessionProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>({ kind: 'checking' })
  const [me, setMe] = useState<Who | null>(readWho)

  const load = useCallback(async () => {
    setPhase({ kind: 'loading' })
    try {
      setPhase({ kind: 'ready', settings: await getSettings() })
    } catch {
      setPhase({ kind: 'error' })
    }
  }, [])

  // Lock first: without a session the database answers with empty lists rather than errors,
  // which would look like every record had vanished.
  const start = useCallback(async () => {
    setPhase({ kind: 'checking' })
    try {
      if (await hasSession()) await load()
      else setPhase({ kind: 'locked' })
    } catch {
      setPhase({ kind: 'error' })
    }
  }, [load])

  useEffect(() => {
    start()
  }, [start])

  useEffect(() => onSignedOut(() => setPhase({ kind: 'locked' })), [])

  // Keep names/start date in sync when the other phone edits them. Failures are ignored here —
  // the collection hooks already surface "server unreachable" on each screen. A refresh only
  // applies while the app is still open: one that lands after sign-out carries the defaults the
  // database gives a signed-out phone, and must not take the lock screen away.
  useEffect(() => {
    if (phase.kind !== 'ready') return
    const timer = setInterval(() => {
      getSettings()
        .then((settings) => setPhase((current) => (current.kind === 'ready' ? { kind: 'ready', settings } : current)))
        .catch(() => {})
    }, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [phase.kind])

  if (phase.kind === 'checking' || phase.kind === 'loading') return null
  if (phase.kind === 'locked') return <LockScreen onUnlocked={load} />
  if (phase.kind === 'error') {
    return (
      <div
        style={{
          width: '100%',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '20px',
          padding: '24px',
          backgroundColor: 'var(--night)',
          color: 'var(--cream)',
          textAlign: 'center',
        }}
      >
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: '1.375rem' }}>
          서버에 연결하지 못했어요.
        </h2>
        <button
          onClick={start}
          style={{
            backgroundColor: 'var(--coral)',
            color: '#241618',
            border: 'none',
            borderRadius: '14px',
            padding: '14px 28px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          다시 시도하기
        </button>
      </div>
    )
  }

  const { settings } = phase
  if (!me) {
    return (
      <WhoAmIScreen
        settings={settings}
        onPick={(who) => {
          try {
            localStorage.setItem(WHO_KEY, who)
          } catch {
            // Private mode etc. — still usable for this visit, just not remembered.
          }
          syncPushWho(who)
          setMe(who)
        }}
      />
    )
  }

  const value: SessionValue = {
    me,
    settings,
    updateSettings: async (patch) => {
      setPhase({ kind: 'ready', settings: await putSettings(patch) })
    },
    switchUser: () => {
      try {
        localStorage.removeItem(WHO_KEY)
      } catch {
        // ignore
      }
      setMe(null)
    },
  }

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
