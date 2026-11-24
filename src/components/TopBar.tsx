import { useSession } from '../hooks/useSession'
import styles from './TopBar.module.css'

export function TopBar({ onSettings }: { onSettings: () => void }) {
  const { settings } = useSession()
  return (
    <div className={styles.topbar}>
      <div className={styles.names}>{settings.nameA} ♥ {settings.nameB}</div>
      <button className={styles.iconBtn} onClick={onSettings} aria-label="설정">⚙</button>
    </div>
  )
}
