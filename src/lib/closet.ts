// The closet store: the only module that reads or writes garments.
// Screens subscribe with `useCloset()` and re-render when anything changes.

import { useEffect, useSyncExternalStore } from 'react'
import { getDb, requestPersistentStorage, type StoredPhoto } from './db'
import type { ProcessedPhoto } from './image'
import { applyDraft, createGarment, markDeleted, markWorn, normalizeGarment, type Garment, type GarmentDraft } from './model'

export type ClosetState =
  | { status: 'loading'; garments: Garment[] }
  | { status: 'ready'; garments: Garment[] }
  | { status: 'error'; garments: Garment[]; message: string }

let state: ClosetState = { status: 'loading', garments: [] }
let loadStarted = false
const listeners = new Set<() => void>()

function setState(next: ClosetState) {
  state = next
  for (const l of listeners) l()
}

function errorMessage(e: unknown): string {
  if (e instanceof DOMException && e.name === 'QuotaExceededError') {
    return 'This phone is out of space for Drape. Free up some storage and try again.'
  }
  return e instanceof Error ? e.message : 'Something went wrong with storage.'
}

export async function reload(): Promise<void> {
  try {
    const db = await getDb()
    const raw = await db.getAll('garments')
    const garments = raw
      .map(normalizeGarment)
      .filter((g): g is Garment => g !== null && g.deletedAt === null)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
    setState({ status: 'ready', garments })
  } catch (e) {
    setState({ status: 'error', garments: state.garments, message: errorMessage(e) })
  }
}

export function useCloset(): ClosetState {
  const snapshot = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
  useEffect(() => {
    if (!loadStarted) {
      loadStarted = true
      void reload()
    }
  }, [])
  return snapshot
}

async function write<T>(fn: () => Promise<T>): Promise<T> {
  try {
    const out = await fn()
    await reload()
    return out
  } catch (e) {
    throw new Error(errorMessage(e), { cause: e })
  }
}

export function addGarment(draft: GarmentDraft, photo: ProcessedPhoto): Promise<Garment> {
  return write(async () => {
    const garment = createGarment(draft, { width: photo.width, height: photo.height })
    const db = await getDb()
    // One transaction: the garment and its photo are saved together or not at all.
    const tx = db.transaction(['garments', 'photos'], 'readwrite')
    await Promise.all([
      tx.objectStore('photos').put({ id: garment.id, full: photo.full, thumb: photo.thumb }),
      tx.objectStore('garments').put(garment),
      tx.done,
    ])
    void requestPersistentStorage()
    return garment
  })
}

async function updateStored(id: string, change: (g: Garment) => Garment): Promise<Garment> {
  const db = await getDb()
  const tx = db.transaction('garments', 'readwrite')
  const current = normalizeGarment(await tx.store.get(id))
  if (!current || current.deletedAt) throw new Error('That piece is no longer in your closet.')
  const next = change(current)
  await Promise.all([tx.store.put(next), tx.done])
  return next
}

export function editGarment(id: string, draft: GarmentDraft): Promise<Garment> {
  return write(() => updateStored(id, (g) => applyDraft(g, draft)))
}

export function wearGarment(id: string): Promise<Garment> {
  return write(() => updateStored(id, (g) => markWorn(g)))
}

/** Keeps a "deleted" marker for sync, and frees the photo space right away. */
export function deleteGarment(id: string): Promise<void> {
  return write(async () => {
    const db = await getDb()
    const tx = db.transaction(['garments', 'photos'], 'readwrite')
    const current = normalizeGarment(await tx.objectStore('garments').get(id))
    const ops: Promise<unknown>[] = [tx.objectStore('photos').delete(id), tx.done]
    if (current) ops.push(tx.objectStore('garments').put(markDeleted(current)))
    await Promise.all(ops)
  })
}

export async function getPhoto(id: string): Promise<StoredPhoto | undefined> {
  const db = await getDb()
  return db.get('photos', id)
}

/** Removes every garment and photo from this phone. Drive is not touched. */
export function wipeLocalData(): Promise<void> {
  return write(async () => {
    const db = await getDb()
    const tx = db.transaction(['garments', 'photos'], 'readwrite')
    await Promise.all([tx.objectStore('garments').clear(), tx.objectStore('photos').clear(), tx.done])
  })
}
