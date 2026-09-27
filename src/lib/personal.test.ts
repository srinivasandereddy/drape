import { describe, expect, it } from 'vitest'
import { colorName } from './color'
import { DOSHA_QUESTIONS, scoreDosha, type DoshaId } from './dosha'
import { affinityPoints, applyDislike, learnAffinity, NO_ADJUST, type FeedbackRecord } from './feedback'
import { parseIntent } from './intent'
import { createGarment, emptyDraft, normalizeGarment, type Garment, type GarmentDraft } from './model'
import { explain, scoreOutfit, slotOf, suggestOutfits, type OutfitContext } from './outfit'
import { parseItem, parseList } from './parser'
import { EMPTY_PROFILE, normalizeProfile } from './profile'
import { sampleSections } from './sample'
import { parseStyles, stylesFor } from './styles'
import { thermalIndex } from './thermal'
import type { Weather } from './weather'

let seq = 0
const NOW = new Date('2026-09-27T09:00:00Z')
function g(patch: Partial<GarmentDraft> & { hex?: string }): Garment {
  const { hex, ...draft } = patch
  const base = createGarment({ ...emptyDraft(), category: 'top', ...draft }, null, new Date(NOW.getTime() - 1e6 + seq++))
  return { ...base, colors: hex ? [{ hex, share: 1 }] : base.colors }
}
const weather = (feelsLike: number, extra: Partial<Weather> = {}): Weather => ({
  temp: feelsLike,
  feelsLike,
  humidity: 50,
  precipitation: 0,
  windKmh: 5,
  code: 1,
  todayMax: feelsLike + 2,
  todayMin: feelsLike - 6,
  rainChance: 0,
  uvMax: 5,
  fetchedAt: NOW.toISOString(),
  ...extra,
})
const ctx = (patch: Partial<OutfitContext> = {}): OutfitContext => ({ occasion: 'casual', routine: null, weather: weather(24), now: NOW, ...patch })

// ---------- Maanya's typed inventory (test case 1) ----------

describe('parser: typed wardrobe lists', () => {
  const cases: [string, string, string, string | null][] = [
    // text, category, subtype, color name
    ['White Nike Air Force', 'footwear', 'Sneakers', 'White'],
    ['Black leather loafers', 'footwear', 'Loafers', 'Black'],
    ['Strappy sandals', 'footwear', 'Sandals', null],
    ['Leather crossbody bag', 'bag', 'Sling bag', null],
    ['Prada sunglasses', 'accessory', 'Sunglasses', null],
    ['Sony WH-1000XM4 headphones', 'accessory', 'Headphones', null],
    ['Black dress shoes', 'footwear', 'Formal shoes', 'Black'],
    ['Black midi skirt', 'bottom', 'Skirt', 'Black'],
    ['Maroon nehru jacket', 'ethnic', 'Nehru jacket', 'Maroon'],
    ['Blue jeans', 'bottom', 'Jeans', 'Denim'],
    ['Floral sundress', 'dress', 'Casual dress', null],
  ]
  for (const [text, category, subtype, color] of cases) {
    it(`reads "${text}"`, () => {
      const { draft, recognised } = parseItem(text)
      expect(recognised).toBe(true)
      expect(draft.category).toBe(category)
      expect(draft.subtype).toBe(subtype)
      if (color) expect(colorName(draft.colors[0]!.hex)).toBe(color)
    })
  }
  it('reads jewellery metals, not colors', () => {
    const [hoops, pearl, watch] = parseList('Gold hoop earrings, Pearl necklace, Vintage watch', 'jewellery')
    expect(hoops!.draft).toMatchObject({ category: 'jewellery', subtype: 'Earrings', metal: 'gold', colors: [] })
    expect(pearl!.draft).toMatchObject({ subtype: 'Necklace', metal: 'other' })
    expect(watch!.draft.subtype).toBe('Watch')
  })
  it('splits lines, commas and bullets, and uses the section when unsure', () => {
    const items = parseList('- Linen thing\n• Cable-knit something, 2) Striped tee', 'top')
    expect(items).toHaveLength(3)
    expect(items[0]!.draft).toMatchObject({ category: 'top', fabric: 'linen', warmth: 1 })
    expect(items[1]!.draft).toMatchObject({ fabric: 'knit', warmth: 3 })
    expect(items[2]!.draft).toMatchObject({ subtype: 'T-shirt', pattern: 'striped' })
  })
  it('flags items it cannot place', () => {
    expect(parseItem('Grandma’s lucky thing').recognised).toBe(false)
  })
  it('recognises every sample wardrobe item', () => {
    for (const gender of ['female', 'male', 'other', null] as const) {
      for (const sec of sampleSections(gender)) {
        for (const item of parseList(sec.items, sec.hint)) {
          expect(item.recognised, item.text).toBe(true)
          expect(item.draft.subtype, item.text).not.toBe('')
        }
      }
    }
  })
})

