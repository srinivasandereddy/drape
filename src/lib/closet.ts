// The closet store: the only module that reads or writes garments and worn outfits.
// Screens subscribe with `useCloset()` and re-render when anything changes.

import { useEffect, useSyncExternalStore } from 'react'
import { markChanged } from './changes'
import { extractColorsFromBlob } from './color'
import { getDb, requestPersistentStorage, type OutfitRecord, type StoredPhoto } from './db'
import type { DislikeReason, FeedbackRecord, Verdict } from './feedback'
import { newId } from './id'
import type { ProcessedPhoto } from './image'
import {
  applyDraft,
  createGarment,
  markDeleted,
  markWorn,
  normalizeGarment,
  type Garment,
  type GarmentColor,
  type GarmentDraft,
  type GarmentSource,
} from './model'

export interface ClosetState {
  status: 'loading' | 'ready' | 'error'
  garments: Garment[]
  message: string | null
  /** Progress while colors are being read from older photos. */
  scan: { done: number; total: number } | null
}

let state: ClosetState = { status: 'loading', garments: [], message: null, scan: null }
let loadStarted = false
const listeners = new Set<() => void>()

function setState(patch: Partial<ClosetState>) {
  state = { ...state, ...patch }
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
    setState({ status: 'ready', garments, message: null })
  } catch (e) {
    setState({ status: 'error', message: errorMessage(e) })
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
      void reload().then(scanMissingColors)
    }
  }, [])
  return snapshot
}

async function write<T>(fn: () => Promise<T>): Promise<T> {
  try {
    const out = await fn()
    await reload()
    markChanged()
    return out
  } catch (e) {
    throw new Error(errorMessage(e), { cause: e })
  }
}

/** Forget everything loaded (used when the signed-in account changes). */
export function resetClosetStore() {
  loadStarted = false
  scanning = false
  state = { status: 'loading', garments: [], message: null, scan: null }
  for (const l of listeners) l()
}

/** Adds several pieces without photos (typed lists, sample wardrobe) in one go. */
export function addGarments(drafts: GarmentDraft[], source: GarmentSource): Promise<Garment[]> {
  return write(async () => {
    const now = Date.now()
    const garments = drafts.map((d, i) => createGarment(d, null, new Date(now + i), undefined, source))
    const db = await getDb()
    const tx = db.transaction('garments', 'readwrite')
    await Promise.all([...garments.map((g) => tx.store.put(g)), tx.done])
    void requestPersistentStorage()
    return garments
  })
}

/** Removes every sample piece. Returns how many were removed. */
export function removeSamples(): Promise<number> {
  return write(async () => {
    const db = await getDb()
    const tx = db.transaction('garments', 'readwrite')
    const all = (await tx.store.getAll()).map(normalizeGarment).filter((g): g is Garment => !!g && !g.deletedAt && g.source === 'sample')
    for (const g of all) await tx.store.put(markDeleted(g))
    await tx.done
    return all.length
  })
}

/** Adds or replaces the photo of an existing piece, and re-reads its colors unless they were fixed by hand. */
export function setGarmentPhoto(id: string, photo: ProcessedPhoto, colors: GarmentColor[]): Promise<Garment> {
  return write(async () => {
    const db = await getDb()
    const tx = db.transaction(['garments', 'photos'], 'readwrite')
    const current = normalizeGarment(await tx.objectStore('garments').get(id))
    if (!current || current.deletedAt) throw new Error('That piece is no longer in your closet.')
    const next: Garment = {
      ...current,
      photo: { width: photo.width, height: photo.height },
      source: current.source === 'sample' ? 'sample' : 'photo',
      colors: current.colorsEdited || colors.length === 0 ? current.colors : colors,
      updatedAt: new Date().toISOString(),
    }
    await Promise.all([tx.objectStore('photos').put({ id, full: photo.full, thumb: photo.thumb }), tx.objectStore('garments').put(next), tx.done])
    return next
  })
}

// ---------- feedback ----------

