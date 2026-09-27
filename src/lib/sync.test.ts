import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { getDb, selectAccountDb } from './db'
import { createGarment, emptyDraft, markDeleted, markWorn, type Garment } from './model'
import { parseName, syncOnce, wipeRemote, type Remote, type RemoteFile } from './sync'

/** An in-memory stand-in for the Drive folder, shared by the two "phones". */
class FakeDrive implements Remote {
  files = new Map<string, RemoteFile & { body: Blob | object }>()
  seq = 0
  calls = 0
  async list() {
    this.calls++
    return [...this.files.values()].map(({ id, name, updatedAt }) => ({ id, name, updatedAt }))
  }
  async getJson(id: string) {
    this.calls++
    return JSON.parse(JSON.stringify(this.files.get(id)!.body))
  }
  async getBlob(id: string) {
    this.calls++
    return this.files.get(id)!.body as Blob
  }
  async put(name: string, body: Blob | object, updatedAt: string, existingId?: string) {
    this.calls++
    const id = existingId ?? `file${++this.seq}`
    const f = { id, name, updatedAt, body: body instanceof Blob ? body : JSON.parse(JSON.stringify(body)) }
    this.files.set(id, f)
    return { id, name, updatedAt }
  }
  async remove(id: string) {
    this.calls++
    this.files.delete(id)
  }
  names() {
    return [...this.files.values()].map((f) => f.name).sort()
  }
}

let n = 0
const at = (min: number) => new Date(Date.UTC(2026, 8, 27, 9, min))
function shirt(name: string, min: number): Garment {
  return createGarment({ ...emptyDraft(), category: 'top', subtype: 'Shirt', name }, { width: 10, height: 10 }, at(min), undefined, 'photo')
}

async function onPhone<T>(phone: string, fn: () => Promise<T>): Promise<T> {
  selectAccountDb(`${phone}-${n}`)
  return fn()
}
async function put(g: Garment, photo = true) {
  const db = await getDb()
  await db.put('garments', g)
  if (photo) await db.put('photos', { id: g.id, full: new Blob(['full-' + g.id]), thumb: new Blob(['thumb-' + g.id]) })
}
async function garments() {
  return (await (await getDb()).getAll('garments')).sort((a, b) => a.name.localeCompare(b.name))
}

