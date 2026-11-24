import { useState } from 'react'
import { useBalance } from '../../hooks/useBalance'
import { useSession } from '../../hooks/useSession'
import { todayLocalISODate } from '../../lib/date'
import { choicesOn, gameOn, gameStatus, pastGames, type Side } from '../../lib/balance'
import styles from './BalanceGame.module.css'
import { LOAD_ERROR } from '../../hooks/useCollection'

const SIDES: Side[] = ['a', 'b']
const shortDate = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`

export function BalanceGame() {
  const { items, pick, error: loadError } = useBalance()
  const { me, settings } = useSession()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPast, setShowPast] = useState(false)

  // Read on every render (the 3-second poll re-renders): the app can stay open past midnight.
  const today = todayLocalISODate()
  const choices = choicesOn(items, today)
  const state = gameOn(items, today, me)
  const partner = me === 'A' ? 'B' : 'A'
  const names = { A: settings.nameA, B: settings.nameB }
  const past = pastGames(items, today)

  async function handlePick(side: Side) {
    setSaving(true)
    try {
      await pick(side)
      setError(null)
    } catch {
      setError('저장하지 못했어요. 다시 시도해주세요.')
    } finally {
      setSaving(false)
    }
  }

  // Who to name under a choice: me as soon as I pick, the other person only once the game is open.
  const pickedBy = (side: Side) => [
    state.mine === side ? names[me] : null,
    state.open && state.theirs === side ? names[partner] : null,
  ].filter(Boolean).join(' · ')

  return (
    <div className={styles.card}>
      <div className={styles.choices}>
        {SIDES.map((side, i) => (
          <div key={side} className={styles.slot}>
            {i === 1 && <span className={styles.vs} aria-hidden="true">VS</span>}
            <button
              type="button"
              className={`${styles.choice} ${state.mine === side ? styles.mine : ''} ${state.open && state.theirs === side ? styles.theirs : ''} ${state.open && state.matched && state.mine === side ? styles.matched : ''}`}
              aria-pressed={state.mine === side}
              disabled={saving || state.mine !== null}
              onClick={() => handlePick(side)}
            >
              <span className={styles.text}>{choices[side]}</span>
              {pickedBy(side) && <span className={styles.who}>{pickedBy(side)}</span>}
            </button>
          </div>
        ))}
      </div>

      <div className={styles.status}>{gameStatus(state, names[partner])}</div>
      {(loadError || error) && <div className={styles.error}>{error ?? LOAD_ERROR}</div>}

      {past.length > 0 && (
        <button type="button" className={styles.pastToggle} aria-expanded={showPast} onClick={() => setShowPast((v) => !v)}>
          {showPast ? '지난 게임 접기' : `지난 게임 ${past.length}번 보기`}
        </button>
      )}
      {showPast && past.map((g) => (
        <div key={g.date} data-testid="past-game" className={styles.past}>
          <span className={styles.pastDate}>{shortDate(g.date)}</span>
          <span className={styles.pastBody}>
            {g.matched
              ? <>둘 다 <b>{g[g.picks.A]}</b></>
              : <>{names.A} <b>{g[g.picks.A]}</b> · {names.B} <b>{g[g.picks.B]}</b></>}
          </span>
          <span className={styles.pastMark}>{g.matched ? '🎉' : '😆'}</span>
        </div>
      ))}
    </div>
  )
}
