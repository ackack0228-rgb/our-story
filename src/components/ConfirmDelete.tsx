import styles from './ConfirmDelete.module.css'

interface Props {
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
}

// Shown in place of a one-tap ✕: the item is only removed after a second, clearly labelled press.
// Colors follow the card it sits in (currentColor), so it works on dark and paper cards alike.
export function ConfirmDelete({ onConfirm, onCancel, busy = false }: Props) {
  return (
    <div className={styles.confirm} role="group" aria-label="삭제 확인">
      <span className={styles.ask}>정말 삭제할까요?</span>
      <button className={styles.cancel} onClick={onCancel} disabled={busy}>취소</button>
      <button className={styles.yes} onClick={onConfirm} disabled={busy}>삭제</button>
    </div>
  )
}
