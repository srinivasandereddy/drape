// The on-phone database (IndexedDB). Garment records and photos live in
// separate stores so the closet list loads without reading any image data.
//
// To change the layout later: bump DB_VERSION and add a new `if (oldVersion < N)`
// block in `upgrade`. Never edit an existing block.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Garment } from './model'

export const DB_NAME = 'drape'
export const DB_VERSION = 2

export interface StoredPhoto {
  id: string
  full: Blob
  thumb: Blob
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
}

interface DrapeDB extends DBSchema {
  garments: { key: string; value: Garment; indexes: { 'by-updated': string } }
  photos: { key: string; value: StoredPhoto }
  meta: { key: string; value: MetaRecord }
  outfits: { key: string; value: OutfitRecord; indexes: { 'by-date': string } }
}

export type DrapeDatabase = IDBPDatabase<DrapeDB>

let dbPromise: Promise<DrapeDatabase> | null = null

export function getDb(): Promise<DrapeDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('This browser has no storage for Drape. Open it in Safari or Chrome, not a private window.'))
  }
  dbPromise ??= openDB<DrapeDB>(DB_NAME, DB_VERSION, {
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
    },
    blocking() {
      // A newer version of Drape opened in another tab; step aside so it can upgrade.
      void dbPromise?.then((db) => db.close())
      dbPromise = null
    },
    terminated() {
      dbPromise = null
    },
  }).catch((e: unknown) => {
    dbPromise = null
    throw e
  })
  return dbPromise
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
