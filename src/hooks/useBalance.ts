import { useCollection } from './useCollection'
import { useSession } from './useSession'
import { putItem } from '../lib/api'
import { todayLocalISODate } from '../lib/date'
import { choicesOn, isBalancePick, type Side } from '../lib/balance'

export function useBalance() {
  const { me } = useSession()
  const { items, loading, error, refresh } = useCollection<unknown>('balance')
  const picks = items.filter(isBalancePick)

  return {
    items: picks,
    loading,
    error,
    // One pick per person per local day — the id makes a double tap land on the same row. Always
    // files under today: a screen left open past midnight must not pick for yesterday.
    pick: async (side: Side) => {
      const date = todayLocalISODate()
      await putItem('balance', `${date}_${me}`, { date, who: me, pick: side, ...choicesOn(picks, date) })
      await refresh()
    },
  }
}
