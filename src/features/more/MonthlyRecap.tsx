import { useState } from 'react'
import { useRecapSource } from '../../hooks/useRecapSource'
import { useSession } from '../../hooks/useSession'
import { todayLocalISODate } from '../../lib/date'
import { earliestMonth, monthKey, monthOf, monthRecap, shiftRecapMonth, type YearMonth } from '../../lib/recap'
import styles from './MonthlyRecap.module.css'
import { LOAD_ERROR } from '../../hooks/useCollection'

const PLACES_SHOWN = 5

export function MonthlyRecap({ startAt = null }: { startAt?: YearMonth | null }) {
  const { source, loading, error } = useRecapSource()
  const { settings } = useSession()
  // null follows the current month, so a screen left open over the 1st moves on by itself.
  const [picked, setPicked] = useState<YearMonth | null>(startAt)
  // Read on every render (the 3-second poll re-renders): the app can stay open past midnight.
  const today = todayLocalISODate()
  const current = monthOf(today)
  const first = earliestMonth(source, today)
  const month = picked && monthKey(picked) <= monthKey(current) ? picked : current
  const ongoing = monthKey(month) === monthKey(current)
  const recap = monthRecap(source, month, today)

  function go(delta: number) {
    const next = shiftRecapMonth(month, delta)
    setPicked(monthKey(next) === monthKey(current) ? null : next)
  }

  const tiles = [
    { icon: '📍', value: recap.places.length, unit: '곳', label: '다녀온 곳' },
    { icon: '💗', value: recap.together, unit: '번', label: '함께한 일정' },
    { icon: '🎨', value: recap.doodles, unit: '개', label: '낙서' },
    { icon: '💌', value: recap.notes, unit: '개', label: '한마디' },
    { icon: '💬', value: recap.chats, unit: '일', label: '같이 답한 질문' },
    { icon: '⭐', value: recap.reviews, unit: '개', label: '후기' },
  ]
  const moods = [
    { name: settings.nameA, value: recap.mood.A },
    { name: settings.nameB, value: recap.mood.B },
  ].filter((m): m is { name: string; value: number } => m.value !== null)
  const morePlaces = recap.places.length - PLACES_SHOWN

  return (
    <div>
      <div className={styles.header}>
        <button className={styles.nav} aria-label="이전 달" disabled={monthKey(month) <= monthKey(first)} onClick={() => go(-1)}>‹</button>
        <div className={styles.title}>{month.year}년 {month.month}월</div>
        <button className={styles.nav} aria-label="다음 달" disabled={ongoing} onClick={() => go(1)}>›</button>
      </div>

      {error && <div className={styles.error}>{LOAD_ERROR}</div>}

      <div className={styles.card}>
        <div className={styles.heading}>{month.month}월의 우리</div>
        <div className={styles.sub}>
          {ongoing ? `아직 진행 중이에요 · ${Number(today.slice(5, 7))}/${Number(today.slice(8, 10))}까지` : '한 달 동안 이렇게 지냈어요'}
        </div>

        {recap.empty ? (
          <div className={styles.empty}>{loading ? '불러오는 중…' : '이 달에는 남긴 기록이 없어요'}</div>
        ) : (
          <>
            <div className={styles.tiles}>
              {tiles.map((t) => (
                <div key={t.label} data-testid="recap-tile" className={`${styles.tile} ${t.value === 0 ? styles.zero : ''}`}>
                  <div className={styles.tileLabel}>{t.icon} {t.label}</div>
                  <div className={styles.tileValue}>{t.value}<span>{t.unit}</span></div>
                </div>
              ))}
            </div>

            <div className={styles.lines}>
              {recap.places.length > 0 && (
                <div className={styles.line}>
                  <span>다녀온 곳</span>
                  <b>
                    {recap.places.slice(0, PLACES_SHOWN).join(' · ')}
                    {morePlaces > 0 && ` 외 ${morePlaces}곳`}
                    {recap.regions > 1 && ` (${recap.regions}개 지역)`}
                  </b>
                </div>
              )}
              {moods.length > 0 && (
                <div className={styles.line}>
                  <span>기분 평균</span>
                  <b>{moods.map((m) => `${m.name} ${m.value}`).join(' · ')}</b>
                </div>
              )}
              {recap.bestReview && (
                <div className={styles.line}>
                  <span>최고의 후기</span>
                  <b>{recap.bestReview.name} {'★'.repeat(Math.min(5, Math.round(recap.bestReview.rating)))}</b>
                </div>
              )}
              {recap.balance.played > 0 && (
                <div className={styles.line}>
                  <span>밸런스 게임</span>
                  <b>{recap.balance.played}번 중 {recap.balance.matched}번 통했어요</b>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
