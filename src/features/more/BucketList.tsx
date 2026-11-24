import { useState } from 'react'
import { useBucket, type BucketEdit } from '../../hooks/useBucket'
import { BUCKET_CATEGORIES, BUCKET_NOTE_MAX, type BucketCategory, type BucketItem } from '../../lib/bucket'
import { mapLinkLabel, pickMapLink } from '../../lib/mapLink'
import { reviewTypeFor, type ReviewDraft } from '../../lib/archive'
import { Segmented } from '../../components/Segmented'
import { ConfirmDelete } from '../../components/ConfirmDelete'
import styles from './BucketList.module.css'

function categoryLabel(key: string) {
  return BUCKET_CATEGORIES.find((c) => c.key === key)?.label ?? ''
}

interface EditProps {
  item: BucketItem
  onSave: (changes: BucketEdit) => Promise<void>
  onCancel: () => void
}

/** The card an item turns into while it is being changed. */
function EditCard({ item, onSave, onCancel }: EditProps) {
  const [text, setText] = useState(item.text)
  const [category, setCategory] = useState<BucketCategory>(item.category)
  const [note, setNote] = useState(item.note ?? '')
  const [link, setLink] = useState(item.link ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    const t = text.trim()
    if (!t) {
      setError('이름을 적어 주세요.')
      return
    }
    let picked: string | null = null
    if (category === 'food' && link.trim()) {
      picked = pickMapLink(link)
      if (!picked) {
        setError('카카오맵이나 네이버지도 링크만 넣을 수 있어요.')
        return
      }
    }
    setSaving(true)
    try {
      await onSave({ text: t, category, note: note.trim() || null, link: picked })
    } catch {
      setError('저장하지 못했어요. 다시 시도해주세요.')
      setSaving(false)
    }
  }

  return (
    <div className={`${styles.item} ${styles.editing}`}>
      <div className={styles.addRow}>
        <input aria-label="고칠 이름" value={text} onChange={(e) => setText(e.target.value)} />
        <select aria-label="고칠 종류" value={category} onChange={(e) => setCategory(e.target.value as BucketCategory)}>
          {BUCKET_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>
      </div>
      <input
        className={styles.extraInput}
        aria-label="고칠 설명"
        placeholder="간단한 설명 (선택)"
        maxLength={BUCKET_NOTE_MAX}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {category === 'food' && (
        <input
          className={styles.extraInput}
          aria-label="고칠 지도 링크"
          placeholder="카카오맵 · 네이버지도 링크 (선택)"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          value={link}
          onChange={(e) => setLink(e.target.value)}
        />
      )}
      {error && <div className={styles.editError}>{error}</div>}
      <div className={styles.editActions}>
        <button className={styles.cancelBtn} onClick={onCancel} disabled={saving}>취소</button>
        <button className={styles.addBtn} onClick={handleSave} disabled={saving}>{saving ? '저장 중…' : '저장'}</button>
      </div>
    </div>
  )
}

/** How long the 완료 stamp shows before the card leaves. None when the phone asks for less motion (or can't say). */
function stampPause(): Promise<void> {
  const still = typeof window.matchMedia !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return still ? Promise.resolve() : new Promise((r) => setTimeout(r, 700))
}

interface Props {
  /** Called after an item that can be reviewed (맛집·영화·여행지) is marked done. */
  onReview?: (draft: ReviewDraft) => void
}

export function BucketList({ onReview }: Props) {
  const { items, add, edit, toggle, remove, error: loadError } = useBucket()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [note, setNote] = useState('')
  const [link, setLink] = useState('')
  const [category, setCategory] = useState<BucketCategory>('destination')
  const [error, setError] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [showFinished, setShowFinished] = useState(false)
  const [stampingId, setStampingId] = useState<string | null>(null)

  const done = items.filter((i) => i.done).length
  const total = items.length
  const pct = total ? (done / total) * 100 : 0
  // The tab on top decides the kind: adding under 맛집 makes a 맛집.
  // A finished item leaves the list; it stays saved (and counted above) with done: true.
  const filtered = items.filter((i) => i.category === category && !i.done)
  const finished = items.filter((i) => i.category === category && i.done)
  const placeholder = BUCKET_CATEGORIES.find((c) => c.key === category)?.placeholder

  async function handleAdd() {
    const t = text.trim()
    if (!t) return
    const extra: { note?: string; link?: string } = {}
    if (note.trim()) extra.note = note.trim()
    if (category === 'food' && link.trim()) {
      const picked = pickMapLink(link)
      if (!picked) {
        setError('카카오맵이나 네이버지도 링크만 넣을 수 있어요.')
        return
      }
      extra.link = picked
    }
    try {
      await add(t, category, extra)
      setText('')
      setNote('')
      setLink('')
      setError(null)
    } catch {
      setError('추가하지 못했어요. 다시 시도해주세요.')
    }
  }

  async function handleDone(item: BucketItem) {
    if (stampingId) return
    setStampingId(item.id)
    await stampPause()
    try {
      await toggle(item.id, true)
      setError(null)
      const type = reviewTypeFor(item.category)
      if (type) onReview?.({ type, name: item.text })
    } catch {
      setError('상태를 변경하지 못했어요. 다시 시도해주세요.')
    } finally {
      setStampingId(null)
    }
  }

  async function handleUndo(item: BucketItem) {
    try {
      await toggle(item.id, false)
      setError(null)
    } catch {
      setError('상태를 변경하지 못했어요. 다시 시도해주세요.')
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
      <div className={styles.summary}>
        <div className={styles.progressLabel}>{done} / {total} 완료</div>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${pct}%` }} />
        </div>
      </div>

      <Segmented options={BUCKET_CATEGORIES} active={category} onChange={setCategory} />

      <div className={styles.form}>
      <div className={styles.addRow}>
        <input aria-label="이름" placeholder={placeholder} value={text} onChange={(e) => setText(e.target.value)} />
        <button className={styles.addBtn} onClick={handleAdd}>추가</button>
      </div>
      <input
        className={styles.extraInput}
        aria-label="설명"
        placeholder="간단한 설명 (선택)"
        maxLength={BUCKET_NOTE_MAX}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {category === 'food' && (
        <input
          className={styles.extraInput}
          aria-label="지도 링크"
          placeholder="카카오맵 · 네이버지도 링크 (선택)"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          value={link}
          onChange={(e) => setLink(e.target.value)}
        />
      )}
      </div>

      {(loadError || error) && <div className={styles.error}>{loadError || error}</div>}

      {filtered.length === 0 && (
        <div className={styles.empty}>{finished.length > 0 ? '남은 항목이 없어요. 다 해냈어요 🎉' : '아직 등록된 항목이 없어요 ✨'}</div>
      )}
      {filtered.map((item) => {
        if (item.id === editingId) {
          return (
            <EditCard
              key={item.id}
              item={item}
              onCancel={() => setEditingId(null)}
              onSave={async (changes) => {
                await edit(item.id, changes)
                setEditingId(null)
              }}
            />
          )
        }
        const mapLabel = item.link ? mapLinkLabel(item.link) : null
        return (
          <div key={item.id} className={`${styles.item} ${stampingId === item.id ? styles.stamping : ''}`}>
            {stampingId === item.id && <span className={styles.stampIn} aria-hidden="true">완료</span>}
            <div className={styles.top}>
              <div className={styles.body}>
                <div className={styles.text}>{item.text}</div>
                {item.note && <div className={styles.note}>{item.note}</div>}
              </div>
              <button className={styles.del} onClick={() => setConfirmId(item.id)} aria-label="삭제">✕</button>
            </div>
            <div className={styles.bottom}>
              <div className={styles.cat}>{categoryLabel(item.category)}</div>
              {mapLabel && (
                <a className={styles.mapLink} href={item.link ?? undefined} target="_blank" rel="noopener noreferrer">{mapLabel}</a>
              )}
              <button className={styles.editBtn} onClick={() => setEditingId(item.id)} aria-label={`${item.text} 수정`}>
                ✏️ 수정
              </button>
              <button className={styles.doneBtn} onClick={() => handleDone(item)} aria-label="완료 표시">완료</button>
            </div>
            {confirmId === item.id && <ConfirmDelete onConfirm={() => handleRemove(item.id)} onCancel={() => setConfirmId(null)} />}
          </div>
        )
      })}

      {finished.length > 0 && (
        <div className={styles.finished}>
          <button className={styles.finishedToggle} aria-expanded={showFinished} onClick={() => setShowFinished((v) => !v)}>
            완료한 {categoryLabel(category)} {finished.length}개 {showFinished ? '접기 ▴' : '보기 ▾'}
          </button>
          {showFinished && finished.map((item) => (
            <div key={item.id} className={styles.doneCard}>
              <div className={styles.doneTop}>
                <div className={styles.doneName}>{item.text}</div>
                <span className={styles.stamp} aria-hidden="true">완료</span>
              </div>
              {item.note && <div className={styles.doneNote}>{item.note}</div>}
              <div className={styles.doneActions}>
                <button className={styles.undoBtn} onClick={() => handleUndo(item)}>되돌리기</button>
                <button className={styles.doneDel} onClick={() => setConfirmId(item.id)} aria-label="삭제">✕</button>
              </div>
              {confirmId === item.id && <ConfirmDelete onConfirm={() => handleRemove(item.id)} onCancel={() => setConfirmId(null)} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
