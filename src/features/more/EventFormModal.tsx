import { useState } from 'react'
import { useSession } from '../../hooks/useSession'
import { NOTE_MAX, TITLE_MAX, dateSpan, eventEnd, eventTime, type CalendarEvent, type EventInput, type EventOwner } from '../../lib/events'
import styles from './EventFormModal.module.css'

interface Props {
  initial: CalendarEvent | null
  defaultDate: string
  onSave: (input: EventInput) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}

export function EventFormModal({ initial, defaultDate, onSave, onDelete, onClose }: Props) {
  const { me, settings } = useSession()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [date, setDate] = useState(initial?.date ?? defaultDate)
  const [endDate, setEndDate] = useState(initial && eventEnd(initial) !== initial.date ? eventEnd(initial) : '')
  const [time, setTime] = useState(initial ? eventTime(initial) : '')
  const [owner, setOwner] = useState<EventOwner>(initial?.owner ?? me)
  const [note, setNote] = useState(initial?.note ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const other = me === 'A' ? 'B' : 'A'
  const nameOf = (who: 'A' | 'B') => (who === 'A' ? settings.nameA : settings.nameB)
  const owners: { value: EventOwner; label: string }[] = [
    { value: me, label: nameOf(me) },
    { value: other, label: nameOf(other) },
    { value: 'both', label: '우리' },
  ]
  const heading = initial ? '일정 수정' : '일정 추가'
  // An end on the start day itself is just a one-day event.
  const endBeforeStart = endDate !== '' && date !== '' && endDate < date
  const savedEnd = endDate > date ? endDate : ''
  const span = date ? dateSpan({ date, endDate: savedEnd }) : ''

  // busy stays set after a success: the caller closes the form, and a second tap must not get through.
  async function run(action: () => Promise<void>, failure: string) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await action()
      onClose()
    } catch {
      setError(failure)
      setBusy(false)
    }
  }

  const handleSave = () =>
    run(
      () => onSave({ title: title.trim().slice(0, TITLE_MAX), date, endDate: savedEnd, time, owner, note: note.trim().slice(0, NOTE_MAX) }),
      '저장하지 못했어요. 다시 시도해주세요.',
    )

  return (
    <div className={styles.modalBg}>
      <div className={styles.modal} role="dialog" aria-label={heading}>
        <h3>{heading}</h3>
        <label className={styles.fieldLabel} htmlFor="event-title">제목</label>
        <input id="event-title" value={title} maxLength={TITLE_MAX} onChange={(e) => setTitle(e.target.value)} />
        <div className={styles.fieldLabel}>날짜 <span className={styles.soft}>· 여러 날이면 끝나는 날도</span></div>
        <div className={styles.dateRow}>
          <input aria-label="시작하는 날" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <span className={styles.tilde} aria-hidden="true">~</span>
          <div className={styles.endWrap}>
            <input aria-label="끝나는 날" type="date" value={endDate} min={date || undefined} onChange={(e) => setEndDate(e.target.value)} />
            {endDate && (
              <button type="button" className={styles.clearEnd} aria-label="끝나는 날 지우기" onClick={() => setEndDate('')}>✕</button>
            )}
          </div>
        </div>
        {endBeforeStart
          ? <div className={styles.error}>끝나는 날이 시작하는 날보다 앞이에요.</div>
          : span && <div className={styles.span}>{span}</div>}
        <label className={styles.fieldLabel} htmlFor="event-time">시간 (비우면 하루 종일)</label>
        <input id="event-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        <div className={styles.fieldLabel}>누구 일정</div>
        <div className={styles.ownerRow}>
          {owners.map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={owner === o.value}
              className={`${styles.ownerOpt} ${owner === o.value ? styles.selected : ''}`}
              onClick={() => setOwner(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
        <label className={styles.fieldLabel} htmlFor="event-note">메모 (선택)</label>
        <textarea id="event-note" rows={2} value={note} maxLength={NOTE_MAX} onChange={(e) => setNote(e.target.value)} />

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.actions}>
          {onDelete && (
            <button className={styles.danger} disabled={busy} onClick={() => run(onDelete, '삭제하지 못했어요. 다시 시도해주세요.')}>
              삭제
            </button>
          )}
          <button className={styles.ghost} onClick={onClose}>닫기</button>
          <button className={styles.primary} disabled={busy || title.trim() === '' || date === '' || endBeforeStart} onClick={handleSave}>
            저장하기
          </button>
        </div>
      </div>
    </div>
  )
}
