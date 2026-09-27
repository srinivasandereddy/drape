import { describe, expect, it } from 'vitest'
import { CATEGORIES } from './catalog'
import { ID_PATTERN, newId } from './id'
import { checkFile, fitWithin, PhotoError } from './image'
import {
  applyDraft,
  createGarment,
  displayName,
  emptyDraft,
  markDeleted,
  markWorn,
  normalizeGarment,
  sanitizeDraft,
  validateDraft,
  type GarmentDraft,
} from './model'

const NOW = new Date('2026-09-27T09:00:00.000Z')
const draft = (patch: Partial<GarmentDraft> = {}): GarmentDraft => ({ ...emptyDraft(), category: 'top', ...patch })

describe('newId', () => {
  it('makes 26-character ids that sort by time', () => {
    const a = newId(1_000)
    const b = newId(2_000)
    expect(a).toMatch(ID_PATTERN)
    expect(b).toMatch(ID_PATTERN)
    expect(a < b).toBe(true)
  })
  it('does not repeat', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newId(NOW.getTime())))
    expect(ids.size).toBe(1000)
  })
})

describe('catalog', () => {
  it('has unique category ids and subtypes', () => {
    const ids = CATEGORIES.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const c of CATEGORIES) expect(new Set(c.subtypes).size).toBe(c.subtypes.length)
  })
})

describe('drafts', () => {
  it('requires a category', () => {
    expect(validateDraft(emptyDraft())).toHaveLength(1)
    expect(validateDraft(draft())).toEqual([])
  })
  it('clears attributes that do not fit the category', () => {
    const d = sanitizeDraft(draft({ category: 'jewellery', pattern: 'striped', warmth: 3, metal: 'gold', subtype: 'Jeans' }))
    expect(d).toMatchObject({ pattern: null, warmth: null, metal: 'gold', subtype: '' })
    const shirt = sanitizeDraft(draft({ category: 'top', metal: 'gold', subtype: 'Shirt' }))
    expect(shirt).toMatchObject({ metal: null, subtype: 'Shirt' })
  })
  it('removes duplicate seasons', () => {
    expect(sanitizeDraft(draft({ seasons: ['summer', 'summer', 'winter'] })).seasons).toEqual(['summer', 'winter'])
  })
})

describe('garment lifecycle', () => {
  const g = createGarment(draft({ name: '  Blue linen shirt  ', subtype: 'Shirt' }), { width: 1200, height: 1600 }, NOW)

  it('creates a clean record', () => {
    expect(g.id).toMatch(ID_PATTERN)
    expect(g.name).toBe('Blue linen shirt')
    expect(g.createdAt).toBe(NOW.toISOString())
    expect(g.deletedAt).toBeNull()
    expect(displayName(g)).toBe('Blue linen shirt')
  })
  it('edits, wears and deletes with fresh timestamps', () => {
    const later = new Date('2026-09-28T09:00:00.000Z')
    expect(applyDraft(g, draft({ category: 'outerwear' }), later)).toMatchObject({ category: 'outerwear', updatedAt: later.toISOString(), id: g.id })
    expect(markWorn(g, later)).toMatchObject({ wornCount: 1, lastWornAt: later.toISOString() })
    expect(markDeleted(g, later).deletedAt).toBe(later.toISOString())
  })
  it('falls back to subtype, then category, for the display name', () => {
    expect(displayName({ ...g, name: '' })).toBe('Shirt')
    expect(displayName({ ...g, name: '', subtype: '' })).toBe('Top')
  })
})

describe('normalizeGarment', () => {
  const good = createGarment(draft({ subtype: 'Shirt', warmth: 2 }), null, NOW)

  it('keeps a valid record unchanged', () => {
    expect(normalizeGarment(JSON.parse(JSON.stringify(good)))).toEqual(good)
  })
  it('rejects records it cannot trust', () => {
    expect(normalizeGarment(null)).toBeNull()
    expect(normalizeGarment('hello')).toBeNull()
    expect(normalizeGarment({ ...good, id: 'x' })).toBeNull()
    expect(normalizeGarment({ ...good, category: 'spaceship' })).toBeNull()
    expect(normalizeGarment({ ...good, createdAt: 'yesterday' })).toBeNull()
  })
  it('repairs bad optional fields instead of failing', () => {
    const fixed = normalizeGarment({
      ...good,
      formality: 9,
      warmth: 'hot',
      seasons: ['summer', 'autumn', 42],
      colors: [{ hex: '#b5502d', share: 0.7 }, { hex: 'red', share: 0.3 }],
      wornCount: -3,
      extra: 'dropped',
    })
    expect(fixed).toMatchObject({ formality: 2, warmth: null, seasons: ['summer'], colors: [{ hex: '#B5502D', share: 0.7 }], wornCount: 0 })
    expect(fixed).not.toHaveProperty('extra')
  })
  it('fills defaults for fields added in later versions', () => {
    const { styleTags: _s, colors: _c, ...old } = good
    expect(normalizeGarment(old)).toMatchObject({ styleTags: [], colors: [] })
  })
})

describe('photos', () => {
  it('scales down but never up', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 })
    expect(fitWithin(3000, 4000, 480)).toEqual({ width: 360, height: 480 })
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 })
    expect(() => fitWithin(0, 100, 10)).toThrow()
  })
  it('rejects files that are not usable photos', () => {
    expect(() => checkFile({ type: 'application/pdf', size: 10, name: 'a.pdf' })).toThrow(PhotoError)
    expect(() => checkFile({ type: 'image/jpeg', size: 0, name: 'a.jpg' })).toThrow(PhotoError)
    expect(() => checkFile({ type: 'image/jpeg', size: 50 * 1024 * 1024, name: 'a.jpg' })).toThrow(PhotoError)
    expect(() => checkFile({ type: '', size: 10, name: 'IMG_0001.HEIC' })).not.toThrow()
  })
})