// ---------- free text: occasion and vibe ----------

describe('intent and vibe', () => {
  it('understands occasions from both prompts', () => {
    expect(parseIntent('Dinner date in Paris')).toMatchObject({ occasion: 'evening', place: 'Paris' })
    expect(parseIntent('Office presentation')).toMatchObject({ occasion: 'work', formalityShift: 1 })
    expect(parseIntent('Gym session')).toMatchObject({ occasion: 'active', preferShoes: ['Running shoes', 'Sneakers'] })
    expect(parseIntent('morning run').occasion).toBe('active')
    expect(parseIntent('cousin’s wedding in jaipur')).toMatchObject({ occasion: 'festive', place: 'Jaipur' })
    expect(parseIntent('unexpected evening party tonight').occasion).toBe('evening')
    expect(parseIntent('coffee in the evening').place).toBeNull()
    expect(parseIntent('something nice').occasion).toBeNull()
  })
  it('reads style words', () => {
    expect(parseStyles('90s Grunge')).toEqual(['grunge'])
    expect(parseStyles('Old Money')).toEqual(['old-money'])
    expect(parseStyles('Coquette')).toEqual(['coquette'])
    expect(parseStyles('Y2K Streetwear')).toContain('streetwear')
    expect(parseStyles('dark academia but comfy')).toEqual(['dark-academia'])
  })
})

// ---------- dosha and thermal index ----------

describe('dosha quiz', () => {
  it('has exactly 10 questions with 3 options each', () => {
    expect(DOSHA_QUESTIONS).toHaveLength(10)
    for (const q of DOSHA_QUESTIONS) expect(q.options).toHaveLength(3)
  })
  it('finds the primary and a close second', () => {
    const answers: DoshaId[] = ['pitta', 'pitta', 'pitta', 'pitta', 'vata', 'vata', 'vata', 'kapha', 'pitta', 'vata']
    const r = scoreDosha(answers)
    expect(r.scores).toEqual({ vata: 4, pitta: 5, kapha: 1 })
    expect(r.primary).toBe('pitta')
    expect(r.secondary).toBe('vata')
  })
  it('refuses a half-finished quiz', () => {
    expect(() => scoreDosha(['vata'])).toThrow()
  })
})

describe('thermal index', () => {
  it('combines weather, dosha and feeling', () => {
    expect(thermalIndex({ feelsLike: 33, rainy: false, dosha: null, feeling: null }).index).toBe(1)
    expect(thermalIndex({ feelsLike: 19, rainy: false, dosha: null, feeling: null }).index).toBe(3)
    expect(thermalIndex({ feelsLike: 19, rainy: false, dosha: 'vata', feeling: 'cold' }).index).toBe(5)
    expect(thermalIndex({ feelsLike: 19, rainy: false, dosha: 'pitta', feeling: 'warm' }).index).toBe(2)
    expect(thermalIndex({ feelsLike: null, rainy: false, dosha: null, feeling: null }).index).toBe(3)
    expect(thermalIndex({ feelsLike: 19, rainy: false, dosha: null, feeling: 'cold' }).needsLayer).toBe(true)
  })
})

// ---------- personal preferences in the engine ----------

