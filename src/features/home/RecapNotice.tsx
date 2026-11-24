import { useRecapSource } from '../../hooks/useRecapSource'
import { todayLocalISODate } from '../../lib/date'
import { monthRecap, type YearMonth } from '../../lib/recap'
import styles from './RecapNotice.module.css'

// Shown by Home for the first week of a month: last month's recap is ready. Home mounts it only
// then, so the rest of the month the home screen does not load the collections it reads.
export function RecapNotice({ month, onOpen }: { month: YearMonth; onOpen: () => void }) {
  const { source } = useRecapSource()
  if (monthRecap(source, month, todayLocalISODate()).empty) return null

  return (
    <button type="button" className={styles.card} onClick={onOpen}>
      <span className={styles.what}>📖 {month.month}월 돌아보기가 나왔어요</span>
      <span className={styles.go}>보러 가기 ›</span>
    </button>
  )
}
