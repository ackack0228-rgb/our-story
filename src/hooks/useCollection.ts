import { useCallback, useSyncExternalStore } from 'react'
import { listItems, type CollectionName } from '../lib/api'

/** Shown when a list can't be fetched. Polling keeps trying, so it clears by itself once the phone is back online. */
export const LOAD_ERROR = '인터넷 연결을 확인해 주세요. 연결되면 바로 다시 불러와요.'

export const POLL_INTERVAL_MS = 3000

interface State {
  items: unknown[]
  loading: boolean
  error: string | null
}

interface Store {
  state: State
  listeners: Set<() => void>
  // Only the most recently issued request may apply its result — a poll sent just before a write
  // can resolve after the post-write refresh and would otherwise undo it on screen.
  latestRequest: number
  timer: ReturnType<typeof setInterval>
}

const EMPTY: State = { items: [], loading: true, error: null }

// One store per collection, shared by every mounted useCollection(name). However many screens show
// a collection (Home counts places while its "N년 전 오늘" card lists them), it is fetched once per
// poll, and a write made through one screen's hook shows on all of them at once.
const stores = new Map<CollectionName, Store>()

async function load(name: CollectionName): Promise<void> {
  const store = stores.get(name)
  if (!store) return
  const requestId = ++store.latestRequest
  let next: State
  try {
    next = { items: await listItems<unknown>(name), loading: false, error: null }
  } catch {
    next = { ...store.state, loading: false, error: LOAD_ERROR }
  }
  // Dropped when a newer request was issued meanwhile, or when every screen has closed.
  if (requestId !== store.latestRequest || stores.get(name) !== store) return
  store.state = next
  store.listeners.forEach((notify) => notify())
}

function subscribe(name: CollectionName, listener: () => void): () => void {
  let store = stores.get(name)
  if (!store) {
    store = { state: EMPTY, listeners: new Set(), latestRequest: 0, timer: setInterval(() => load(name), POLL_INTERVAL_MS) }
    stores.set(name, store)
    load(name)
  }
  const current = store
  current.listeners.add(listener)
  return () => {
    current.listeners.delete(listener)
    if (current.listeners.size > 0) return
    clearInterval(current.timer)
    if (stores.get(name) === current) stores.delete(name)
  }
}

// Loads a collection and re-polls every few seconds so the other phone's changes show up.
// Call refresh() after a write for instant feedback.
export function useCollection<T>(name: CollectionName) {
  const state = useSyncExternalStore(
    useCallback((listener: () => void) => subscribe(name, listener), [name]),
    () => stores.get(name)?.state ?? EMPTY,
  )
  const refresh = useCallback(() => load(name), [name])

  return { items: state.items as T[], loading: state.loading, error: state.error, refresh }
}
