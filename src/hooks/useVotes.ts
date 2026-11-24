import { useCollection } from './useCollection'
import { useSession } from './useSession'
import { createItem, deleteItem, patchItem } from '../lib/api'
import type { Vote } from '../lib/votes'

export function useVotes() {
  const { me } = useSession()
  const { items, loading, error, refresh } = useCollection<Vote>('votes')
  const sorted = [...items].sort((a, b) => b.likedBy.length - a.likedBy.length)

  return {
    items: sorted,
    loading,
    error,
    add: async (name: string, note: string) => {
      await createItem('votes', { name, note, likedBy: [], createdBy: me })
      await refresh()
    },
    toggleLike: async (id: string) => {
      const current = items.find((v) => v.id === id)
      if (!current) return
      const likedBy = current.likedBy.includes(me)
        ? current.likedBy.filter((w) => w !== me)
        : [...current.likedBy, me]
      await patchItem('votes', id, { likedBy })
      await refresh()
    },
    remove: async (id: string) => {
      await deleteItem('votes', id)
      await refresh()
    },
  }
}
