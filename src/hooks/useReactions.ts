import { useCollection } from './useCollection'
import { useSession } from './useSession'
import { deleteItem, putItem } from '../lib/api'
import { isReaction, reactionId, type ReactionKey } from '../lib/reactions'

export function useReactions() {
  const { me } = useSession()
  const { items, loading, error, refresh } = useCollection<unknown>('reactions')
  const reactions = items.filter(isReaction)

  return {
    items: reactions,
    loading,
    error,
    // Pressing a reaction I already gave takes it back.
    toggle: async (event: { id: string; title: string }, key: ReactionKey) => {
      const id = reactionId(event.id, me, key)
      if (reactions.some((r) => r.id === id)) await deleteItem('reactions', id)
      else await putItem('reactions', id, { eventId: event.id, emoji: key, sender: me, eventTitle: event.title })
      await refresh()
    },
    // For a deleted event. Leftover reactions are invisible, so a failure here must never surface.
    clearFor: async (eventId: string) => {
      await Promise.all(reactions.filter((r) => r.eventId === eventId).map((r) => deleteItem('reactions', r.id).catch(() => {})))
    },
  }
}
