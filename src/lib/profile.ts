// The person's details that shape suggestions: city (for weather) and daily routine.
// Stored in the phone database, and synced to Drive in a later milestone.

import { useEffect, useSyncExternalStore } from 'react'
import type { Formality } from './catalog'
import { getDb } from './db'
import type { City } from './weather'

export type RoutineId = 'corporate' | 'business-casual' | 'remote' | 'field' | 'student' | 'creative'

export const ROUTINES: readonly { id: RoutineId; label: string; workFormality: Formality }[] = [
  { id: 'corporate', label: 'Corporate office', workFormality: 4 },
  { id: 'business-casual', label: 'Business casual', workFormality: 3 },
  { id: 'remote', label: 'Work from home', workFormality: 2 },
  { id: 'field', label: 'Field / on-site work', workFormality: 2 },
  { id: 'student', label: 'Student', workFormality: 2 },
  { id: 'creative', label: 'Creative work', workFormality: 2 },
]

export const routineDef = (id: RoutineId | null) => ROUTINES.find((r) => r.id === id) ?? null

export interface Profile {
  city: City | null
  routine: RoutineId | null
}

const EMPTY: Profile = { city: null, routine: null }

function normalizeProfile(raw: unknown): Profile {
  if (typeof raw !== 'object' || raw === null) return EMPTY
  const r = raw as Record<string, unknown>
  const c = r.city as Record<string, unknown> | null | undefined
  const city =
    c && typeof c.name === 'string' && typeof c.latitude === 'number' && typeof c.longitude === 'number'
      ? {
          name: c.name,
          region: typeof c.region === 'string' ? c.region : '',
          country: typeof c.country === 'string' ? c.country : '',
          latitude: c.latitude,
          longitude: c.longitude,
        }
      : null
  const routine = ROUTINES.some((x) => x.id === r.routine) ? (r.routine as RoutineId) : null
  return { city, routine }
}

type State = { loaded: boolean; profile: Profile }
let state: State = { loaded: false, profile: EMPTY }
let loadStarted = false
const listeners = new Set<() => void>()

function setState(next: State) {
  state = next
  for (const l of listeners) l()
}

async function load() {
  try {
    const db = await getDb()
    const rec = await db.get('meta', 'profile')
    setState({ loaded: true, profile: normalizeProfile(rec?.value) })
  } catch {
    setState({ loaded: true, profile: EMPTY })
  }
}

export function useProfile(): State {
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

export async function saveProfile(patch: Partial<Profile>): Promise<void> {
  const profile = normalizeProfile({ ...state.profile, ...patch })
  const db = await getDb()
  await db.put('meta', { key: 'profile', value: profile, updatedAt: new Date().toISOString() })
  setState({ loaded: true, profile })
}
