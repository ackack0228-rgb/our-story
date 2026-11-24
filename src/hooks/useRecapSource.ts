import { useCollection } from './useCollection'
import type { RecapSource } from '../lib/recap'

// Everything the monthly recap counts. Each collection is the shared store other screens already
// poll, so opening the recap next to them costs no extra requests.
export function useRecapSource(): { source: RecapSource; loading: boolean; error: string | null } {
  const places = useCollection<unknown>('places')
  const doodles = useCollection<unknown>('doodles')
  const notes = useCollection<unknown>('notes')
  const moods = useCollection<unknown>('moods')
  const events = useCollection<unknown>('events')
  const archive = useCollection<unknown>('archive')
  const answers = useCollection<unknown>('answers')
  const balance = useCollection<unknown>('balance')
  const all = [places, doodles, notes, moods, events, archive, answers, balance]

  return {
    source: {
      places: places.items,
      doodles: doodles.items,
      notes: notes.items,
      moods: moods.items,
      events: events.items,
      archive: archive.items,
      answers: answers.items,
      balance: balance.items,
    },
    loading: all.some((c) => c.loading),
    error: all.find((c) => c.error)?.error ?? null,
  }
}
