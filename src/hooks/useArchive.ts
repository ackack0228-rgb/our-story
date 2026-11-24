import { useCollection } from './useCollection'
import { useSession } from './useSession'
import { createItem, deleteItem } from '../lib/api'
import { todayLocalISODate } from '../lib/date'
import type { ArchiveItem, ArchiveType } from '../lib/archive'

export function useArchive() {
  const { me } = useSession()
  const { items, loading, error, refresh } = useCollection<ArchiveItem>('archive')

  return {
    items,
    loading,
    error,
    add: async (type: ArchiveType, name: string, rating: number, note: string) => {
      await createItem('archive', { type, name, rating, note, date: todayLocalISODate(), createdBy: me })
      await refresh()
    },
    remove: async (id: string) => {
      await deleteItem('archive', id)
      await refresh()
    },
  }
}
