import { useEffect, useState } from 'react'
import { useSession } from '../hooks/useSession'
import { enablePush, getPushState, type PushState } from '../lib/push'
import { getCalendarFeed, type CalendarFeed } from '../lib/calendarFeed'
import styles from './SettingsModal.module.css'

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { me, settings, updateSettings, switchUser } = useSession()
  const [nameA, setNameA] = useState(settings.nameA)
  const [nameB, setNameB] = useState(settings.nameB)
  const [startDate, setStartDate] = useState(settings.startDate ?? '')
  const [error, setError] = useState<string | null>(null)
  const [push, setPush] = useState<PushState | null>(null)
  const [pushError, setPushError] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    getPushState().then((state) => { if (alive) setPush(state) }).catch(() => { if (alive) setPush('unsupported') })
    return () => { alive = false }
  }, [])

  // The iPhone calendar section only appears once the address is known; without it there is
  // nothing to connect, so a failed read just leaves the section out.
  const [feed, setFeed] = useState<CalendarFeed | null>(null)
  const [copyNote, setCopyNote] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    getCalendarFeed().then((next) => { if (alive) setFeed(next) }).catch(() => {})
    return () => { alive = false }
  }, [])

  async function handleCopyFeed() {
    if (!feed) return
    try {
      await navigator.clipboard.writeText(feed.https)
      setCopyNote('주소를 복사했어요 ✓')
    } catch {
      setCopyNote('복사하지 못했어요. 다시 시도해주세요.')
    }
  }

  async function handleEnablePush() {
    setPushError(null)
    try {
      setPush(await enablePush(me))
    } catch {
      setPushError('알림을 켜지 못했어요. 다시 시도해주세요.')
    }
  }

  async function handleSave() {
    setError(null)
    try {
      await updateSettings({
        nameA: nameA.trim() || '나',
        nameB: nameB.trim() || '상대방',
        startDate: startDate || null,
      })
      onClose()
    } catch {
      setError('저장하지 못했어요. 다시 시도해주세요.')
    }
  }

  function handleSwitchUser() {
    switchUser()
    onClose()
  }

  return (
    <div className={styles.modalBg}>
      <div className={styles.modal}>
        <h3>설정</h3>
        <div className={styles.fieldLabel}>우리가 만난 날</div>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <div className={styles.fieldLabel}>첫번째 사람 이름</div>
        <input value={nameA} maxLength={20} onChange={(e) => setNameA(e.target.value)} />
        <div className={styles.fieldLabel}>두번째 사람 이름</div>
        <input value={nameB} maxLength={20} onChange={(e) => setNameB(e.target.value)} />

        <div className={styles.fieldLabel}>알림</div>
        {push === 'off' && <button className={styles.pushBtn} onClick={handleEnablePush}>알림 켜기</button>}
        {push === 'on' && <div className={styles.pushNote}>알림이 켜져 있어요 ✓</div>}
        {push === 'needs-install' && <div className={styles.pushNote}>홈 화면에 추가한 뒤 켤 수 있어요</div>}
        {push === 'denied' && <div className={styles.pushNote}>알림이 꺼져 있어요. 아이폰 설정에서 켤 수 있어요.</div>}
        {push === 'unsupported' && <div className={styles.pushNote}>이 기기에서는 알림을 쓸 수 없어요</div>}
        {pushError && <div className={styles.error}>{pushError}</div>}

        {feed && (
          <>
            <div className={styles.fieldLabel}>아이폰 캘린더 · 위젯</div>
            <a className={styles.linkBtn} href={feed.webcal}>아이폰 캘린더에 연결</a>
            <button className={styles.copyBtn} onClick={handleCopyFeed}>주소 복사</button>
            {copyNote && <div className={styles.pushNote}>{copyNote}</div>}
            <div className={styles.hint}>
              연결하면 아이폰 캘린더와 위젯에 우리 일정이 보여요. 새 일정은 조금 늦게 떠요. 이 주소는 다른 사람에게 보내지 마세요.
            </div>
          </>
        )}

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.actions}>
          <button className={styles.ghost} onClick={onClose}>닫기</button>
          <button className={styles.primary} onClick={handleSave}>저장하기</button>
        </div>

        <button className={styles.unlink} onClick={handleSwitchUser}>사용자 바꾸기</button>
      </div>
    </div>
  )
}
