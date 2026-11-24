import { useCollection } from './useCollection'
import { useSession } from './useSession'
import { putItem } from '../lib/api'
import { todayLocalISODate } from '../lib/date'
import type { MoodLog } from '../lib/moodLogs'

export function useMoodLogs() {
  const { me } = useSession()
  const { items: logs, loading, error, refresh } = useCollection<MoodLog>('moods')

  return {
    logs,
    loading,
    error,
    // One entry per person per local day — the id makes "today's mood" an idempotent upsert.
    saveToday: async (value: number) => {
      const date = todayLocalISODate()
      await putItem('moods', `${date}_${me}`, { date, who: me, value })
      await refresh()
    },
  }
}
