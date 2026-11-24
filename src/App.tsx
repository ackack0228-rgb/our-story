import { useState } from 'react'
import { SessionProvider } from './hooks/useSession'
import { TopBar } from './components/TopBar'
import { BottomNav, type TabKey } from './components/BottomNav'
import { SettingsModal } from './components/SettingsModal'
import { Home } from './features/home/Home'
import { MapScreen } from './features/map/MapScreen'
import { DoodleBoard } from './features/doodle/DoodleBoard'
import { Calendar } from './features/more/Calendar'
import { More } from './features/more/More'
import type { YearMonth } from './lib/recap'

function Shell() {
  const [tab, setTab] = useState<TabKey>('home')
  const [settingsOpen, setSettingsOpen] = useState(false)
  // The month to open 더보기's 돌아보기 on, when the home screen sent us there.
  const [recapMonth, setRecapMonth] = useState<YearMonth | null>(null)

  function changeTab(next: TabKey) {
    setRecapMonth(null)
    setTab(next)
  }

  function openRecap(month: YearMonth) {
    setRecapMonth(month)
    setTab('more')
  }

  return (
    <div className="app">
      <TopBar onSettings={() => setSettingsOpen(true)} />
      <main className="screen" data-testid={`screen-${tab}`}>
        {tab === 'home' && <Home onOpenRecap={openRecap} />}
        {tab === 'map' && <MapScreen />}
        {tab === 'doodle' && <DoodleBoard />}
        {tab === 'calendar' && <Calendar />}
        {tab === 'more' && <More recapMonth={recapMonth} />}
      </main>
      <BottomNav active={tab} onChange={changeTab} />
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}

export default function App() {
  return (
    <SessionProvider>
      <Shell />
    </SessionProvider>
  )
}
