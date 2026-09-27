// The trips store: saved trips for the signed-in person.

import { useEffect, useSyncExternalStore } from 'react'
import { markChanged } from './changes'
import { getDb } from './db'
import { createTrip, normalizeTrip, type Trip, type TripDraft } from './trip'

type State = { loaded: boolean; trips: Trip[] }
let state: State = { loaded: false, trips: [] }
let loadStarted = false
const listeners = new Set<() => void>()

function setState(next: State) {
  state = next
  for (const l of listeners) l()
}

/** Re-reads trips from the phone database (after sync). */
export function reloadTrips(): Promise<void> {
  return load()
}

async function load() {
  try {
    const db = await getDb()
    const trips = (await db.getAll('trips'))
      .map(normalizeTrip)
      .filter((t): t is Trip => t !== null && !t.deletedAt)
      .sort((a, b) => (a.start < b.start ? -1 : 1))
    setState({ loaded: true, trips })
  } catch {
    setState({ loaded: true, trips: [] })
  }
}

export function useTrips(): State {
  const snap = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
  useEffect(() => {
    if (!loadStarted) {
      loadStarted = true
      void load()
    }
  }, [])
  return snap
}

export async function addTrip(draft: TripDraft, extra: Partial<Pick<Trip, 'kind' | 'title' | 'theme'>> = {}): Promise<Trip> {
  const trip = { ...createTrip(draft), ...extra }
  const db = await getDb()
  await db.put('trips', trip)
  await load()
  markChanged()
  return trip
}

export async function updateTrip(id: string, change: (t: Trip) => Trip): Promise<Trip> {
  const db = await getDb()
  const tx = db.transaction('trips', 'readwrite')
  const current = normalizeTrip(await tx.store.get(id))
  if (!current || current.deletedAt) throw new Error('That trip no longer exists.')
  const next = { ...change(current), updatedAt: new Date().toISOString() }
  await Promise.all([tx.store.put(next), tx.done])
  await load()
  markChanged()
  return next
}

export function deleteTrip(id: string): Promise<Trip> {
  return updateTrip(id, (t) => ({ ...t, deletedAt: new Date().toISOString() }))
}

export function resetTripsStore() {
  loadStarted = false
  setState({ loaded: false, trips: [] })
}
