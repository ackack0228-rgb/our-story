import { useEffect, useState } from 'react'
import { CartesianGrid, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useMoodLogs } from '../../hooks/useMoodLogs'
import { useSession } from '../../hooks/useSession'
import { buildMoodChartData } from './moodChartData'
import { todayLocalISODate } from '../../lib/date'
import { logsInPeriod, moodPeriod } from '../../lib/moodLogs'
import styles from './MoodTracker.module.css'

const MOOD_EMOJIS = ['😭', '😢', '😔', '😕', '😐', '🙂', '😊', '😄', '🥰', '😆', '🤩']
const COLOR_A = '#E8959C'
const COLOR_B = '#D9A87E'
const AXIS_TICK = { fill: 'currentColor', opacity: 0.6, fontSize: 11 }

interface DotProps {
  cx?: number
  cy?: number
  payload?: { a: number | null; b: number | null }
}

// When both people picked the same number that day the two dots would land on the same spot,
// so they step aside to sit next to each other.
function moodDot(color: string, side: -1 | 1) {
  return function MoodDot({ cx, cy, payload }: DotProps) {
    if (cx == null || cy == null) return <g />
    const same = payload != null && payload.a != null && payload.a === payload.b
    return <circle cx={cx + (same ? side * 6 : 0)} cy={cy} r={5} fill={color} />
  }
}

const DotA = moodDot(COLOR_A, -1)
const DotB = moodDot(COLOR_B, 1)
const shortDate = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`

/** The card's light follows the slider: dawn blue when low, dusk violet in the middle, sunset rose when high. */
function moodLight(value: number): 'dawn' | 'dusk' | 'glow' {
  return value <= 3 ? 'dawn' : value <= 6 ? 'dusk' : 'glow'
}

export function MoodTracker() {
  const { logs, saveToday, error: loadError } = useMoodLogs()
  const { settings, me } = useSession()
  const [value, setValue] = useState(5)
  const [hasLoadedToday, setHasLoadedToday] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const today = todayLocalISODate()
  const todayOf = (who: 'A' | 'B') => logs.find((l) => l.date === today && l.who === who)

  useEffect(() => {
    if (hasLoadedToday) return
    const mine = logs.find((l) => l.date === today && l.who === me)
    if (mine) {
      setValue(mine.value)
      setHasLoadedToday(true)
    }
  }, [logs, me, hasLoadedToday, today])

  async function handleSave() {
    if (busy) return
    setBusy(true)
    try {
      await saveToday(value)
      setError(null)
      setSaved(true)
    } catch {
      setSaved(false)
      setError('저장하지 못했어요. 다시 시도해주세요.')
    } finally {
      setBusy(false)
    }
  }

  const todayLabel = (who: 'A' | 'B') => {
    const log = todayOf(who)
    return log ? <b className={styles.todayVal}>{`${MOOD_EMOJIS[log.value]} ${log.value}`}</b> : null
  }

  // The graph shows the current two weeks and starts over when the next two begin.
  const period = moodPeriod(today)
  const chartData = buildMoodChartData(logsInPeriod(logs, today), ['A', 'B'])

  return (
    <div>
      <div className={`${styles.wrap} ${styles[moodLight(value)]}`} data-light={moodLight(value)}>
        <div className={styles.emojiBig}>{MOOD_EMOJIS[value]}</div>
        <div className={styles.valLabel}>{value} / 10</div>
        <input
          type="range"
          min={0}
          max={10}
          value={value}
          className={styles.slider}
          onChange={(e) => {
            setValue(Number(e.target.value))
            setSaved(false)
          }}
        />
        <div className={styles.ends} aria-hidden="true"><span>{MOOD_EMOJIS[0]}</span><span>{MOOD_EMOJIS[10]}</span></div>
        <button className={styles.saveBtn} disabled={busy} onClick={handleSave}>오늘 기분 기록하기</button>
        {saved && !error && <div className={styles.saved}>오늘 기분을 기록했어요 ✓</div>}
        {(loadError || error) && <div className={styles.error}>{loadError || error}</div>}
      </div>

      <div className={styles.chartCard}>
        <div className={styles.chartHead}>
          <div className={styles.chartTitle}>우리의 기분</div>
          <div className={styles.period}>{shortDate(period.start)} ~ {shortDate(period.end)}</div>
        </div>
        <div className={styles.legend}>
          <span><i className={styles.dotA} />{settings.nameA}{todayLabel('A')}</span>
          <span><i className={styles.dotB} />{settings.nameB}{todayLabel('B')}</span>
        </div>
        {chartData.length === 0 ? (
          <div className={styles.empty}>오늘 기분을 기록하면 그래프가 나타나요</div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.12} />
              <XAxis
                dataKey="date"
                tickFormatter={shortDate}
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                padding={{ left: 20, right: 20 }}
              />
              <YAxis domain={[0, 10]} ticks={[0, 5, 10]} tick={AXIS_TICK} tickLine={false} axisLine={false} width={28} />
              <Tooltip />
              <Line type="monotone" dataKey="a" name={settings.nameA} stroke={COLOR_A} strokeWidth={2.5} dot={<DotA />} connectNulls isAnimationActive={false} />
              <Line type="monotone" dataKey="b" name={settings.nameB} stroke={COLOR_B} strokeWidth={2.5} dot={<DotB />} connectNulls isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
        <div className={styles.periodNote}>그래프는 2주마다 새로 시작해요</div>
      </div>
    </div>
  )
}
