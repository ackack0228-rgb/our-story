import { useCollection } from './useCollection'
import { useSession } from './useSession'
import { createItem, deleteItem } from '../lib/api'
import { COMMENT_MAX, isComment } from '../lib/comments'

export function useComments() {
  const { me } = useSession()
  const { items, loading, error, refresh } = useCollection<unknown>('comments')
  const comments = items.filter(isComment)

  return {
    items: comments,
    loading,
    error,
    add: async (place: { id: string; name: string }, text: string) => {
      const trimmed = text.trim().slice(0, COMMENT_MAX)
      if (!trimmed) return
      await createItem('comments', { placeId: place.id, placeName: place.name, text: trimmed, sender: me })
      await refresh()
    },
    remove: async (id: string) => {
      await deleteItem('comments', id)
      await refresh()
    },
  }
}
