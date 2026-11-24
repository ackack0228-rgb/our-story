import { useCollection } from './useCollection'
import { useSession } from './useSession'
import { createItem, discardUpload, uploadImage } from '../lib/api'
import { blobToDataUrl } from '../lib/imageResize'
import { mergeFeed, type Doodle, type Note } from '../features/doodle/feedMerge'

export function useDoodleFeed() {
  const { me } = useSession()
  const doodles = useCollection<Doodle>('doodles')
  const notes = useCollection<Note>('notes')

  return {
    items: mergeFeed(doodles.items, notes.items),
    loading: doodles.loading || notes.loading,
    error: doodles.error ?? notes.error,
    sendDoodle: async (blob: Blob) => {
      const imageUrl = await uploadImage(await blobToDataUrl(blob))
      try {
        await createItem('doodles', { imageUrl, sender: me })
      } catch (err) {
        await discardUpload(imageUrl)
        throw err
      }
      await doodles.refresh()
    },
    sendNote: async (text: string) => {
      await createItem('notes', { text, sender: me })
      await notes.refresh()
    },
  }
}
