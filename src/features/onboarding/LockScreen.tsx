import { useState, type FormEvent } from 'react'
import { unlock } from '../../lib/auth'
import styles from './LockScreen.module.css'

export function LockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!password || busy) return
    setBusy(true)
    setMessage(null)
    const result = await unlock(password)
    setBusy(false)
    if (result === 'ok') onUnlocked()
    else setMessage(result === 'wrong' ? '비밀번호가 맞지 않아요.' : '서버에 연결하지 못했어요. 다시 시도해주세요.')
  }

  return (
    <form className={styles.wrap} onSubmit={handleSubmit}>
      <div className={styles.mark} aria-hidden="true">♥</div>
      <h1 className={styles.title}>우리의 이야기</h1>
      <label className={styles.label} htmlFor="lock-password">비밀번호</label>
      <input
        id="lock-password"
        className={styles.input}
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {message && <div className={styles.message} role="alert">{message}</div>}
      <button className={styles.primary} type="submit" disabled={busy}>들어가기</button>
    </form>
  )
}
