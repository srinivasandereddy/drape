import { describe, expect, it } from 'vitest'
import { createGarment, emptyDraft, type Garment, type GarmentDraft } from './model'
import { explain, scoreOutfit, suggestOutfits, type OutfitContext } from './outfit'
import { bodyShapesFor, seasonFor, undertoneFrom, type PersonalPrefs } from './personal'
import { EMPTY_PROFILE, normalizeProfile, personalPrefs } from './profile'

let seq = 0
const NOW = new Date('2026-09-27T09:00:00Z')
function g(patch: Partial<GarmentDraft> & { hex?: string; status?: Garment['status'] }): Garment {
  const { hex, status, ...draft } = patch
  const base = createGarment({ ...emptyDraft(), category: 'top', ...draft }, null, new Date(NOW.getTime() - 1e6 + seq++))
  return { ...base, colors: hex ? [{ hex, share: 1 }] : base.colors, status: status ?? 'available' }
}
const ctx = (personal: PersonalPrefs | null = null, patch: Partial<OutfitContext> = {}): OutfitContext => ({ occasion: 'casual', routine: null, weather: null, now: NOW, personal, ...patch })
const P = (patch: Partial<PersonalPrefs>): PersonalPrefs => ({ season: null, favoriteColors: [], avoidColors: [], lovePatterns: [], avoidPatterns: [], bodyShape: null, ...patch })

describe('color season', () => {
  it('reads undertone from three questions', () => {
    expect(undertoneFrom('green', 'gold', 'tan')).toBe('warm')
    expect(undertoneFrom('blue', 'silver', 'burn')).toBe('cool')
    expect(undertoneFrom('both', 'gold', 'burn')).toBe('neutral')
  })
  it('places typical colorings in the classic seasons', () => {
    expect(seasonFor('medium', 'warm', 'black', 'dark-brown')).toBe('autumn')
    expect(seasonFor('fair', 'warm', 'blonde', 'blue')).toBe('spring')
    expect(seasonFor('fair', 'cool', 'black', 'dark-brown')).toBe('winter')
    expect(seasonFor('light', 'cool', 'brown', 'grey')).toBe('summer')
    expect(seasonFor('deep', 'cool', 'black', 'dark-brown')).toBe('winter')
    expect(seasonFor(null, 'warm', null, null)).toBeNull()
  })
  it('offers body shapes for each gender', () => {
    expect(bodyShapesFor('male').map((s) => s.id)).toContain('trapezoid')
    expect(bodyShapesFor('female').map((s) => s.id)).toContain('pear')
    expect(bodyShapesFor(null).length).toBeGreaterThan(5)
  })
  it('stores and repairs the new profile fields', () => {
    const p = normalizeProfile({ skinTone: 'tan', undertone: 'warm', hair: 'black', favoriteColors: ['Navy', 'Nope'], avoidPatterns: ['floral', 'x'], budget: 1500, currency: 'USD', sizes: { top: 'M', bottom: '32', shoe: '9' }, reminder: { enabled: true, hour: 30 } })
    expect(p).toMatchObject({ skinTone: 'tan', favoriteColors: ['Navy'], avoidPatterns: ['floral'], budget: 1500, currency: 'USD', sizes: { top: 'M', bottom: '32', shoe: '9' }, reminder: { enabled: true, hour: 7 } })
    expect(personalPrefs(p).season).toBe('autumn')
    expect(normalizeProfile(null)).toEqual(EMPTY_PROFILE)
  })
})

describe('made for you', () => {
  const rust = g({ subtype: 'T-shirt', hex: '#B5502D', formality: 2 })
  const lavender = g({ subtype: 'T-shirt', hex: '#B8A6DA', formality: 2 })
  const jeans = g({ category: 'bottom', subtype: 'Jeans', hex: '#3E5C82', formality: 2 })
  const sneakers = g({ category: 'footwear', subtype: 'Sneakers', hex: '#F4F4F1', formality: 2 })

  it('favours the colors of your season', () => {
    const autumn = P({ season: 'autumn' })
    expect(scoreOutfit([rust, jeans, sneakers], ctx(autumn)).score).toBeGreaterThan(scoreOutfit([lavender, jeans, sneakers], ctx(autumn)).score)
    const lines = explain(scoreOutfit([rust, jeans, sneakers], ctx(autumn)), ctx(autumn))
    expect(lines.join(' ')).toMatch(/Rust flatters your Autumn coloring/)
  })
  it('steers away from colors and patterns you dislike', () => {
    const floral = g({ subtype: 'Blouse', hex: '#EBA3B6', pattern: 'floral', formality: 2 })
    const [best] = suggestOutfits([rust, floral, jeans, sneakers], ctx(P({ avoidColors: ['Rust'], avoidPatterns: [] })))
    expect(best!.pieces).not.toContain(rust)
    const [best2] = suggestOutfits([rust, floral, jeans, sneakers], ctx(P({ avoidPatterns: ['floral'] })))
    expect(best2!.pieces).not.toContain(floral)
  })
  it('balances body shape: lighter bottoms for inverted triangles', () => {
    const black = g({ subtype: 'T-shirt', hex: '#1B1B1D', formality: 2 })
    const white = g({ subtype: 'T-shirt', hex: '#F4F4F1', formality: 2 })
    const beige = g({ category: 'bottom', subtype: 'Chinos', hex: '#D8C4A2', formality: 2 })
    const navy = g({ category: 'bottom', subtype: 'Chinos', hex: '#1F2A44', formality: 2 })
    const inv = ctx(P({ bodyShape: 'inverted-triangle' }))
    expect(scoreOutfit([black, beige, sneakers], inv).parts.you!).toBeGreaterThan(scoreOutfit([white, navy, sneakers], inv).parts.you!)
  })
  it('leaves pieces in the wash, lent out, donated or on the wishlist out of suggestions', () => {
    const washing = g({ subtype: 'T-shirt', hex: '#1F2A44', status: 'laundry' })
    const wish = g({ subtype: 'T-shirt', hex: '#1F2A44', status: 'wishlist' })
    for (const o of suggestOutfits([washing, wish, rust, jeans, sneakers], ctx())) {
      expect(o.pieces).not.toContain(washing)
      expect(o.pieces).not.toContain(wish)
    }
  })
  it('adds nothing when no personal details are set', () => {
    expect(scoreOutfit([rust, jeans, sneakers], ctx(P({}))).parts.you).toBeNull()
  })
})
