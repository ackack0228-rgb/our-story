import { useCollection } from './useCollection'
import { useSession } from './useSession'
import { createItem, deleteItem, discardUpload, listItems, patchItem, uploadIfDataUrl } from '../lib/api'
import type { Place, NewPlaceInput } from '../lib/places'

// Reactions and comments left on a deleted place. They are invisible without the place, so a
// failure here must never surface.
async function clearLinked(placeId: string) {
  try {
    const [reactions, comments] = await Promise.all([listItems<{ id: string; eventId?: string }>('reactions'), listItems<{ id: string; placeId?: string }>('comments')])
    await Promise.all([
      ...reactions.filter((r) => r.eventId === placeId).map((r) => deleteItem('reactions', r.id).catch(() => {})),
      ...comments.filter((c) => c.placeId === placeId).map((c) => deleteItem('comments', c.id).catch(() => {})),
    ])
  } catch { /* see above */ }
}

export function usePlaces() {
  const { me } = useSession()
  const { items: places, loading, error, refresh } = useCollection<Place>('places')

  return {
    places,
    loading,
    error,
    add: async (input: Omit<NewPlaceInput, 'createdBy'>) => {
      const isNewUpload = input.photoUrl?.startsWith('data:') ?? false
      const photoUrl = await uploadIfDataUrl(input.photoUrl)
      try {
        await createItem('places', { ...input, photoUrl, createdBy: me })
      } catch (err) {
        if (isNewUpload) await discardUpload(photoUrl)
        throw err
      }
      await refresh()
    },
    update: async (id: string, patch: Partial<NewPlaceInput>) => {
      const isNewUpload = patch.photoUrl?.startsWith('data:') ?? false
      const next = 'photoUrl' in patch ? { ...patch, photoUrl: await uploadIfDataUrl(patch.photoUrl ?? null) } : patch
      try {
        await patchItem('places', id, next)
      } catch (err) {
        if (isNewUpload) await discardUpload(next.photoUrl ?? null)
        throw err
      }
      await refresh()
    },
    remove: async (id: string) => {
      await deleteItem('places', id)
      void clearLinked(id)
      await refresh()
    },
  }
}
