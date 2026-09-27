// Two-way sync between this phone and the person's hidden Drape folder in Google Drive.
//
// Every record is one small file: g_<id>.json (garment), o_<id>.json (worn outfit),
// f_<id>.json (feedback), t_<id>.json (trip), profile.json, plus p_<id>_full.jpg and
// p_<id>_thumb.jpg for photos. Each file carries its record's `updatedAt` in its
// Drive properties, so a sync can compare without downloading anything.
//
// Rule: for each record, the newer `updatedAt` wins. Deletes are records too
// (deletedAt is set), so a delete on one phone reaches the others.
// The same code runs against a fake Drive in the tests.

import { getDb } from './db'
import type { FeedbackRecord } from './feedback'
import { ID_PATTERN } from './id'
import { normalizeGarment, type Garment } from './model'
import { normalizeProfile } from './profile'
import { normalizeTrip } from './trip'

export interface RemoteFile {
  id: string
  name: string
  /** updatedAt of the record inside, as saved when uploaded. */
  updatedAt: string
}

/** What sync needs from a file store. Google Drive in the app; an in-memory fake in tests. */
export interface Remote {
  list(): Promise<RemoteFile[]>
  getJson(id: string): Promise<unknown>
  getBlob(id: string): Promise<Blob>
  put(name: string, body: Blob | object, updatedAt: string, existingId?: string): Promise<RemoteFile>
  remove(id: string): Promise<void>
}

export interface SyncResult {
  uploaded: number
  downloaded: number
  removed: number
}

type Kind = 'garment' | 'outfit' | 'feedback' | 'trip' | 'profile'
type Local = { name: string; kind: Kind; id: string; updatedAt: string; data: unknown }

const PREFIX: Record<Exclude<Kind, 'profile'>, string> = { garment: 'g', outfit: 'o', feedback: 'f', trip: 't' }
const fileName = (kind: Kind, id: string) => (kind === 'profile' ? 'profile.json' : `${PREFIX[kind]}_${id}.json`)

/** Parses a data file name back into its kind and record id. Unknown names are ignored. */
export function parseName(name: string): { kind: Kind; id: string } | null {
  if (name === 'profile.json') return { kind: 'profile', id: 'profile' }
  const m = /^([goft])_([0-9A-HJKMNP-TV-Z]{26})\.json$/.exec(name)
  if (!m) return null
  const kind = (Object.entries(PREFIX).find(([, p]) => p === m[1])?.[0] ?? null) as Kind | null
  return kind ? { kind, id: m[2]! } : null
}
// Revision 1 keeps the original names so earlier uploads still count.
const photoName = (id: string, size: 'full' | 'thumb', rev = 1) => (rev <= 1 ? `p_${id}_${size}.jpg` : `p_${id}_r${rev}_${size}`)
const PHOTO_FILE = /^p_([0-9A-HJKMNP-TV-Z]{26})_(?:r(\d+)_)?(full|thumb)(?:\.jpg)?$/

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const iso = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null)

function validOutfit(v: unknown) {
  return isRecord(v) && typeof v.id === 'string' && ID_PATTERN.test(v.id) && typeof v.date === 'string' && Array.isArray(v.garmentIds) && iso(v.createdAt) ? v : null
}
function validFeedback(v: unknown): FeedbackRecord | null {
  return isRecord(v) && typeof v.id === 'string' && ID_PATTERN.test(v.id) && Array.isArray(v.garmentIds) && (v.verdict === 'love' || v.verdict === 'dislike') && iso(v.createdAt)
    ? (v as unknown as FeedbackRecord)
    : null
}

async function readLocal(): Promise<{ records: Local[]; photoRevs: Map<string, number>; garments: Map<string, Garment> }> {
  const db = await getDb()
  const records: Local[] = []
  const garments = new Map<string, Garment>()
  for (const raw of await db.getAll('garments')) {
    const g = normalizeGarment(raw)
    if (!g) continue
    garments.set(g.id, g)
    records.push({ name: fileName('garment', g.id), kind: 'garment', id: g.id, updatedAt: g.updatedAt, data: g })
  }
  for (const o of await db.getAll('outfits')) records.push({ name: fileName('outfit', o.id), kind: 'outfit', id: o.id, updatedAt: o.deletedAt ?? o.createdAt, data: o })
  for (const f of await db.getAll('feedback')) records.push({ name: fileName('feedback', f.id), kind: 'feedback', id: f.id, updatedAt: f.deletedAt ?? f.createdAt, data: f })
  for (const raw of await db.getAll('trips')) {
    const t = normalizeTrip(raw)
    if (t) records.push({ name: fileName('trip', t.id), kind: 'trip', id: t.id, updatedAt: t.updatedAt, data: t })
  }
  const profile = await db.get('meta', 'profile')
  if (profile) records.push({ name: 'profile.json', kind: 'profile', id: 'profile', updatedAt: profile.updatedAt, data: profile.value })
  const photoRevs = new Map<string, number>()
  for (const p of await db.getAll('photos')) photoRevs.set(p.id, p.rev ?? 1)
  return { records, photoRevs, garments }
}