export async function saveFeedback(garmentIds: string[], verdict: Verdict, reason: DislikeReason | null, note = ''): Promise<FeedbackRecord> {
  const now = new Date()
  const record: FeedbackRecord = { id: newId(now.getTime()), date: localDate(now), garmentIds, verdict, reason, note: note.slice(0, 200), createdAt: now.toISOString(), deletedAt: null }
  const db = await getDb()
  await db.put('feedback', record)
  markChanged()
  return record
}

export async function listFeedback(): Promise<FeedbackRecord[]> {
  try {
    const db = await getDb()
    return (await db.getAll('feedback')).filter((f) => !f.deletedAt)
  } catch {
    return []
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

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Marks every piece as worn today and keeps a record of the outfit. */
export function wearOutfit(garmentIds: string[], occasion: string): Promise<OutfitRecord> {
  return write(async () => {
    const now = new Date()
    const db = await getDb()
    const tx = db.transaction(['garments', 'outfits'], 'readwrite')
    const garments = tx.objectStore('garments')
    const worn: string[] = []
    for (const id of new Set(garmentIds)) {
      const g = normalizeGarment(await garments.get(id))
      if (!g || g.deletedAt) continue
      await garments.put(markWorn(g, now))
      worn.push(id)
    }
    const record: OutfitRecord = { id: newId(now.getTime()), date: localDate(now), garmentIds: worn, occasion, createdAt: now.toISOString(), deletedAt: null }
    await tx.objectStore('outfits').put(record)
    await tx.done
    return record
  })
}

export async function todaysOutfit(): Promise<OutfitRecord | null> {
  try {
    const db = await getDb()
    const list = await db.getAllFromIndex('outfits', 'by-date', localDate(new Date()))
    return list.filter((o) => !o.deletedAt).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0] ?? null
  } catch {
    return null
  }
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

/**
 * Deletes every piece, outfit, trip and piece of feedback for this person.
 * Records are marked deleted (not erased) so the delete also reaches their other phones and Drive.
 */
export function deleteEverything(): Promise<void> {
  return write(async () => {
    const at = new Date().toISOString()
    const db = await getDb()
    const tx = db.transaction(['garments', 'photos', 'outfits', 'feedback', 'trips'], 'readwrite')
    for (const g of await tx.objectStore('garments').getAll()) if (!g.deletedAt) await tx.objectStore('garments').put({ ...g, deletedAt: at, updatedAt: at })
    await tx.objectStore('photos').clear()
    for (const o of await tx.objectStore('outfits').getAll()) if (!o.deletedAt) await tx.objectStore('outfits').put({ ...o, deletedAt: at })
    for (const f of await tx.objectStore('feedback').getAll()) if (!f.deletedAt) await tx.objectStore('feedback').put({ ...f, deletedAt: at })
    for (const t of await tx.objectStore('trips').getAll()) if (!t.deletedAt) await tx.objectStore('trips').put({ ...t, deletedAt: at, updatedAt: at })
    await tx.done
  })
}

// ---------- reading colors for pieces added before color support ----------

let scanning = false

/** Reads colors, one photo at a time, for pieces that have none yet. Safe to call repeatedly. */
export async function scanMissingColors(): Promise<void> {
  if (scanning) return
  const todo = state.garments.filter((g) => g.colors.length === 0 && !g.colorsEdited && g.photo)
  if (todo.length === 0) return
  scanning = true
  setState({ scan: { done: 0, total: todo.length } })
  try {
    for (const [i, g] of todo.entries()) {
      try {
        const photo = await getPhoto(g.id)
        const colors: GarmentColor[] = photo ? await extractColorsFromBlob(photo.thumb) : []
        if (colors.length) {
          await updateStored(g.id, (cur) =>
            cur.colors.length || cur.colorsEdited ? cur : { ...cur, colors, updatedAt: new Date().toISOString() },
          )
          await reload()
        }
      } catch {
        // One unreadable photo should not stop the rest.
      }
      setState({ scan: { done: i + 1, total: todo.length } })
    }
  } finally {
    scanning = false
    setState({ scan: null })
  }
}
