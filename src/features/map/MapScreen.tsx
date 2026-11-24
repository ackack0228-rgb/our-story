import { useState } from 'react'
import { SubTabs } from '../../components/SubTabs'
import { RecordList } from '../record/RecordList'
import { MapView } from './MapView'

type View = 'map' | 'record'

const VIEWS: { key: View; label: string }[] = [
  { key: 'map', label: '지도' },
  { key: 'record', label: '기록' },
]

// The same places two ways: pins on the map, or a list by date.
export function MapScreen() {
  const [view, setView] = useState<View>('map')

  return (
    <div>
      <SubTabs tabs={VIEWS} active={view} onChange={setView} />
      {view === 'map' ? <MapView /> : <RecordList />}
    </div>
  )
}
