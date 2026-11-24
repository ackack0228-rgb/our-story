import styles from './Segmented.module.css'

interface Props<K extends string> {
  options: { key: K; label: string }[]
  active: K
  onChange: (key: K) => void
}

// Picks a kind inside one view (버킷리스트·후기의 여행지 | 맛집 | 영화). Switching whole views uses SubTabs' pills instead.
export function Segmented<K extends string>({ options, active, onChange }: Props<K>) {
  return (
    <div className={styles.row}>
      {options.map((o) => (
        <button key={o.key} aria-pressed={active === o.key} className={active === o.key ? styles.active : ''} onClick={() => onChange(o.key)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
