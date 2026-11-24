import { useState } from 'react'
import { usePlaces } from '../../hooks/usePlaces'
import { resizeImageFileToBlob, blobToDataUrl } from '../../lib/imageResize'
import { MOOD_OPTIONS } from '../../lib/moods'
import { todayLocalISODate } from '../../lib/date'
import type { Place } from '../../lib/places'
import { findRegion, regionGroups, regionLabel } from '../../lib/regions'
import styles from './PlaceFormModal.module.css'

const GROUPS = regionGroups()

export function PlaceFormModal({
  existing,
  region: initialRegion,
  onClose,
}: {
  existing: Place | null
  /** The area a new place starts in (the one pressed on the map). */
  region: string | null
  onClose: () => void
}) {
  const { add, update, remove } = usePlaces()
  const [name, setName] = useState(existing?.name ?? '')
  const [date, setDate] = useState(existing?.date ?? todayLocalISODate())
  const [mood, setMood] = useState(existing?.mood ?? MOOD_OPTIONS[0])
  const [diary, setDiary] = useState(existing?.diary ?? '')
  // An id the map does not know (or none, on an old place) shows as "not chosen yet".
  const [region, setRegion] = useState(findRegion(existing?.region ?? initialRegion)?.id ?? '')
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(existing?.photoUrl ?? null)
  // Only true once the user actually picks a new photo this session — lets handleSave leave the
  // existing document's photoUrl untouched otherwise, instead of resending/re-clobbering it with
  // whatever this modal happened to be seeded with on mount (see handleSave below).
  const [photoChanged, setPhotoChanged] = useState(false)
  const [processingPhoto, setProcessingPhoto] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // 삭제 takes two presses: the first only asks, so a slip of the finger does not lose a photo and a diary.
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Reset now (not just on success) so re-picking the exact same file after a failed resize
    // still fires a change event.
    e.target.value = ''
    if (!file) return
    setError(null)
    setProcessingPhoto(true)
    try {
      const blob = await resizeImageFileToBlob(file)
      setPendingPhoto(await blobToDataUrl(blob))
      setPhotoChanged(true)
    } catch {
      setError('사진을 처리하지 못했어요. 다른 사진을 시도해주세요.')
    } finally {
      setProcessingPhoto(false)
    }
  }

  async function handleSave() {
    if (!region) {
      setError('지역을 골라 주세요.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (!existing) {
        await add({
          name: name.trim() || '이름 없는 장소',
          date,
          mood,
          diary: diary.trim(),
          region,
          photoUrl: pendingPhoto,
        })
      } else {
        await update(existing.id, {
          name: name.trim() || '이름 없는 장소',
          date,
          mood,
          diary: diary.trim(),
          region,
          ...(photoChanged ? { photoUrl: pendingPhoto } : {}),
        })
      }
      onClose()
    } catch {
      setError('저장하지 못했어요. 다시 시도해주세요.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!existing) return
    setDeleting(true)
    setError(null)
    try {
      await remove(existing.id)
      onClose()
    } catch {
      setError('삭제하지 못했어요. 다시 시도해주세요.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className={styles.modalBg}>
      <div className={styles.modal}>
        <button className={styles.closeX} onClick={onClose} aria-label="닫기">✕</button>
        <h3>{existing ? '장소 기록 수정' : '새로운 장소 기록'}</h3>

        <div className={styles.fieldLabel}>장소 이름</div>
        <input placeholder="장소 이름 (예: 강릉 안목해변)" value={name} onChange={(e) => setName(e.target.value)} />

        <div className={styles.fieldLabel}>지역</div>
        <select aria-label="지역" value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="">지역 고르기</option>
          {GROUPS.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.regions.map((r) => <option key={r.id} value={r.id}>{regionLabel(r)}</option>)}
            </optgroup>
          ))}
        </select>

        <div className={styles.fieldLabel}>날짜</div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />

        <div className={styles.fieldLabel}>그날의 기분</div>
        <div className={styles.moodRow}>
          {MOOD_OPTIONS.map((m) => (
            <button
              key={m}
              type="button"
              className={`${styles.moodOpt} ${mood === m ? styles.selected : ''}`}
              onClick={() => setMood(m)}
            >
              {m}
            </button>
          ))}
        </div>

        <div className={styles.fieldLabel}>사진</div>
        <label className={styles.photoDrop}>
          {pendingPhoto ? <img src={pendingPhoto} alt="" /> : '눌러서 사진 추가하기 📷'}
          <input type="file" accept="image/*" onChange={handlePhotoChange} hidden />
        </label>
        {pendingPhoto && (
          <button
            type="button"
            className={styles.photoRemove}
            onClick={() => { setPendingPhoto(null); setPhotoChanged(true) }}
          >
            사진 빼기
          </button>
        )}

        <div className={styles.fieldLabel}>일기</div>
        <textarea value={diary} onChange={(e) => setDiary(e.target.value)} />

        {error && <div className={styles.error}>{error}</div>}

        {confirmingDelete ? (
          <div className={styles.confirm}>
            <div className={styles.confirmText}>이 기록을 정말 삭제할까요? 사진과 일기도 같이 지워져요.</div>
            <div className={styles.actions}>
              <button className={styles.cancel} onClick={() => setConfirmingDelete(false)} disabled={deleting}>취소</button>
              <button className={styles.danger} onClick={handleDelete} disabled={deleting}>삭제</button>
            </div>
          </div>
        ) : (
          <div className={styles.actions}>
            {existing && (
              <button className={styles.danger} onClick={() => setConfirmingDelete(true)}>삭제</button>
            )}
            <button className={styles.cancel} onClick={onClose}>닫기</button>
            <button className={styles.primary} onClick={handleSave} disabled={saving || processingPhoto}>저장하기</button>
          </div>
        )}
      </div>
    </div>
  )
}
