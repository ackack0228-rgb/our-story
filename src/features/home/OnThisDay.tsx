import { usePlaces } from '../../hooks/usePlaces'
import { todayLocalISODate } from '../../lib/date'
import { onThisDay } from '../../lib/onThisDay'
import styles from './OnThisDay.module.css'

export function OnThisDay() {
  const { places } = usePlaces()
  // Read on every render (the 3-second poll re-renders): the app can stay open past midnight.
  const today = todayLocalISODate()
  const memories = onThisDay(places, today)
  if (memories.length === 0) return null

  return (
    <div data-testid="on-this-day" className={styles.wrap}>
      {memories.map(({ place, yearsAgo }) => (
        <div key={place.id} className={styles.card}>
          <div className={styles.eyebrow} data-testid="on-this-day-eyebrow">{yearsAgo}년 전 오늘</div>
          <div className={styles.name}>{`${place.name} ${place.mood}`}</div>
          {place.photoUrl && (
            <img className={styles.photo} src={place.photoUrl} alt={place.name} loading="lazy" />
          )}
          {place.diary && <p className={styles.diary}>{place.diary}</p>}
        </div>
      ))}
    </div>
  )
}
