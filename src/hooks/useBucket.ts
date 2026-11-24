import { useCollection } from './useCollection'
import { useSession } from './useSession'
import { createItem, deleteItem, patchItem } from '../lib/api'
import type { BucketCategory, BucketItem } from '../lib/bucket'

export interface BucketEdit {
  text: string
  category: BucketCategory
  note: string | null
  link: string | null
}

export function useBucket() {
  const { me } = useSession()
  const { items, loading, error, refresh } = useCollection<BucketItem>('bucket')

  return {
    items,
    loading,
    error,
    add: async (text: string, category: BucketCategory, extra: { note?: string; link?: string } = {}) => {
      await createItem('bucket', { text, category, done: false, createdBy: me, ...extra })
      await refresh()
    },
    /** Rewrites an item's name, kind, note and link. `null` clears the note or link. */
    edit: async (id: string, changes: BucketEdit) => {
      await patchItem('bucket', id, changes)
      await refresh()
    },
    toggle: async (id: string, done: boolean) => {
      await patchItem('bucket', id, { done })
      await refresh()
    },
    remove: async (id: string) => {
      await deleteItem('bucket', id)
      await refresh()
    },
  }
}
