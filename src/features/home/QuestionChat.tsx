import { useEffect, useRef, useState } from 'react'
import { useSession } from '../../hooks/useSession'
import { todayLocalISODate } from '../../lib/date'
import { dayLabel } from '../../lib/events'
import { ANSWER_MAX, answersOn, chatDates, isLocked, questionFor, timeLabel, type Answer } from '../../lib/answers'
import styles from './QuestionChat.module.css'

interface Props {
  answers: Answer[]
  error: string | null
  onSend: (text: string) => Promise<void>
  onClose: () => void
}

export function QuestionChat({ answers, error, onSend, onClose }: Props) {
  const { me, settings } = useSession()
  // null = follow today, so a chat left open past midnight moves on to the new day.
  const [picked, setPicked] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const today = todayLocalISODate()
  const dates = chatDates(answers, today)
  const date = picked !== null && dates.includes(picked) ? picked : today
  const index = dates.indexOf(date)
  const day = answersOn(answers, date)
  const locked = isLocked(answers, date, me, today)
  const isToday = date === today
  const go = (to: string) => setPicked(to === today ? null : to)

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' })
  }, [day.length, date, locked])

  async function handleSend() {
    const body = text.trim()
    if (busy || body === '') return
    setBusy(true)
    setFailed(false)
    try {
      await onSend(body)
      setText('')
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.modalBg}>
      <div className={styles.modal} role="dialog" aria-label="오늘의 질문">
        <div className={styles.header}>
          <button className={styles.nav} aria-label="이전 날" disabled={index === 0} onClick={() => go(dates[index - 1])}>‹</button>
          <div className={styles.date} data-testid="chat-date">{dayLabel(date, today)}</div>
          <button className={styles.nav} aria-label="다음 날" disabled={index === dates.length - 1} onClick={() => go(dates[index + 1])}>›</button>
          <button className={styles.close} onClick={onClose}>닫기</button>
        </div>
        <div className={styles.question}>&quot;{questionFor(answers, date)}&quot;</div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.list}>
          {locked ? (
            <div className={styles.locked}>🔒 답하면 볼 수 있어요</div>
          ) : day.length === 0 ? (
            <div className={styles.empty}>첫 답을 남겨보세요</div>
          ) : (
            day.map((a) => {
              const mine = a.sender === me
              return (
                <div key={a.id} data-testid="bubble" data-mine={mine} className={`${styles.row} ${mine ? styles.mine : styles.theirs}`}>
                  {!mine && <div className={styles.name}>{a.sender === 'A' ? settings.nameA : settings.nameB}</div>}
                  <div className={styles.bubble}>{a.text}</div>
                  <div className={styles.time}>{timeLabel(a.createdAt)}</div>
                </div>
              )
            })
          )}
          <div ref={endRef} />
        </div>

        {failed && <div className={styles.error}>보내지 못했어요. 다시 시도해주세요.</div>}

        {isToday ? (
          <div className={styles.composer}>
            <textarea
              aria-label="답 쓰기"
              rows={2}
              value={text}
              maxLength={ANSWER_MAX}
              placeholder="내 답을 적어보세요"
              onChange={(e) => setText(e.target.value)}
            />
            <button className={styles.send} disabled={busy || text.trim() === ''} onClick={handleSend}>보내기</button>
          </div>
        ) : (
          <div className={styles.readOnly}>지난 날의 대화예요</div>
        )}
      </div>
    </div>
  )
}
