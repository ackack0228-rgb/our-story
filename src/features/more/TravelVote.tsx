import { useState } from 'react'
import { useVotes } from '../../hooks/useVotes'
import { useSession } from '../../hooks/useSession'
import { ConfirmDelete } from '../../components/ConfirmDelete'
import styles from './TravelVote.module.css'

function Heart({ filled }: { filled: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  )
}

// Each candidate is a boarding pass: the trip on the left, the tear-off stub on the right holds the vote.
export function TravelVote() {
  const { items, add, toggleLike, remove, error: loadError } = useVotes()
  const { me, settings } = useSession()
  const [formOpen, setFormOpen] = useState(false)
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  async function handleAdd() {
    const n = name.trim()
    if (!n) return
    try {
      await add(n, note.trim())
      setName('')
      setNote('')
      setFormOpen(false)
      setError(null)
    } catch {
      setError('추가하지 못했어요. 다시 시도해주세요.')
    }
  }

  async function handleToggleLike(id: string) {
    try {
      await toggleLike(id)
      setError(null)
    } catch {
      setError('반응을 저장하지 못했어요. 다시 시도해주세요.')
    }
  }

  async function handleRemove(id: string) {
    try {
      await remove(id)
      setConfirmId(null)
      setError(null)
    } catch {
      setError('삭제하지 못했어요. 다시 시도해주세요.')
    }
  }

  return (
    <div>
      {formOpen ? (
        <div className={styles.addWrap}>
          <input placeholder="여행지 후보 이름" value={name} onChange={(e) => setName(e.target.value)} />
          <input placeholder="한줄 메모 (선택)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className={styles.formActions}>
            <button className={styles.cancelBtn} onClick={() => setFormOpen(false)}>닫기</button>
            <button className={styles.addBtn} onClick={handleAdd}>후보 추가하기</button>
          </div>
        </div>
      ) : (
        <button className={styles.openForm} onClick={() => setFormOpen(true)}>+ 여행지 후보 올리기</button>
      )}

      {(loadError || error) && <div className={styles.error}>{loadError || error}</div>}

      {items.length === 0 && <div className={styles.empty}>다음 여행지 후보를 올려 보세요</div>}

      {items.map((v) => {
        const liked = v.likedBy.includes(me)
        const both = v.likedBy.length >= 2
        const aboard = (who: 'A' | 'B') => `${who === 'A' ? settings.nameA : settings.nameB} ${v.likedBy.includes(who) ? '탑승' : '아직'}`
        return (
          <div key={v.id} className={styles.ticketWrap}>
            <div className={styles.ticket}>
              <div className={styles.trip}>
                <div className={styles.route}>
                  <span>우리 집</span>
                  <svg width="22" height="10" viewBox="0 0 22 10" aria-hidden="true">
                    <path d="M1 5h18M15 1l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>다음 여행</span>
                </div>
                <div className={styles.name}>{v.name}</div>
                {v.note && <div className={styles.note}>{v.note}</div>}
                {/* Both aboard: the stamp says it, in place of the passenger line. */}
                {both ? (
                  <div className={styles.confirmed}>탑승 확정</div>
                ) : (
                  <div className={styles.aboard}>
                    <span className={v.likedBy.includes('A') ? '' : styles.notYet}>{aboard('A')}</span>
                    <span className={v.likedBy.includes('B') ? '' : styles.notYet}>{aboard('B')}</span>
                  </div>
                )}
              </div>
              <div className={styles.stub}>
                <button
                  className={`${styles.heart} ${liked ? styles.liked : ''}`}
                  aria-label={liked ? '좋아요 취소' : '좋아요'}
                  aria-pressed={liked}
                  onClick={() => handleToggleLike(v.id)}
                >
                  <Heart filled={liked} />
                </button>
                <div className={styles.count}>{v.likedBy.length}명</div>
                <button className={styles.del} onClick={() => setConfirmId(v.id)}>삭제</button>
              </div>
            </div>
            {confirmId === v.id && (
              <div className={styles.confirmBox}>
                <ConfirmDelete onConfirm={() => handleRemove(v.id)} onCancel={() => setConfirmId(null)} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
