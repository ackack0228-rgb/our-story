import { useEffect, useRef } from 'react'
import styles from './SubTabs.module.css'

interface Props<K extends string> {
  tabs: { key: K; label: string }[]
  active: K
  onChange: (key: K) => void
  /** 'grid': three to a row, every tab in sight (더보기 has six). Default: one row that scrolls sideways. */
  layout?: 'row' | 'grid'
}

// The row of pill buttons that switches views inside one screen (지도 | 기록, 더보기's lists).
export function SubTabs<K extends string>({ tabs, active, onChange, layout = 'row' }: Props<K>) {
  const row = useRef<HTMLDivElement>(null)

  // The row scrolls sideways when it is wider than the phone: keep the active pill in sight, also
  // when the screen opens on a tab near the end.
  useEffect(() => {
    row.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [active])

  return (
    <div ref={row} className={`${styles.subtabs} ${layout === 'grid' ? styles.grid : ''}`}>
      {tabs.map((t) => (
        <button key={t.key} aria-pressed={active === t.key} className={active === t.key ? styles.active : ''} onClick={() => onChange(t.key)}>
          {t.label}
        </button>
      ))}
    </div>
  )
}
