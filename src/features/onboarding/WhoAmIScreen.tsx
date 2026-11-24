import type { Settings } from '../../lib/api'
import type { Who } from '../../hooks/useSession'
import styles from './WhoAmIScreen.module.css'

export function WhoAmIScreen({ settings, onPick }: { settings: Settings; onPick: (who: Who) => void }) {
  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>누구세요?</h1>
      <div className={styles.actions}>
        <button className={styles.primary} onClick={() => onPick('A')}>
          {settings.nameA}
        </button>
        <button className={styles.ghost} onClick={() => onPick('B')}>
          {settings.nameB}
        </button>
      </div>
    </div>
  )
}
