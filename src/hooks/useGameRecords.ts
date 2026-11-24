import { useCollection } from './useCollection'
import { useSession } from './useSession'
import { putItem } from '../lib/api'
import { bestOf, isGameRecord } from '../lib/stampGame'

export function useGameRecords() {
  const { me } = useSession()
  const { items, loading, error, refresh } = useCollection<unknown>('games')
  const records = items.filter(isGameRecord)

  return {
    records,
    loading,
    error,
    /** Saves the score only when it beats my record. Resolves true when it did. */
    submit: async (score: number): Promise<boolean> => {
      if (score <= bestOf(records, me)) return false
      await putItem('games', `stack_${me}`, { game: 'stack', who: me, best: score })
      await refresh()
      return true
    },
  }
}
