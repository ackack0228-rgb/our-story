import { useEffect, useRef, useState } from 'react'
import { usePokes } from '../../hooks/usePokes'
import { useSession } from '../../hooks/useSession'
import { formatAgo } from '../../lib/pokes'
import { subjectParticle } from '../../../supabase/functions/_shared/rules'
import styles from './PokeButton.module.css'

export const POKE_COOLDOWN_MS = 10_000

export function PokeButton() {
  const { me, settings } = useSession()
  const { received, send } = usePokes()
  const [state, setState] = useState<'idle' | 'sending' | 'cooldown'>('idle')
  const [failed, setFailed] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const onTap = async () => {
    if (state !== 'idle') return
    setState('sending')
    setFailed(false)
    try {
      await send()
    } catch {
      setFailed(true)
      setState('idle')
      return
    }
    setState('cooldown')
    timer.current = setTimeout(() => setState('idle'), POKE_COOLDOWN_MS)
  }

  const otherName = me === 'A' ? settings.nameB : settings.nameA

  return (
    <>
      <button className={styles.btn} disabled={state !== 'idle'} onClick={onTap}>
        {state === 'cooldown' ? '전했어요 💗' : '💗 보고 싶어'}
      </button>
      {failed && <div className={styles.error}>전하지 못했어요. 다시 눌러주세요.</div>}
      {received && (
        <div className={styles.received}>
          {/* Recomputed each render on purpose (no ticking timer); polling re-renders keep it fresh. */}
          {/* eslint-disable-next-line react-hooks/purity */}
          {`${otherName}${subjectParticle(otherName)} 보고 싶대요 💗 · ${formatAgo(Date.now() - received.createdAt)}`}
        </div>
      )}
    </>
  )
}