/** Saves one downloaded record, after checking it. Returns false if it was unusable. */
async function writeLocal(kind: Kind, data: unknown, updatedAt: string): Promise<Garment | false | true> {
  const db = await getDb()
  switch (kind) {
    case 'garment': {
      const g = normalizeGarment(data)
      if (!g) return false
      await db.put('garments', g)
      if (g.deletedAt) await db.delete('photos', g.id)
      return g
    }
    case 'outfit': {
      const o = validOutfit(data)
      if (!o) return false
      await db.put('outfits', o as never)
      return true
    }
    case 'feedback': {
      const f = validFeedback(data)
      if (!f) return false
      await db.put('feedback', f)
      return true
    }
    case 'trip': {
      const t = normalizeTrip(data)
      if (!t) return false
      await db.put('trips', t)
      return true
    }
    case 'profile':
      await db.put('meta', { key: 'profile', value: normalizeProfile(data), updatedAt })
      return true
  }
}

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  let i = 0
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]!)
  })
  await Promise.all(workers)
}

export async function syncOnce(remote: Remote, onProgress?: (done: number, total: number) => void): Promise<SyncResult> {
  const result: SyncResult = { uploaded: 0, downloaded: 0, removed: 0 }
  const files = await remote.list()
  // If a name appears twice (two phones uploaded at once), keep the newest and remove the rest.
  const byName = new Map<string, RemoteFile>()
  const duplicates: RemoteFile[] = []
  for (const f of files) {
    const seen = byName.get(f.name)
    if (!seen) byName.set(f.name, f)
    else if (f.updatedAt > seen.updatedAt) {
      duplicates.push(seen)
      byName.set(f.name, f)
    } else duplicates.push(f)
  }

  const local = await readLocal()
  const localByName = new Map(local.records.map((r) => [r.name, r]))
  const garments = new Map(local.garments)

  type Job = () => Promise<void>
  const jobs: Job[] = []

  // 1. Data records.
  for (const r of local.records) {
    const f = byName.get(r.name)
    if (!f || r.updatedAt > f.updatedAt) {
      jobs.push(async () => {
        await remote.put(r.name, r.data as object, r.updatedAt, f?.id)
        result.uploaded++
      })
    }
  }
  for (const [name, f] of byName) {
    const parsed = parseName(name)
    if (!parsed) continue
    const r = localByName.get(name)
    if (!r || f.updatedAt > r.updatedAt) {
      jobs.push(async () => {
        const saved = await writeLocal(parsed.kind, await remote.getJson(f.id), f.updatedAt)
        if (saved && saved !== true) garments.set(saved.id, saved)
        if (saved) result.downloaded++
      })
    }
  }
  for (const d of duplicates) {
    jobs.push(async () => {
      await remote.remove(d.id)
      result.removed++
    })
  }

  let done = 0
  const total = () => jobs.length
  onProgress?.(0, total())
  await pool(jobs, 4, async (job) => {
    await job()
    onProgress?.(++done, total())
  })

  // 2. Photos, once every garment is known. Each revision is uploaded once; older ones are removed.
  const photoJobs: Job[] = []
  const db = await getDb()
  const remotePhotos = new Map<string, RemoteFile[]>()
  for (const f of byName.values()) {
    const m = PHOTO_FILE.exec(f.name)
    if (m) remotePhotos.set(m[1]!, [...(remotePhotos.get(m[1]!) ?? []), f])
  }
  const removeFiles = (list: RemoteFile[]) => {
    for (const f of list)
      photoJobs.push(async () => {
        await remote.remove(f.id)
        result.removed++
      })
  }
  for (const g of garments.values()) {
    const theirs = remotePhotos.get(g.id) ?? []
    if (g.deletedAt || !g.photo) {
      if (g.deletedAt) removeFiles(theirs)
      continue
    }
    const want = g.photoRev
    const full = byName.get(photoName(g.id, 'full', want))
    const thumb = byName.get(photoName(g.id, 'thumb', want))
    const stale = theirs.filter((f) => f !== full && f !== thumb)
    const localRev = local.photoRevs.get(g.id)
    if (localRev === want && (!full || !thumb)) {
      photoJobs.push(async () => {
        const p = await db.get('photos', g.id)
        if (!p) return
        await remote.put(photoName(g.id, 'full', want), p.full, g.updatedAt, full?.id)
        await remote.put(photoName(g.id, 'thumb', want), p.thumb, g.updatedAt, thumb?.id)
        result.uploaded += 2
      })
      removeFiles(stale)
    } else if (localRev !== want && full && thumb) {
      photoJobs.push(async () => {
        const [f, t] = await Promise.all([remote.getBlob(full.id), remote.getBlob(thumb.id)])
        await db.put('photos', { id: g.id, full: f, thumb: t, rev: want })
        result.downloaded += 2
      })
    } else if (localRev === want && full && thumb) {
      removeFiles(stale)
    }
  }
  const base = jobs.length
  onProgress?.(done, base + photoJobs.length)
  await pool(photoJobs, 3, async (job) => {
    await job()
    onProgress?.(++done, base + photoJobs.length)
  })

  return result
}
