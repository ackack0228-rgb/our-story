import { useCollection } from './useCollection'
import { useSession } from './useSession'
import { createItem, deleteItem } from '../lib/api'
import { latestPokeFrom, type Poke } from '../lib/pokes'

export function usePokes(): { received: Poke | null; send: () => Promise<void> } {
  const { me } = useSession()
  const { items, refresh } = useCollection<Poke>('pokes')
  const other = me === 'A' ? 'B' : 'A'

  return {
    // Deliberately re-evaluated every render: the 3 s polling re-renders keep the 24 h window fresh.
    // eslint-disable-next-line react-hooks/purity
    received: latestPokeFrom(items, other, Date.now()),
    send: async () => {
      const older = items.filter((p) => p.sender === me)
      await createItem('pokes', { sender: me })
      await refresh()
      // Keeps the table tiny; a failure here must never surface.
      await Promise.all(older.map((p) => deleteItem('pokes', p.id).catch(() => {})))
    },
  }
}