describe('sync between two phones through Drive', () => {
  let drive: FakeDrive
  beforeEach(() => {
    n++
    drive = new FakeDrive()
  })

  it('knows its file names', () => {
    expect(parseName('profile.json')).toEqual({ kind: 'profile', id: 'profile' })
    expect(parseName('g_01M3GTVNMG2GT09XDMBYRRDM73.json')).toEqual({ kind: 'garment', id: '01M3GTVNMG2GT09XDMBYRRDM73' })
    expect(parseName('test-123.json')).toBeNull()
    expect(parseName('p_01M3GTVNMG2GT09XDMBYRRDM73_full.jpg')).toBeNull()
  })

  it('copies a closet with photos to a new phone, and does nothing when already in step', async () => {
    const a = shirt('Blue shirt', 1)
    await onPhone('A', async () => {
      await put(a)
      await (await getDb()).put('meta', { key: 'profile', value: { name: 'Sam', onboarded: true }, updatedAt: at(2).toISOString() })
      const r = await syncOnce(drive)
      expect(r.uploaded).toBe(4) // garment + profile + 2 photo files
    })
    expect(drive.names()).toEqual(expect.arrayContaining([`g_${a.id}.json`, 'profile.json', `p_${a.id}_full.jpg`, `p_${a.id}_thumb.jpg`]))

    await onPhone('B', async () => {
      const r = await syncOnce(drive)
      expect(r.downloaded).toBe(4)
      expect((await garments()).map((g) => g.name)).toEqual(['Blue shirt'])
      const photo = await (await getDb()).get('photos', a.id)
      expect(await photo!.thumb.text()).toBe(`thumb-${a.id}`)
      expect((await (await getDb()).get('meta', 'profile'))!.value).toMatchObject({ name: 'Sam', onboarded: true })
      // Second sync: nothing to do.
      expect(await syncOnce(drive)).toEqual({ uploaded: 0, downloaded: 0, removed: 0 })
    })
  })

  it('newest edit wins, and deletes reach the other phone', async () => {
    const a = shirt('Blue shirt', 1)
    const b = shirt('Red shirt', 2)
    await onPhone('A', async () => {
      await put(a)
      await put(b)
      await syncOnce(drive)
    })
    await onPhone('B', async () => {
      await syncOnce(drive)
      // Phone B wears the blue shirt (edit at minute 10) and deletes the red one.
      await put(markWorn(a, at(10)), false)
      await put(markDeleted(b, at(11)), false)
      await (await getDb()).delete('photos', b.id)
      await syncOnce(drive)
    })
    expect(drive.names()).not.toContain(`p_${b.id}_full.jpg`) // deleted piece's photos are removed from Drive
    await onPhone('A', async () => {
      // Phone A made an older edit meanwhile (minute 5): it loses to B's newer one.
      await put({ ...a, name: 'Old name', updatedAt: at(5).toISOString() }, false)
      await syncOnce(drive)
      const [blue, red] = await garments()
      expect(blue).toMatchObject({ name: 'Blue shirt', wornCount: 1 })
      expect(red!.deletedAt).toBe(at(11).toISOString())
      expect(await (await getDb()).get('photos', b.id)).toBeUndefined()
    })
  })

  it('syncs outfits, feedback and trips, and ignores junk files', async () => {
    await drive.put('test-1.json', { hello: 1 }, at(0).toISOString())
    await drive.put('g_NOTAVALIDID.json', { nope: true }, at(0).toISOString())
    const g = shirt('Blue shirt', 1)
    await onPhone('A', async () => {
      const db = await getDb()
      await put(g)
      await db.put('outfits', { id: g.id, date: '2026-09-27', garmentIds: [g.id], occasion: 'casual', createdAt: at(3).toISOString(), deletedAt: null })
      await db.put('feedback', { id: g.id, date: '2026-09-27', garmentIds: [g.id], verdict: 'love', reason: null, note: '', createdAt: at(4).toISOString(), deletedAt: null })
      await db.put('trips', {
        id: g.id,
        kind: 'trip',
        title: '',
        theme: null,
        destination: { name: 'Goa', region: 'Goa', country: 'India', latitude: 15, longitude: 74 },
        start: '2026-10-02',
        end: '2026-10-04',
        vibe: 'beach',
        activities: ['casual'],
        packed: [],
        createdAt: at(5).toISOString(),
        updatedAt: at(5).toISOString(),
        deletedAt: null,
      })
      await syncOnce(drive)
    })
    await onPhone('B', async () => {
      const r = await syncOnce(drive)
      const db = await getDb()
      expect(await db.count('outfits')).toBe(1)
      expect(await db.count('feedback')).toBe(1)
      expect((await db.getAll('trips'))[0]).toMatchObject({ vibe: 'beach' })
      expect(r.downloaded).toBe(6) // garment, outfit, feedback, trip, 2 photos
    })
    expect(drive.names()).toContain('test-1.json') // other files are left alone
  })

  it('sends a replaced photo (e.g. background removed) to the other phone', async () => {
    const g = shirt('Blue shirt', 1)
    await onPhone('A', async () => {
      await put(g)
      await syncOnce(drive)
    })
    await onPhone('B', async () => {
      await syncOnce(drive)
    })
    await onPhone('A', async () => {
      const db = await getDb()
      const next = { ...g, photoRev: 2, updatedAt: at(20).toISOString() }
      await db.put('garments', next)
      await db.put('photos', { id: g.id, full: new Blob(['cutout-full']), thumb: new Blob(['cutout-thumb']), rev: 2 })
      await syncOnce(drive)
    })
    expect(drive.names().filter((x) => x.startsWith('p_'))).toEqual([`p_${g.id}_r2_full`, `p_${g.id}_r2_thumb`])
    await onPhone('B', async () => {
      await syncOnce(drive)
      const p = await (await getDb()).get('photos', g.id)
      expect(await p!.thumb.text()).toBe('cutout-thumb')
      expect(p!.rev).toBe(2)
    })
  })

  it('deleting the account empties the Drive folder', async () => {
    await onPhone('A', async () => {
      await put(shirt('Blue shirt', 1))
      await (await getDb()).put('meta', { key: 'profile', value: { name: 'Sam' }, updatedAt: at(2).toISOString() })
      await syncOnce(drive)
    })
    expect(drive.files.size).toBe(4)
    const progress: number[] = []
    expect(await wipeRemote(drive, (done) => progress.push(done))).toBe(4)
    expect(drive.files.size).toBe(0)
    expect(progress.at(-1)).toBe(4)
  })

  it('cleans up duplicate files from two phones uploading at once', async () => {
    const g = shirt('Blue shirt', 1)
    await drive.put(`g_${g.id}.json`, g, g.updatedAt)
    await drive.put(`g_${g.id}.json`, { ...g, name: 'Newer' }, at(30).toISOString())
    await onPhone('A', async () => {
      const r = await syncOnce(drive)
      expect(r.removed).toBe(1)
      expect((await garments())[0]!.name).toBe('Newer')
    })
    expect(drive.names().filter((x) => x.startsWith('g_'))).toHaveLength(1)
  })
})
