import { useEvents } from '../../hooks/useEvents'
import { useReactions } from '../../hooks/useReactions'
import { useSession } from '../../hooks/useSession'
import { reactionSummary } from '../../lib/reactions'
import { todayLocalISODate } from '../../lib/date'
import { eventTime, ownerLabel, upcomingEvents, whenLabel } from '../../lib/events'
import styles from './UpcomingEvents.module.css'

const LIMIT = 3

export function UpcomingEvents() {
  const { items } = useEvents()
  const { items: reactions } = useReactions()
  const { settings } = useSession()
  // Read on every render (the 3-second poll re-renders): the app can stay open past midnight.
  const today = todayLocalISODate()
  const upcoming = upcomingEvents(items, today, LIMIT)
  if (upcoming.length === 0) return null

  return (
    <div data-testid="upcoming-events" className={styles.card}>
      <div className={styles.eyebrow}>📅 다가오는 일정</div>
      {upcoming.map((e) => (
        <div key={e.id} data-testid="upcoming-row" className={styles.row}>
          <span className={styles.when}>{[whenLabel(e, today), eventTime(e)].filter(Boolean).join(' ')}</span>
          <span className={styles.what}>{e.title} · {ownerLabel(e.owner, settings)}</span>
          {reactionSummary(reactions, e.id) && <span className={styles.reacted}>{reactionSummary(reactions, e.id)}</span>}
        </div>
      ))}
    </div>
  )
}