describe('personal engine', () => {
  const tee = g({ subtype: 'T-shirt', hex: '#F4F4F1', formality: 2, warmth: 1, fabric: 'cotton' })
  const crop = g({ subtype: 'Crop top', hex: '#EBA3B6', formality: 2, warmth: 1 })
  const jeans = g({ category: 'bottom', subtype: 'Jeans', hex: '#3E5C82', formality: 2, warmth: 2 })
  const shorts = g({ category: 'bottom', subtype: 'Shorts', hex: '#D8C4A2', formality: 2, warmth: 1 })
  const sneakers = g({ category: 'footwear', subtype: 'Sneakers', hex: '#F4F4F1', formality: 2 })
  const heels = g({ category: 'footwear', subtype: 'Heels', hex: '#1B1B1D', formality: 4 })
  const cardigan = g({ category: 'outerwear', subtype: 'Cardigan', hex: '#EFE6D0', formality: 3, warmth: 3, fabric: 'knit' })
  const goldRing = g({ category: 'jewellery', subtype: 'Ring', metal: 'gold', formality: 3 })
  const silverWatch = g({ category: 'jewellery', subtype: 'Watch', metal: 'silver', formality: 3 })
  const closet = [tee, crop, jeans, shorts, sneakers, heels, cardigan, goldRing, silverWatch]

  it('sticks to the preferred metal', () => {
    for (const o of suggestOutfits(closet, ctx({ metal: 'gold', occasion: 'evening' }))) {
      expect(o.pieces).not.toContain(silverWatch)
    }
  })
  it('adds a layer when the person feels cold, even on a mild day', () => {
    const [cold] = suggestOutfits(closet, ctx({ weather: weather(20), feeling: 'cold', dosha: 'vata' }))
    expect(cold!.thermal.index).toBeGreaterThanOrEqual(4)
    expect(cold!.pieces).toContain(cardigan)
    const [warm] = suggestOutfits(closet, ctx({ weather: weather(20), feeling: 'warm', dosha: 'pitta' }))
    expect(warm!.pieces).not.toContain(cardigan)
  })
  it('follows the vibe and wished-for colors', () => {
    const pinkTop = g({ subtype: 'Blouse', hex: '#EBA3B6', formality: 3, warmth: 1 })
    const [o] = suggestOutfits([tee, pinkTop, jeans, sneakers], ctx({ styles: ['coquette'], wishColors: ['Pink'] }))
    expect(o!.pieces).toContain(pinkTop)
    expect(explain(o!, ctx({ styles: ['coquette'], wishColors: ['Pink'] })).join(' ')).toMatch(/Coquette|pink/)
  })
  it('explains dosha and feeling', () => {
    const c = ctx({ dosha: 'pitta', feeling: 'warm', weather: weather(30) })
    const lines = explain(suggestOutfits(closet, c)[0]!, c)
    expect(lines[0]).toMatch(/Pitta runs warm/)
    expect(lines[0]).toMatch(/you feel warm today/)
  })
})

describe('feedback loop', () => {
  const top = g({ subtype: 'Shirt', hex: '#F4F4F1', formality: 3 })
  const top2 = g({ subtype: 'Polo', hex: '#1F2A44', formality: 3 })
  const bottom = g({ category: 'bottom', subtype: 'Chinos', hex: '#D8C4A2', formality: 3 })
  const heels = g({ category: 'footwear', subtype: 'Heels', hex: '#1B1B1D', formality: 4 })
  const flats = g({ category: 'footwear', subtype: 'Flats', hex: '#1B1B1D', formality: 3 })

  it('"No heels today" removes heels for the day', () => {
    const adjust = applyDislike(NO_ADJUST, 'no-heels', [top, bottom, heels])
    for (const o of suggestOutfits([top, bottom, heels, flats], ctx({ occasion: 'evening', adjust }))) expect(o.pieces).not.toContain(heels)
  })
  it('"Too formal" lowers the dress code; "Not my style" drops those pieces today', () => {
    expect(applyDislike(NO_ADJUST, 'too-formal', []).formalityShift).toBe(-1)
    const a = applyDislike(NO_ADJUST, 'wrong-style', [top, bottom, flats])
    expect(a.avoidIds).toEqual(expect.arrayContaining([top.id, bottom.id]))
    expect(a.avoidIds).not.toContain(flats.id)
  })
  it('"Too cold" raises the thermal index', () => {
    const adjust = applyDislike(NO_ADJUST, 'too-cold', [])
    const [o] = suggestOutfits([top, bottom, flats], ctx({ adjust }))
    const [base] = suggestOutfits([top, bottom, flats], ctx())
    expect(o!.thermal.index).toBe(base!.thermal.index + 1)
  })
  it('learns: loved pairings score higher next time', () => {
    const byId = new Map([top, top2, bottom, flats].map((x) => [x.id, x]))
    const love: FeedbackRecord = { id: 'f1', date: '2026-09-20', garmentIds: [top2.id, bottom.id, flats.id], verdict: 'love', reason: null, note: '', createdAt: NOW.toISOString() }
    const affinity = learnAffinity([love], byId)
    expect(affinityPoints([top2, bottom, flats], affinity).points).toBeGreaterThan(0)
    const before = scoreOutfit([top2, bottom, flats], ctx()).score
    const after = scoreOutfit([top2, bottom, flats], ctx({ affinity }))
    expect(after.score).toBeGreaterThan(before)
    expect(after.loved).toBe(true)
  })
})

