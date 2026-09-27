import { describe, expect, it } from 'vitest'
import { affinityPoints, learnAffinity } from './feedback'
import { createGarment, emptyDraft, type Garment, type GarmentDraft } from './model'
import { scoreOutfit, suggestOutfits, type OutfitContext } from './outfit'
import { pairingScore } from './styling'
import type { Weather } from './weather'

let seq = 0
function g(patch: Partial<GarmentDraft> & { hex?: string }): Garment {
  const { hex, ...draft } = patch
  const base = createGarment({ ...emptyDraft(), category: 'top', ...draft }, null, new Date(Date.parse('2026-09-01T08:00:00Z') + seq++))
  return { ...base, colors: hex ? [{ hex, share: 1 }] : [] }
}
const weather = (patch: Partial<Weather> = {}): Weather => ({
  temp: 26, feelsLike: 26, humidity: 60, precipitation: 0, windKmh: 8, code: 0, todayMax: 28, todayMin: 22, rainChance: 5, uvMax: 6, fetchedAt: '2026-09-27T08:00:00Z',
  ...patch,
})
const ctx = (patch: Partial<OutfitContext> = {}): OutfitContext => ({ occasion: 'casual', routine: 'business-casual', weather: weather(), now: new Date('2026-09-27T09:00:00Z'), ...patch })

const saree = g({ category: 'ethnic', subtype: 'Saree', hex: '#B8325A', formality: 4 })
const runners = g({ category: 'footwear', subtype: 'Running shoes', hex: '#F4F4F1', formality: 1 })
const heels = g({ category: 'footwear', subtype: 'Heels', hex: '#C9A227', formality: 3 })
const blazer = g({ category: 'outerwear', subtype: 'Blazer', hex: '#1B1B1D', formality: 4 })
const joggers = g({ category: 'bottom', subtype: 'Joggers', hex: '#4A4D52', formality: 1 })
const whiteShirt = g({ category: 'top', subtype: 'Shirt', hex: '#F4F4F1', formality: 3 })
const navyTrousers = g({ category: 'bottom', subtype: 'Trousers', hex: '#1F2A44', formality: 3 })
const loafers = g({ category: 'footwear', subtype: 'Loafers', hex: '#6B4A33', formality: 3 })
const floralTop = g({ category: 'top', subtype: 'Blouse', hex: '#E07A9A', pattern: 'floral', formality: 2 })
const checkedSkirt = g({ category: 'bottom', subtype: 'Skirt', hex: '#2F5DAA', pattern: 'checked', formality: 2 })
const whiteJeans = g({ category: 'bottom', subtype: 'Jeans', hex: '#F7F7F5', formality: 2 })
const blackTee = g({ category: 'top', subtype: 'T-shirt', hex: '#141414', formality: 2 })

describe('pieces that go together', () => {
  it('flags pieces that clash by kind', () => {
    expect(pairingScore([saree, runners], 'festive', null).clashes).toHaveLength(1)
    expect(pairingScore([whiteShirt, joggers, blazer, heels], 'work', null).clashes.length).toBeGreaterThanOrEqual(2)
    expect(pairingScore([whiteShirt, navyTrousers, loafers], 'work', null).clashes).toEqual([])
  })
  it('lets running shoes be running shoes at the gym', () => {
    expect(pairingScore([g({ subtype: 'Sports tee', formality: 1 }), joggers, runners], 'active', null).clashes).toEqual([])
  })
  it('wants the same level of dressiness from top to shoes', () => {
    const even = pairingScore([whiteShirt, navyTrousers, loafers], 'work', null)
    const mixed = pairingScore([g({ subtype: 'Sports tee', formality: 1 }), navyTrousers, g({ category: 'footwear', subtype: 'Formal shoes', formality: 4 })], 'work', null)
    expect(even.score).toBeGreaterThan(mixed.score)
  })
  it('discourages two competing prints', () => {
    const two = pairingScore([floralTop, checkedSkirt], 'casual', null)
    const one = pairingScore([floralTop, g({ category: 'bottom', subtype: 'Skirt', hex: '#1F2A44', formality: 2 })], 'casual', null)
    expect(one.score).toBeGreaterThan(two.score)
    expect(two.notes.join(' ')).toMatch(/prints/)
  })
  it('thinks about heat and rain when choosing colors', () => {
    const hot = weather({ feelsLike: 36 })
    const rain = weather({ code: 63, rainChance: 90, precipitation: 3 })
    expect(pairingScore([blackTee, navyTrousers], 'casual', hot).score).toBeLessThan(pairingScore([whiteShirt, navyTrousers], 'casual', hot).score)
    expect(pairingScore([blackTee, whiteJeans], 'casual', rain).notes.join(' ')).toMatch(/splashes/)
  })
  it('never ranks a clashing outfit first', () => {
    const closet = [saree, runners, heels]
    const [best] = suggestOutfits(closet, ctx({ occasion: 'festive' }))
    expect(best!.pieces).toContain(heels)
    const clash = scoreOutfit([saree, runners], ctx({ occasion: 'festive' }))
    expect(clash.breakdown.find((b) => b.label === 'Goes together')!.about).toMatch(/Running shoes/)
  })
})

describe('learning from what you wore', () => {
  const byId = new Map([whiteShirt, navyTrousers, blackTee].map((x) => [x.id, x]))
  it('treats pairings you wear as ones you like, but not two weeks running', () => {
    const now = new Date('2026-09-27T09:00:00')
    const old = learnAffinity([], byId, [{ date: '2026-09-01', garmentIds: [whiteShirt.id, navyTrousers.id] }])
    const recent = learnAffinity([], byId, [{ date: '2026-09-25', garmentIds: [whiteShirt.id, navyTrousers.id] }])
    expect(affinityPoints([whiteShirt, navyTrousers], old, now).points).toBeGreaterThan(0)
    expect(affinityPoints([whiteShirt, navyTrousers], recent, now).points).toBeLessThan(0)
    expect(affinityPoints([blackTee, navyTrousers], recent, now).points).toBe(0)
  })
  it('ignores plans that were never worn', () => {
    const planned = learnAffinity([], byId, [{ date: '2026-09-25', garmentIds: [whiteShirt.id, navyTrousers.id], planned: true }])
    expect(affinityPoints([whiteShirt, navyTrousers], planned, new Date('2026-09-27T09:00:00')).points).toBe(0)
  })
})
