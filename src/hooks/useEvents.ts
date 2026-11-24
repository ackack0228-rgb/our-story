import { useCollection } from './useCollection'
import { useSession } from './useSession'
import { createItem, deleteItem, patchItem } from '../lib/api'
import { isCalendarEvent, type EventInput } from '../lib/events'

export function useEvents() {
  const { me } = useSession()
  const { items, loading, error, refresh } = useCollection<unknown>('events')

  return {
    items: items.filter(isCalendarEvent),
    loading,
    error,
    add: async (input: EventInput) => {
      await createItem('events', { ...input, createdBy: me })
      await refresh()
    },
    update: async (id: string, input: EventInput) => {
      await patchItem('events', id, input)
      await refresh()
    },
    remove: async (id: string) => {
      await deleteItem('events', id)
      await refresh()
    },
  }
}