describe('storage safety', () => {
  it('upgrades old garments with source and styles, and drops retired fields', () => {
    const old = { ...createGarment({ ...emptyDraft(), category: 'bottom', subtype: 'Shorts' }, { width: 10, height: 10 }, NOW) } as Record<string, unknown>
    old.coverage = 2 // retired field
    delete old.source
    delete old.fabric
    old.styleTags = ['old-money', 'not-a-style']
    const g2 = normalizeGarment(old)!
    expect(g2).toMatchObject({ source: 'photo', fabric: null, styleTags: ['old-money'] })
    expect(g2).not.toHaveProperty('coverage')
  })
  it('repairs a damaged profile', () => {
    expect(normalizeProfile(null)).toEqual(EMPTY_PROFILE)
    const p = normalizeProfile({ age: 500, modesty: 9, styles: ['goth', 'nope'], theme: 'neon', gender: { kind: 'other', custom: 'Genderfluid' }, dosha: { answers: ['vata'] } })
    expect(p).toMatchObject({ age: null, styles: ['goth'], theme: 'classic', gender: { kind: 'other', custom: 'Genderfluid' }, dosha: null })
    expect(p).not.toHaveProperty('modesty')
  })
})

describe('slots', () => {
  it('still places pieces', () => {
    expect(slotOf({ category: 'accessory', subtype: 'Headphones' })).toBe('accessory')
  })
})

describe('styles by gender and activities', () => {
  it('offers men’s and activity styles to men, without hiding anything they chose', () => {
    const male = stylesFor('male', 'fashion').map((s) => s.id)
    expect(male).not.toContain('coquette')
    expect(male).not.toContain('clean-girl')
    expect(male).toContain('gentleman')
    expect(male).toContain('smart-casual')
    expect(stylesFor('female', 'fashion').map((s) => s.id)).not.toContain('gentleman')
    expect(stylesFor(null, 'fashion').map((s) => s.id)).toContain('coquette')
    expect(stylesFor('male', 'activity').map((s) => s.id)).toEqual(['gym', 'running', 'yoga', 'sports', 'outdoors'])
  })
  it('reads activity words', () => {
    expect(parseStyles('gym')).toEqual(['gym'])
    expect(parseStyles('going for a run')).toEqual(['running'])
    expect(parseStyles('hiking trip')).toEqual(['outdoors'])
  })
  it('reads activewear in typed lists', () => {
    expect(parseItem('Nike running shoes').draft).toMatchObject({ category: 'footwear', subtype: 'Running shoes', fabric: 'synthetic' })
    expect(parseItem('Black dri-fit tee').draft).toMatchObject({ category: 'top', subtype: 'Sports tee' })
    expect(parseItem('Grey track jacket').draft).toMatchObject({ category: 'outerwear', subtype: 'Track jacket' })
  })
  it('dresses for a workout in sportswear and running shoes', () => {
    const shirt = g({ subtype: 'Shirt', hex: '#F4F4F1', formality: 3, warmth: 1 })
    const sportsTee = g({ subtype: 'Sports tee', hex: '#1B1B1D', formality: 1, warmth: 1, fabric: 'synthetic' })
    const chinos = g({ category: 'bottom', subtype: 'Chinos', hex: '#D8C4A2', formality: 3 })
    const joggers = g({ category: 'bottom', subtype: 'Joggers', hex: '#8A8D91', formality: 1, fabric: 'synthetic' })
    const loafers = g({ category: 'footwear', subtype: 'Loafers', hex: '#6B4A33', formality: 3 })
    const runners = g({ category: 'footwear', subtype: 'Running shoes', hex: '#F4F4F1', formality: 1 })
    const ring = g({ category: 'jewellery', subtype: 'Ring', metal: 'gold', formality: 3 })
    const oxford = g({ subtype: 'Shirt', hex: '#8DB9E2', formality: 3, warmth: 1 })
    const grayTee = g({ subtype: 'Sports tee', hex: '#8A8D91', formality: 1, warmth: 1, fabric: 'synthetic' })
    // Even with a nicer color match available (sky blue shirt + grey), the gym gets gym clothes.
    const [o2] = suggestOutfits([oxford, grayTee, joggers, runners], ctx({ occasion: 'active', styles: ['gym', 'running'] }))
    expect(o2!.pieces).toContain(grayTee)
    const [o] = suggestOutfits([shirt, sportsTee, chinos, joggers, loafers, runners, ring], ctx({ occasion: 'active', styles: ['gym'] }))
    expect(o!.pieces).toEqual(expect.arrayContaining([sportsTee, joggers, runners]))
    expect(o!.pieces).not.toContain(ring)
  })
})
