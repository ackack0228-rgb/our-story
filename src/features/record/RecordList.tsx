import { useEffect, useState } from 'react'
import { usePlaces } from '../../hooks/usePlaces'
import { useReactions } from '../../hooks/useReactions'
import { useComments } from '../../hooks/useComments'
import { PlaceSocial } from './PlaceSocial'
import { PlaceFormModal } from '../map/PlaceFormModal'
import styles from './RecordList.module.css'

/** 'YYYY-MM-DD' → the two lines of a postmark: year, then month.day. Anything else is shown as it is. */
function postmark(date: string): [string, string] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  return m ? [m[1], `${Number(m[2])}.${Number(m[3])}`] : ['', date]
}

export function RecordList() {
  const { places, error } = usePlaces()
  const reactions = useReactions()
  const comments = useComments()
  const [editingId, setEditingId] = useState<string | null>(null)
  const sorted = [...places].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  const editing = editingId ? places.find((p) => p.id === editingId) ?? null : null

  // Deleted from the partner's device mid-edit: close, or saving would bring it back as a new place.
  useEffect(() => {
    if (editingId && !editing) setEditingId(null)
  }, [editingId, editing])

  if (error) {
    return <div className={styles.error}>{error}</div>
  }

  if (sorted.length === 0) {
    return <div className={styles.empty}>아직 기록된 장소가 없어요. 지도에서 첫 장소를 남겨보세요 📍</div>
  }

  return (
    <div>
      {sorted.map((p) => (
        <div key={p.id} className={styles.card}>
          <button className={styles.main} onClick={() => setEditingId(p.id)}>
            {/* Each record is a postcard: the photo is the stamp, the date its postmark. */}
            <span className={styles.stampWrap}>
              <span className={styles.stamp}>
                {p.photoUrl ? <img src={p.photoUrl} alt="" /> : <span className={styles.phFallback}>{p.mood || '📍'}</span>}
              </span>
              <span className={styles.postmark} aria-label={p.date}>
                <span aria-hidden="true">{postmark(p.date)[0]}</span>
                <b aria-hidden="true">{postmark(p.date)[1]}</b>
              </span>
            </span>
            <span className={styles.body}>
              <span data-testid="record-name" className={styles.title}>{p.name}</span>
              <span className={styles.diary}>{p.diary}</span>
            </span>
            <span className={styles.edit}>✏️ 수정</span>
          </button>
          <PlaceSocial
            place={p}
            reactions={reactions.items}
            comments={comments.items}
            onReact={(place, key) => reactions.toggle({ id: place.id, title: place.name }, key)}
            onComment={comments.add}
            onDeleteComment={comments.remove}
          />
        </div>
      ))}
      {editing && <PlaceFormModal existing={editing} region={null} onClose={() => setEditingId(null)} />}
    </div>
  )
}
