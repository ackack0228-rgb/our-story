import styles from './BottomNav.module.css'

export type TabKey = 'home' | 'map' | 'doodle' | 'calendar' | 'more'

const TABS: { key: TabKey; icon: string; label: string }[] = [
  { key: 'home', icon: '🏠', label: '홈' },
  { key: 'map', icon: '🗺', label: '지도' },
  { key: 'doodle', icon: '🖍', label: '낙서' },
  { key: 'calendar', icon: '📅', label: '달력' },
  { key: 'more', icon: '🗂', label: '더보기' },
]

export function BottomNav({ active, onChange }: { active: TabKey; onChange: (t: TabKey) => void }) {
  return (
    <nav className={styles.bottomnav}>
      {TABS.map((t) => (
        <button
          key={t.key}
          className={`${styles.navbtn} ${active === t.key ? styles.active : ''}`}
          onClick={() => onChange(t.key)}
          aria-current={active === t.key}
        >
          <span className={styles.icon}>{t.icon}</span>
          {t.label}
        </button>
      ))}
    </nav>
  )
}
