import { useState } from 'react'
import { useSession } from '../../hooks/useSession'
import { reactionsFor, type Reaction, type ReactionKey } from '../../lib/reactions'
import { COMMENT_MAX, commentTime, commentsFor, type PlaceComment } from '../../lib/comments'
import type { Who } from '../../../supabase/functions/_shared/rules'
import styles from './PlaceSocial.module.css'

interface Props {
  place: { id: string; name: string }
  reactions: Reaction[]
  comments: PlaceComment[]
  onReact: (place: { id: string; name: string }, key: ReactionKey) => Promise<void>
  onComment: (place: { id: string; name: string }, text: string) => Promise<void>
  onDeleteComment: (id: string) => Promise<void>
}

// Reactions and comments under one place record. RecordList loads the data once and hands it to every card.
export function PlaceSocial({ place, reactions, comments, onReact, onComment, onDeleteComment }: Props) {
  const { me, settings } = useSession()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const thread = commentsFor(comments, place.id)
  const nameOf = (who: Who) => (who === 'A' ? settings.nameA : settings.nameB)

  async function run(action: () => Promise<void>, failure: string) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch {
      setError(failure)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.social}>
      <div className={styles.row}>
        {reactionsFor(reactions, place.id).map((g) => {
          const mine = g.who.includes(me)
          return (
            <button
              key={g.key}
              aria-label={`${g.emoji} 반응`}
              aria-pressed={mine}
              disabled={busy}
              className={`${styles.reaction} ${mine ? styles.reacted : ''}`}
              onClick={() => run(() => onReact({ id: place.id, name: place.name }, g.key), '반응을 남기지 못했어요. 다시 시도해주세요.')}
            >
              {g.emoji}
              {g.who.length > 0 && <span className={styles.reactors}>{g.who.map(nameOf).join(' ')}</span>}
            </button>
          )
        })}
        <button className={styles.toggle} aria-expanded={open} onClick={() => setOpen(!open)}>
          💬 {thread.length > 0 ? `댓글 ${thread.length}` : '댓글'}
        </button>
      </div>

      {open && (
        <div className={styles.thread}>
          {thread.map((c) => (
            <div key={c.id} className={`${styles.comment} ${c.sender === me ? styles.mine : ''}`}>
              <div className={styles.meta}>
                <b>{nameOf(c.sender)}</b>
                <span>{commentTime(c.createdAt)}</span>
                {c.sender === me && (
                  <button
                    className={styles.del}
                    aria-label="댓글 삭제"
                    disabled={busy}
                    onClick={() => run(() => onDeleteComment(c.id), '삭제하지 못했어요. 다시 시도해주세요.')}
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className={styles.text}>{c.text}</div>
            </div>
          ))}
          {thread.length === 0 && <div className={styles.empty}>첫 댓글을 남겨 보세요</div>}
          <div className={styles.compose}>
            <textarea
              aria-label="댓글"
              rows={1}
              maxLength={COMMENT_MAX}
              placeholder="이 기록에 한마디"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button
              className={styles.send}
              disabled={busy || text.trim() === ''}
              onClick={() => run(async () => { await onComment({ id: place.id, name: place.name }, text); setText('') }, '댓글을 남기지 못했어요. 다시 시도해주세요.')}
            >
              보내기
            </button>
          </div>
        </div>
      )}
      {error && <div className={styles.error}>{error}</div>}
    </div>
  )
}
