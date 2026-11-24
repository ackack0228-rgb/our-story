import { useEffect, useRef, useState } from 'react'
import { usePlaces } from '../../hooks/usePlaces'
import { findRegion, KOREA_MAP, placesIn, placesWithoutRegion, regionGroups, regionLabel, REGIONS, visitCounts, visitShade } from '../../lib/regions'
import type { Place } from '../../lib/places'
import { PlaceFormModal } from './PlaceFormModal'
import { MAP_ATTRIBUTION } from './mapAttribution'
import styles from './MapView.module.css'

const GROUPS = regionGroups()

export function MapView() {
  const { places, error } = usePlaces()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // The names of the smallest areas (구리, 과천 …) are only readable enlarged.
  const [zoomed, setZoomed] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [modalState, setModalState] = useState<
    | null
    | { mode: 'new'; region: string }
    | { mode: 'edit'; id: string }
  >(null)

  const counts = visitCounts(places)
  // The more we went somewhere, the deeper its colour.
  const shadeOf = (id: string) => {
    const n = counts.get(id)
    return n ? styles[visitShade(n)] : ''
  }
  const selected = findRegion(selectedId)
  const here = selected ? placesIn(places, selected.id) : []
  const unplaced = placesWithoutRegion(places)

  const existing = modalState?.mode === 'edit' ? places.find((p) => p.id === modalState.id) ?? null : null

  // If the place being edited here gets deleted from the partner's device mid-edit, close the
  // modal instead of letting a subsequent save silently resurrect it as a brand-new place
  // (PlaceFormModal's handleSave treats a null `existing` as "create new").
  useEffect(() => {
    if (modalState?.mode === 'edit' && !existing) setModalState(null)
  }, [modalState, existing])

  // Enlarging opens on the middle of the map rather than its top-left corner (sea).
  useEffect(() => {
    const box = scrollRef.current
    if (!box || !zoomed) return
    box.scrollLeft = (box.scrollWidth - box.clientWidth) / 2
    box.scrollTop = (box.scrollHeight - box.clientHeight) / 3
  }, [zoomed])

  const placeRow = (p: Place) => (
    <button key={p.id} className={styles.place} onClick={() => setModalState({ mode: 'edit', id: p.id })}>
      <span className={styles.placeMood}>{p.mood || '📍'}</span>
      <span className={styles.placeName}>{p.name}</span>
      <span className={styles.placeDate}>{p.date}</span>
      <span className={styles.placeEdit}>✏️ 수정</span>
    </button>
  )

  return (
    <div>
      <div className={styles.top}>
        <div className={styles.count}>
          <b>{REGIONS.length}곳</b> 중 <b className={styles.countNum}>{counts.size}곳</b> 다녀왔어요
        </div>
        <button className={styles.zoomBtn} aria-pressed={zoomed} onClick={() => setZoomed((v) => !v)}>
          {zoomed ? '작게 보기' : '🔍 크게 보기'}
        </button>
      </div>

      <div ref={scrollRef} className={`${styles.mapWrap} ${zoomed ? styles.zoomed : ''}`}>
        <svg viewBox={`0 0 ${KOREA_MAP.width} ${KOREA_MAP.height}`} role="img" aria-label="대한민국 지도" className={styles.map}>
          {KOREA_MAP.insets.map((box) => (
            <g key={box.label}>
              <rect x={box.x} y={box.y} width={box.width} height={box.height} rx={10} className={styles.inset} />
              <text x={box.x + box.width / 2} y={box.y - 12} textAnchor="middle" className={styles.insetLabel}>{box.label}</text>
            </g>
          ))}
          {REGIONS.map((r) => (
            <path
              key={r.id}
              d={r.d}
              data-region={r.id}
              className={`${styles.region} ${shadeOf(r.id)}`}
              data-visits={counts.get(r.id) ?? 0}
              onClick={() => setSelectedId(r.id)}
            >
              <title>{regionLabel(r)}</title>
            </path>
          ))}
          {/* Drawn again on top so the outline of the chosen area is never hidden by its neighbours. */}
          {selected && <path d={selected.d} className={styles.selectedOutline} />}
          {REGIONS.map((r) => (
            <text key={r.id} x={r.label.x} y={r.label.y} fontSize={r.label.size} data-label={r.id} className={`${styles.name} ${shadeOf(r.id)}`}>
              {r.label.text}
            </text>
          ))}
        </svg>
      </div>
      <div className={styles.shadeKey} aria-hidden="true">
        <span><i className={styles.once} />1번</span>
        <span><i className={styles.few} />2~3번</span>
        <span><i className={styles.many} />4번 이상</span>
      </div>
      <div className={styles.caption}>{MAP_ATTRIBUTION}</div>
      {error && <div className={styles.error}>{error}</div>}

      {/* Small areas (구리, 과천, 목포 …) are hard to hit with a finger: the list reaches every one. */}
      <select
        className={styles.picker}
        aria-label="지역 고르기"
        value={selected?.id ?? ''}
        onChange={(e) => setSelectedId(e.target.value || null)}
      >
        <option value="">지도를 누르거나 여기서 지역 고르기</option>
        {GROUPS.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.regions.map((r) => <option key={r.id} value={r.id}>{regionLabel(r)}</option>)}
          </optgroup>
        ))}
      </select>

      {selected && (
        <div className={styles.panel}>
          <div className={styles.panelTitle}>{regionLabel(selected)}</div>
          {here.length === 0 && <div className={styles.panelEmpty}>아직 여기 남긴 기록이 없어요</div>}
          {here.map(placeRow)}
          <button className={styles.addBtn} onClick={() => setModalState({ mode: 'new', region: selected.id })}>
            + 여기에 장소 추가
          </button>
        </div>
      )}

      {unplaced.length > 0 && (
        <div className={styles.panel}>
          <div className={styles.panelTitle}>지역을 아직 안 정한 기록</div>
          <div className={styles.panelEmpty}>눌러서 지역을 골라 주면 지도에 색이 칠해져요</div>
          {unplaced.map(placeRow)}
        </div>
      )}

      {modalState && (
        <PlaceFormModal
          existing={existing}
          region={modalState.mode === 'new' ? modalState.region : null}
          onClose={() => setModalState(null)}
        />
      )}
    </div>
  )
}
