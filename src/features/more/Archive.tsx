import { useState } from 'react'
import { useArchive } from '../../hooks/useArchive'
import { ARCHIVE_TYPES, type ArchiveItem, type ArchiveType, type ReviewDraft } from '../../lib/archive'
import { Segmented } from '../../components/Segmented'
import { ConfirmDelete } from '../../components/ConfirmDelete'
import styles from './Archive.module.css'

interface Props {
  /** A bucket list item that was just finished: the form opens filled in for it. */
  draft?: ReviewDraft | null
}

const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n)

/** 'YYYY-MM-DD' → the two lines of a postmark: year, then month.day. */
function postmark(date: string): [string, string] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  return m ? [m[1], `${Number(m[2])}.${Number(m[3])}`] : ['', date]
}

export function Archive({ draft }: Props) {
  const { items, add, remove, error: loadError } = useArchive()
  const [type, setType] = useState<ArchiveType>(draft?.type ?? 'food')
  const [formOpen, setFormOpen] = useState(Boolean(draft))
  const [name, setName] = useState(draft?.name ?? '')
  const [fromBucket, setFromBucket] = useState(Boolean(draft))
  const [rating, setRating] = useState(5)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const filtered = items.filter((i) => i.type === type)
  const typeLabel = ARCHIVE_TYPES.find((t) => t.key === type)?.label

  async function handleAdd() {
    const n = name.trim()
    if (!n) return
    try {
      await add(type, n, rating, note.trim())
      setName('')
      setNote('')
      setRating(5)
      setFromBucket(false)
      setFormOpen(false)
      setError(null)
    } catch {
      setError('추가하지 못했어요. 다시 시도해주세요.')
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

  // Each kind keeps its own keepsake: a cinema ticket, a till receipt, a postcard.
  function renderCard(item: ArchiveItem) {
    const del = (
      <button className={styles.del} onClick={() => setConfirmId(item.id)} aria-label="삭제">✕</button>
    )
    const confirm = confirmId === item.id && (
      <ConfirmDelete onConfirm={() => handleRemove(item.id)} onCancel={() => setConfirmId(null)} />
    )

    if (item.type === 'movie') {
      return (
        <div key={item.id} className={styles.shadow}>
          <div className={styles.ticket}>
            <div className={styles.stub} aria-hidden="true"><span>영화</span></div>
            <div className={styles.ticketBody}>
              <div className={styles.top}>
                <div className={styles.name}>{item.name}</div>
                <div className={styles.stars}>{stars(item.rating)}</div>
              </div>
              {item.note && <div className={styles.note}>{item.note}</div>}
              <div className={styles.foot}>
                <span className={styles.date}>{item.date.replace(/-/g, '.')}</span>
                {del}
              </div>
              {confirm}
            </div>
          </div>
        </div>
      )
    }

    if (item.type === 'food') {
      return (
        <div key={item.id} className={styles.shadow}>
          <div className={styles.receipt}>
            <div className={styles.receiptName}>{item.name}</div>
            <div className={styles.receiptMeta}>{item.date} · 맛집</div>
            <div className={styles.rule} />
            <div className={styles.row}><span>별점</span><span className={styles.stars}>{stars(item.rating)}</span></div>
            {item.note && <div className={styles.row}><span className={styles.rowLabel}>한줄 후기</span><span className={styles.rowValue}>{item.note}</span></div>}
            <div className={styles.rule} />
            <div className={styles.receiptFoot}>{del}</div>
            {confirm}
          </div>
        </div>
      )
    }

    const [year, day] = postmark(item.date)
    return (
      <div key={item.id} className={styles.postcard}>
        <div className={styles.stampWrap}>
          <span className={styles.stamp} aria-hidden="true">
            <svg viewBox="0 0 58 58" width="100%" height="100%">
              <rect width="58" height="58" fill="#E9C6B5" />
              <circle cx="40" cy="16" r="7" fill="#F4E0C9" />
              <path d="M0 40c10-6 18-6 29 0s19 6 29 0v18H0z" fill="#C4707E" />
              <path d="M0 47c10-5 18-5 29 0s19 5 29 0v11H0z" fill="#8E5A6E" />
            </svg>
          </span>
          <span className={styles.postmark} aria-label={item.date}>
            <span aria-hidden="true">{year}</span>
            <b aria-hidden="true">{day}</b>
          </span>
        </div>
        <div className={styles.postBody}>
          <div className={styles.top}>
            <div className={styles.name}>{item.name}</div>
            <div className={styles.stars}>{stars(item.rating)}</div>
          </div>
          {item.note && <div className={styles.note}>{item.note}</div>}
          <div className={styles.postFoot}>{del}</div>
          {confirm}
        </div>
      </div>
    )
  }

  return (
    <div>
      <Segmented options={ARCHIVE_TYPES} active={type} onChange={setType} />

      {formOpen ? (
        <div className={styles.form}>
          {fromBucket && <div className={styles.hint}>버킷리스트 완료! 🎉 후기를 남겨 보세요</div>}

          <div className={styles.fieldLabel}>이름</div>
          <input className={styles.input} placeholder="이름을 입력하세요" value={name} onChange={(e) => setName(e.target.value)} />

          <div className={styles.fieldLabel}>별점</div>
          <div className={styles.starRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                className={`${styles.star} ${n <= rating ? styles.filled : ''}`}
                onClick={() => setRating(n)}
              >★</button>
            ))}
          </div>

          <div className={styles.fieldLabel}>한줄 후기</div>
          <input className={styles.input} placeholder="한줄 후기 (선택)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className={styles.formActions}>
            <button className={styles.cancelBtn} onClick={() => { setFormOpen(false); setFromBucket(false) }}>닫기</button>
            <button className={styles.addBtn} onClick={handleAdd}>후기 남기기</button>
          </div>
        </div>
      ) : (
        <button className={styles.openForm} onClick={() => setFormOpen(true)}>+ {typeLabel} 후기 쓰기</button>
      )}

      {(loadError || error) && <div className={styles.error}>{loadError || error}</div>}

      {filtered.length === 0 && (
        <div className={styles.empty}>아직 남긴 {typeLabel} 후기가 없어요</div>
      )}
      {filtered.map(renderCard)}
    </div>
  )
}
