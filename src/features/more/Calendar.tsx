import { useState } from 'react'
import { useEvents } from '../../hooks/useEvents'
import { useReactions } from '../../hooks/useReactions'
import { useSession } from '../../hooks/useSession'
import { reactionsFor, type ReactionKey } from '../../lib/reactions'
import { todayLocalISODate } from '../../lib/date'
import { dateSpan, eventsOn, eventTime, monthGrid, ownerLabel, dayPreview, shiftMonth, WEEKDAYS, type CalendarEvent } from '../../lib/events'
import { EventFormModal } from './EventFormModal'
import styles from './Calendar.module.css'

const monthOf = (date: string) => ({ year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) })
const dayOf = (date: string) => Number(date.slice(8))
// How many event titles fit under a date in the month grid.
const CELL_EVENTS = 2
const CHIP = { A: styles.chipA, B: styles.chipB, both: styles.chipBoth }

export function Calendar() {
  const { items, add, update, remove, error: loadError } = useEvents()
  const { me, settings } = useSession()
  const reactions = useReactions()
  // null = follow today, so a calendar left open past midnight moves with the date. A month or day
  // the user chose stays put.
  const [viewed, setView] = useState<{ year: number; month: number } | null>(null)
  const [picked, setSelected] = useState<string | null>(null)
  const today = todayLocalISODate()
  const view = viewed ?? monthOf(today)
  const selected = picked ?? today
  // null = closed; { event: null } = adding; { event } = editing that one.
  const [form, setForm] = useState<{ event: CalendarEvent | null } | null>(null)

  const [reacting, setReacting] = useState(false)
  const [reactError, setReactError] = useState<string | null>(null)

  const dayEvents = eventsOn(items, selected)
  const editing = form?.event ?? null

  async function handleReact(event: CalendarEvent, key: ReactionKey) {
    if (reacting) return
    setReacting(true)
    setReactError(null)
    try {
      await reactions.toggle(event, key)
    } catch {
      setReactError('반응을 남기지 못했어요. 다시 시도해주세요.')
    } finally {
      setReacting(false)
    }
  }

  return (
    <div>
      <div className={styles.header}>
        <button className={styles.nav} aria-label="이전 달" onClick={() => setView(shiftMonth(view.year, view.month, -1))}>‹</button>
        <button className={styles.title} onClick={() => { setView(null); setSelected(null) }}>
          {view.year}년 {view.month}월
        </button>
        <button className={styles.nav} aria-label="다음 달" onClick={() => setView(shiftMonth(view.year, view.month, 1))}>›</button>
      </div>

      {loadError && <div className={styles.error}>{loadError}</div>}

      <div className={styles.card}>
      <div className={styles.grid}>
        {WEEKDAYS.map((w) => <div key={w} className={styles.weekday}>{w}</div>)}
        {monthGrid(view.year, view.month).map((date, i) =>
          date === null ? (
            <div key={`blank-${i}`} />
          ) : (
            <button
              key={date}
              aria-label={`${view.month}월 ${dayOf(date)}일`}
              aria-pressed={date === selected}
              className={`${styles.day} ${date === today ? styles.today : ''} ${date === selected ? styles.selected : ''}`}
              onClick={() => setSelected(date)}
            >
              <span className={styles.num}>{dayOf(date)}</span>
              <DayPreview events={items} date={date} />
            </button>
          ),
        )}
      </div>

      <div className={styles.legend}>
        <span><i className={styles.chipA} />{settings.nameA}</span>
        <span><i className={styles.chipB} />{settings.nameB}</span>
        <span><i className={styles.chipBoth} />함께</span>
      </div>
      </div>

      <div className={styles.dayTitle}>{monthOf(selected).month}월 {dayOf(selected)}일</div>
      {dayEvents.length === 0 && <div className={styles.empty}>이 날은 일정이 없어요</div>}
      {reactError && <div className={styles.error}>{reactError}</div>}
      {dayEvents.map((e) => (
        <div key={e.id} className={styles.eventWrap}>
          <button data-testid="event-row" className={styles.event} onClick={() => setForm({ event: e })}>
            <span className={styles.time}>{eventTime(e) || '하루 종일'}</span>
            <span className={styles.body}>
              <span className={styles.eventTitle}>{e.title}</span>
              <span className={styles.owner}>{[ownerLabel(e.owner, settings), dateSpan(e)].filter(Boolean).join(' · ')}</span>
              {e.note && <span className={styles.note}>{e.note}</span>}
            </span>
          </button>
          <div className={styles.reactions}>
            {reactionsFor(reactions.items, e.id).map((g) => {
              const mine = g.who.includes(me)
              return (
                <button
                  key={g.key}
                  aria-label={`${g.emoji} 반응`}
                  aria-pressed={mine}
                  disabled={reacting}
                  className={`${styles.reaction} ${mine ? styles.reacted : ''}`}
                  onClick={() => handleReact(e, g.key)}
                >
                  {g.emoji}
                  {g.who.length > 0 && <span className={styles.reactors}>{g.who.map((who) => ownerLabel(who, settings)).join(' ')}</span>}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      <button className={styles.addBtn} onClick={() => setForm({ event: null })}>+ 일정 추가</button>

      {form && (
        <EventFormModal
          initial={editing}
          defaultDate={selected}
          onSave={(input) => (editing ? update(editing.id, input) : add(input))}
          onDelete={editing ? async () => {
            await remove(editing.id)
            await reactions.clearFor(editing.id)
          } : undefined}
          onClose={() => setForm(null)}
        />
      )}
    </div>
  )
}

// The short titles under a date. The cell's own label already names the day, so these are for the eye only.
function DayPreview({ events, date }: { events: CalendarEvent[]; date: string }) {
  const { shown, more } = dayPreview(events, date, CELL_EVENTS)
  return (
    <span className={styles.preview} aria-hidden="true">
      {shown.map((e) => (
        <span key={e.id} data-owner={e.owner} className={`${styles.chip} ${CHIP[e.owner]}`}>{e.title}</span>
      ))}
      {more > 0 && <span className={styles.more}>+{more}</span>}
    </span>
  )
}
