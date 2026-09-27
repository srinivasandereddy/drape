// The on-phone database (IndexedDB). Each Google account gets its own database,
// so people sharing a phone never see each other's closet.
// Garment records and photos live in separate stores so the closet list loads
// without reading any image data.
//
// To change the layout later: bump DB_VERSION and add a new `if (oldVersion < N)`
// block in `upgrade`. Never edit an existing block.

import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { FeedbackRecord } from './feedback'
import type { Garment } from './model'
import type { Trip } from './trip'

/** Database used before accounts existed (v0.1–v0.3). */
export const LEGACY_DB_NAME = 'drape'
export const DB_VERSION = 4

export interface StoredPhoto {
  id: string
  full: Blob
  thumb: Blob
  /** Matches the garment's photoRev; missing means 1. */
  rev?: number
}

/** Small named records such as the profile. */
export interface MetaRecord {
  key: string
  value: unknown
  updatedAt: string
}

/** One outfit someone actually wore. Kept for history, freshness and later sync. */
export interface OutfitRecord {
  id: string
  /** Local date, YYYY-MM-DD */
  date: string
  garmentIds: string[]
  occasion: string
  createdAt: string
  deletedAt: string | null
  /** A plan for a future day rather than something already worn. */
  planned?: boolean
  /** Optional label, e.g. "Diwali" or "Interview". */
  note?: string
}

interface DrapeDB extends DBSchema {
  garments: { key: string; value: Garment; indexes: { 'by-updated': string } }
  photos: { key: string; value: StoredPhoto }
  meta: { key: string; value: MetaRecord }
  outfits: { key: string; value: OutfitRecord; indexes: { 'by-date': string } }
  feedback: { key: string; value: FeedbackRecord; indexes: { 'by-date': string } }
  trips: { key: string; value: Trip }
}

export type DrapeDatabase = IDBPDatabase<DrapeDB>
type StoreName = 'garments' | 'photos' | 'meta' | 'outfits' | 'feedback' | 'trips'
const STORES: readonly StoreName[] = ['garments', 'photos', 'meta', 'outfits', 'feedback', 'trips']

function open(name: string): Promise<DrapeDatabase> {
  return openDB<DrapeDB>(name, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const garments = db.createObjectStore('garments', { keyPath: 'id' })
        garments.createIndex('by-updated', 'updatedAt')
        db.createObjectStore('photos', { keyPath: 'id' })
      }
      if (oldVersion < 2) {
        db.createObjectStore('meta', { keyPath: 'key' })
        const outfits = db.createObjectStore('outfits', { keyPath: 'id' })
        outfits.createIndex('by-date', 'date')
      }
      if (oldVersion < 3) {
        const feedback = db.createObjectStore('feedback', { keyPath: 'id' })
        feedback.createIndex('by-date', 'date')
      }
      if (oldVersion < 4) {
        db.createObjectStore('trips', { keyPath: 'id' })
      }
    },
    blocking() {
      // A newer version of Drape opened in another tab; step aside so it can upgrade.
      closeDb()
    },
    terminated() {
      dbPromise = null
    },
  })
}

let dbName: string | null = null
let dbPromise: Promise<DrapeDatabase> | null = null

export const accountDbName = (sub: string) => `drape-u-${sub}`

/** Points all storage at one account's database. */
export function selectAccountDb(sub: string | null) {
  const next = sub ? accountDbName(sub) : null
  if (next === dbName) return
  closeDb()
  dbName = next
}

export function closeDb() {
  const p = dbPromise
  dbPromise = null
  void p?.then((db) => db.close()).catch(() => {})
}

export function getDb(): Promise<DrapeDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('This browser has no storage for Drape. Open it in Safari or Chrome, not a private window.'))
  }
  if (!dbName) return Promise.reject(new Error('Sign in to open your closet.'))
  const name = dbName
  dbPromise ??= open(name).catch((e: unknown) => {
    dbPromise = null
    throw e
  })
  return dbPromise
}

/** Removes one account's data from this phone. */
export async function deleteAccountDb(sub: string): Promise<void> {
  if (dbName === accountDbName(sub)) closeDb()
  await deleteDB(accountDbName(sub))
}

// ---------- closets saved before accounts ----------

async function openLegacy(): Promise<IDBPDatabase | null> {
  let existed = true
  // Opening without a version never changes an existing database; a brand-new
  // (empty) one means there was nothing to import, so remove it again.
  const db = await openDB(LEGACY_DB_NAME, undefined, {
    upgrade(_db, oldVersion) {
      if (oldVersion === 0) existed = false
    },
  })
  if (!existed || !db.objectStoreNames.contains('garments')) {
    db.close()
    await deleteDB(LEGACY_DB_NAME)
    return null
  }
  return db
}

/** How many live pieces are in the pre-accounts closet on this phone. */
export async function legacyPieceCount(): Promise<number> {
  try {
    const db = await openLegacy()
    if (!db) return 0
    const all = (await db.getAll('garments')) as { deletedAt?: string | null }[]
    db.close()
    return all.filter((g) => !g.deletedAt).length
  } catch {
    return 0
  }
}

/** Copies the pre-accounts closet into the signed-in account, then removes the old copy. */
export async function importLegacy(): Promise<number> {
  const legacy = await openLegacy()
  if (!legacy) return 0
  const target = await getDb()
  let count = 0
  try {
    for (const store of STORES) {
      if (!legacy.objectStoreNames.contains(store)) continue
      const rows = await legacy.getAll(store)
      if (rows.length === 0) continue
      const tx = target.transaction(store, 'readwrite')
      for (const row of rows) {
        // Never overwrite something the account already has (e.g. its profile).
        const key = (row as { id?: string; key?: string }).id ?? (row as { key?: string }).key
        if (key !== undefined && (await tx.store.get(key)) !== undefined) continue
        await tx.store.put(row as never)
        if (store === 'garments' && !(row as { deletedAt?: string | null }).deletedAt) count++
      }
      await tx.done
    }
  } finally {
    legacy.close()
  }
  await deleteDB(LEGACY_DB_NAME)
  return count
}

export async function discardLegacy(): Promise<void> {
  await deleteDB(LEGACY_DB_NAME)
}

/** Asks the browser not to clear Drape's data when the phone is low on space. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export async function storageEstimate(): Promise<{ usedMb: number; quotaMb: number } | null> {
  try {
    const e = await navigator.storage?.estimate?.()
    if (!e?.usage || !e.quota) return null
    return { usedMb: e.usage / 1_048_576, quotaMb: e.quota / 1_048_576 }
  } catch {
    return null
  }
}
