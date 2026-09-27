import { describe, expect, it } from 'vitest'
import { colorName, extractColors, hexToLab, hexToRgb, hueDistance, hueOf, isNeutral, labToRgb, rgbToHex, temperature } from './color'
import { harmonyOf } from './harmony'
import { createGarment, emptyDraft, type Garment, type GarmentDraft } from './model'
import { alternatives, explain, missingForOutfits, scoreOutfit, slotOf, suggestOutfits, type OutfitContext } from './outfit'
import { bucketOf, matchesFor, NEUTRAL_BUCKET, spectrumStats } from './spectrum'
import { describeCode, idealWarmth, isRainy, parseForecast, seasonFromWeather, type Weather } from './weather'

// ---------- helpers ----------

let seq = 0
function g(patch: Partial<GarmentDraft> & { hex?: string; wornDaysAgo?: number }): Garment {
  const { hex, wornDaysAgo, ...draft } = patch
  const now = new Date('2026-09-27T08:00:00Z')
  const base = createGarment({ ...emptyDraft(), category: 'top', ...draft }, null, new Date(now.getTime() + seq++))
  return {
    ...base,
    colors: hex ? [{ hex, share: 1 }] : [],
    lastWornAt: wornDaysAgo === undefined ? null : new Date(now.getTime() - wornDaysAgo * 86_400_000).toISOString(),
  }
}

const weather = (patch: Partial<Weather> = {}): Weather => ({
  temp: 30,
  feelsLike: 32,
  humidity: 60,
  precipitation: 0,
  windKmh: 8,
  code: 0,
  todayMax: 33,
  todayMin: 26,
  rainChance: 5,
  uvMax: 8,
  fetchedAt: '2026-09-27T08:00:00Z',
  ...patch,
})

const ctx = (patch: Partial<OutfitContext> = {}): OutfitContext => ({
  occasion: 'casual',
  routine: 'business-casual',
  weather: weather(),
  now: new Date('2026-09-27T09:00:00Z'),
  ...patch,
})

/** Builds an RGBA image: `bg` everywhere, `fg` in the central rectangle. */
function image(w: number, h: number, bg: string, fg: string, inset = 0.25): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4)
  const [br, bgc, bb] = hexToRgb(bg)
  const [fr, fgc, fb] = hexToRgb(fg)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const inside = x >= w * inset && x < w * (1 - inset) && y >= h * inset && y < h * (1 - inset)
      data.set(inside ? [fr, fgc, fb, 255] : [br, bgc, bb, 255], (y * w + x) * 4)
    }
  return data
}

// ---------- color ----------

describe('color basics', () => {
  it('round-trips hex through Lab', () => {
    for (const hex of ['#B5502D', '#1F2A44', '#F4F4F1', '#000000']) {
      expect(rgbToHex(labToRgb(hexToLab(hex)))).toBe(hex)
    }
  })
  it('names common garment colors', () => {
    expect(colorName('#1E293F')).toBe('Navy')
    expect(colorName('#B4532F')).toBe('Rust')
    expect(colorName('#FFFFFF')).toBe('White')
    expect(colorName('#6C7141')).toBe('Olive')
  })
  it('treats navy, beige, black and grey as neutral but not rust or green', () => {
    expect(isNeutral('#1F2A44')).toBe(true)
    expect(isNeutral('#D8C4A2')).toBe(true)
    expect(isNeutral('#8A8D91')).toBe(true)
    expect(isNeutral('#B5502D')).toBe(false)
    expect(isNeutral('#3A8A4E')).toBe(false)
  })
  it('knows warm from cool and measures hue distance', () => {
    expect(temperature('#B5502D')).toBe('warm')
    expect(temperature('#2F5DAA')).toBe('cool')
    expect(temperature('#1B1B1D')).toBeNull()
    expect(hueDistance(350, 10)).toBe(20)
    expect(Math.round(hueOf('#FF0000'))).toBe(0)
    expect(Math.round(hueOf('#0000FF'))).toBe(240)
  })
})

describe('extractColors', () => {
  it('ignores a plain background and finds the garment color', () => {
    const colors = extractColors(image(60, 80, '#F2F2EE', '#B5502D'), 60, 80)
    expect(colors[0] && colorName(colors[0].hex)).toBe('Rust')
    expect(colors.every((c) => colorName(c.hex) !== 'White')).toBe(true)
  })
  it('handles a garment that fills the whole photo', () => {
    const colors = extractColors(image(40, 40, '#1F2A44', '#1F2A44'), 40, 40)
    expect(colors).toHaveLength(1)
    expect(colorName(colors[0]!.hex)).toBe('Navy')
  })
  it('finds two colors in a two-tone garment', () => {
    // Left half of the garment green, right half yellow, on a white wall.
    const w = 80
    const h = 80
    const data = image(w, h, '#F4F4F1', '#3A8A4E', 0.15)
    for (let y = Math.ceil(h * 0.15); y < h * 0.85; y++)
      for (let x = w / 2; x < w * 0.85; x++) data.set([235, 201, 67, 255], (y * w + x) * 4)
    const names = extractColors(data, w, h).map((c) => colorName(c.hex))
    expect(names).toContain('Green')
    expect(names).toContain('Yellow')
  })
  it('merges a color with its own shadow', () => {
    const w = 60
    const h = 60
    const data = image(w, h, '#F4F4F1', '#2F5DAA', 0.1)
    for (let y = Math.ceil(h * 0.5); y < h * 0.9; y++) for (let x = Math.ceil(w * 0.1); x < w * 0.9; x++) data.set([36, 72, 132, 255], (y * w + x) * 4)
    expect(extractColors(data, w, h)).toHaveLength(1)
  })
  it('returns nothing for an empty image', () => {
    expect(extractColors(new Uint8ClampedArray(0), 0, 0)).toEqual([])
  })
})

// ---------- harmony ----------

describe('harmonyOf', () => {
  it('scores classic combinations', () => {
    expect(harmonyOf(['#1B1B1D', '#F4F4F1']).kind).toBe('neutral')
    expect(harmonyOf(['#B5502D', '#1F2A44', '#F4F4F1']).kind).toBe('single')
    expect(harmonyOf(['#2F5DAA', '#1E7B7A']).kind).toBe('analogous')
    expect(harmonyOf(['#2F5DAA', '#E07A2E']).kind).toBe('complementary')
    expect(harmonyOf(['#C0342B', '#3A8A4E', '#EBC943', '#6D3B8E']).kind).toBe('clash')
  })
  it('ranks one color with neutrals above a clash', () => {
    expect(harmonyOf(['#B5502D', '#1F2A44']).score).toBeGreaterThan(harmonyOf(['#C0342B', '#EBC943', '#6D3B8E']).score)
  })
  it('penalises two patterns at once', () => {
    expect(harmonyOf(['#1F2A44', '#F4F4F1'], 2).score).toBeLessThan(harmonyOf(['#1F2A44', '#F4F4F1'], 0).score)
  })
})

// ---------- weather ----------

describe('weather', () => {
  it('parses an Open-Meteo reply', () => {
    const w = parseForecast({
      current: { temperature_2m: 29.4, apparent_temperature: 33.1, relative_humidity_2m: 70, precipitation: 0, weather_code: 2, wind_speed_10m: 11 },
      daily: { temperature_2m_max: [32], temperature_2m_min: [24], precipitation_probability_max: [40], uv_index_max: [7.5] },
    })
    expect(w).toMatchObject({ temp: 29.4, feelsLike: 33.1, rainChance: 40, uvMax: 7.5, todayMin: 24 })
  })
  it('rejects a broken reply', () => {
    expect(() => parseForecast({ error: true })).toThrow()
  })
  it('describes conditions in plain words', () => {
    expect(describeCode(0)).toBe('Clear')
    expect(describeCode(63)).toBe('Rain')
    expect(isRainy(weather({ rainChance: 70 }))).toBe(true)
    expect(idealWarmth(34)).toBe(1)
    expect(idealWarmth(5)).toBe(3)
    expect(seasonFromWeather(weather({ feelsLike: 12 }))).toBe('winter')
  })
})

// ---------- outfits ----------

describe('slotOf', () => {
  it('places ethnic wear correctly', () => {
    expect(slotOf({ category: 'ethnic', subtype: 'Kurta' })).toBe('top')
    expect(slotOf({ category: 'ethnic', subtype: 'Saree' })).toBe('onepiece')
    expect(slotOf({ category: 'ethnic', subtype: 'Nehru jacket' })).toBe('layer')
    expect(slotOf({ category: 'ethnic', subtype: '' })).toBe('onepiece')
  })
})

describe('suggestOutfits', () => {
  const rustTee = g({ category: 'top', subtype: 'T-shirt', hex: '#B5502D', warmth: 1, formality: 2 })
  const greenTee = g({ category: 'top', subtype: 'T-shirt', hex: '#3A8A4E', warmth: 1, formality: 2 })
  const whiteShirt = g({ category: 'top', subtype: 'Shirt', hex: '#F4F4F1', warmth: 1, formality: 3 })
  const navyJeans = g({ category: 'bottom', subtype: 'Jeans', hex: '#1F2A44', warmth: 2, formality: 2 })
  const redSkirt = g({ category: 'bottom', subtype: 'Skirt', hex: '#C0342B', warmth: 1, formality: 2 })
  const whiteSneakers = g({ category: 'footwear', subtype: 'Sneakers', hex: '#F4F4F1', formality: 2 })
  const sandals = g({ category: 'footwear', subtype: 'Sandals', hex: '#6B4A33', formality: 2 })
  const blazer = g({ category: 'outerwear', subtype: 'Blazer', hex: '#1B1B1D', warmth: 2, formality: 4 })
  const watch = g({ category: 'jewellery', subtype: 'Watch', metal: 'silver', formality: 3 })
  const goldRing = g({ category: 'jewellery', subtype: 'Ring', metal: 'gold', formality: 3 })
  const closet = [rustTee, greenTee, whiteShirt, navyJeans, redSkirt, whiteSneakers, sandals, blazer, watch, goldRing]

  it('needs a top and a bottom, or a one-piece', () => {
    expect(missingForOutfits([rustTee])).toEqual(['a bottom'])
    expect(missingForOutfits([g({ category: 'dress', hex: '#C0342B' })])).toEqual([])
    expect(suggestOutfits([rustTee], ctx())).toEqual([])
  })

  it('always builds complete outfits with shoes', () => {
    const outfits = suggestOutfits(closet, ctx())
    expect(outfits.length).toBeGreaterThan(0)
    for (const o of outfits) {
      const slots = o.pieces.map(slotOf)
      expect(slots).toContain('footwear')
      expect(slots.includes('onepiece') || (slots.includes('top') && slots.includes('bottom'))).toBe(true)
      expect(o.score).toBeGreaterThanOrEqual(0)
      expect(o.score).toBeLessThanOrEqual(100)
    }
  })

  it('prefers harmony: green top with red skirt is not the top pick', () => {
    const [best] = suggestOutfits(closet, ctx())
    const ids = best!.pieces.map((p) => p.id)
    expect(ids.includes(greenTee.id) && ids.includes(redSkirt.id)).toBe(false)
  })

  it('keeps ideas varied', () => {
    const outfits = suggestOutfits(closet, ctx())
    const keys = outfits.map((o) => o.pieces.filter((p) => ['top', 'bottom'].includes(slotOf(p))).map((p) => p.id).join('+'))
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('skips open shoes in the rain', () => {
    const rain = ctx({ weather: weather({ code: 63, rainChance: 90, precipitation: 2, feelsLike: 26 }) })
    for (const o of suggestOutfits(closet, rain)) expect(o.pieces).not.toContain(sandals)
  })

  it('adds a layer when it is cold, and not when it is hot', () => {
    const cold = suggestOutfits(closet, ctx({ weather: weather({ feelsLike: 9, todayMin: 5 }) }))[0]!
    expect(cold.pieces.map(slotOf)).toContain('layer')
    const hot = suggestOutfits(closet, ctx({ occasion: 'casual' }))[0]!
    expect(hot.pieces.map(slotOf)).not.toContain('layer')
  })

  it('dresses up for a corporate office', () => {
    const [best] = suggestOutfits(closet, ctx({ occasion: 'work', routine: 'corporate', weather: weather({ feelsLike: 24 }) }))
    expect(best!.pieces).toContain(whiteShirt)
    expect(best!.pieces).toContain(blazer)
    expect(best!.pieces).toContain(watch)
  })

  it('never mixes jewellery metals', () => {
    for (const o of suggestOutfits(closet, ctx({ occasion: 'festive' }))) {
      const metals = new Set(o.pieces.filter((p) => p.metal).map((p) => p.metal))
      expect(metals.size).toBeLessThanOrEqual(1)
    }
  })

  it('rests pieces worn yesterday', () => {
    const worn = { ...rustTee, lastWornAt: new Date('2026-09-26T20:00:00Z').toISOString() }
    const a = scoreOutfit([rustTee, navyJeans, whiteSneakers], ctx())
    const b = scoreOutfit([worn, navyJeans, whiteSneakers], ctx())
    expect(b.score).toBeLessThan(a.score)
  })

  it('offers swaps for one piece and explains itself', () => {
    const [best] = suggestOutfits(closet, ctx())
    const shoes = best!.pieces.find((p) => slotOf(p) === 'footwear')!
    const alts = alternatives(best!, shoes, closet, ctx())
    expect(alts.length).toBeGreaterThan(0)
    for (const a of alts) expect(a.pieces).not.toContain(shoes)
    const lines = explain(best!, ctx())
    expect(lines[0]).toMatch(/Feels like 32°C/)
    expect(lines.length).toBeGreaterThanOrEqual(3)
  })

  it('works without weather and without colors', () => {
    const plain = [g({ category: 'top' }), g({ category: 'bottom' })]
    const [o] = suggestOutfits(plain, ctx({ weather: null }))
    expect(o!.score).toBeGreaterThan(0)
    expect(explain(o!, ctx({ weather: null })).length).toBeGreaterThan(0)
  })
})

// ---------- spectrum and scale ----------


describe('spectrum', () => {
  const pieces = [
    g({ category: 'top', hex: '#B5502D' }),
    g({ category: 'top', hex: '#1F2A44' }),
    g({ category: 'bottom', hex: '#1F2A44' }),
    g({ category: 'bottom', hex: '#D8C4A2' }),
    g({ category: 'footwear', hex: '#F4F4F1' }),
    g({ category: 'top' }),
  ]
  it('buckets colors and counts neutrals', () => {
    expect(bucketOf('#1F2A44')).toBe(NEUTRAL_BUCKET)
    expect(bucketOf('#B5502D')).toBe(1)
    const s = spectrumStats(pieces)
    expect(s.total).toBe(6)
    expect(s.withColors).toBe(5)
    expect(s.neutralShare).toBeCloseTo(0.8)
    expect(s.strip[0]!.hex).toBe('#B5502D') // colors first, neutrals after
    expect(s.insights.some((i) => i.includes('no colors yet'))).toBe(true)
  })
  it('finds matching partners for a piece', () => {
    const [rust, , navyJeans, beige] = pieces
    const ids = matchesFor(rust!, pieces).map((m) => m.garment.id)
    expect(ids).toContain(navyJeans!.id)
    expect(ids).toContain(beige!.id)
    expect(ids).not.toContain(pieces[1]!.id) // another top is not a partner for a top
  })
})

describe('scale', () => {
  it('handles a large closet quickly', () => {
    const hexes = ['#B5502D', '#1F2A44', '#F4F4F1', '#3A8A4E', '#2F5DAA', '#D8C4A2', '#1B1B1D', '#C0342B']
    const big = [
      ...Array.from({ length: 40 }, (_, i) => g({ category: 'top', hex: hexes[i % 8], formality: ((i % 4) + 1) as 1 | 2 | 3 | 4 })),
      ...Array.from({ length: 40 }, (_, i) => g({ category: 'bottom', hex: hexes[(i + 3) % 8] })),
      ...Array.from({ length: 12 }, (_, i) => g({ category: 'footwear', subtype: 'Sneakers', hex: hexes[(i + 5) % 8] })),
    ]
    const t0 = performance.now()
    const outfits = suggestOutfits(big, ctx())
    const ms = performance.now() - t0
    expect(outfits.length).toBe(12)
    expect(ms).toBeLessThan(1500)
  })
})

describe('dress code', () => {
  it('prefers a shirt over a t-shirt for a business-casual office', () => {
    const tee = g({ category: 'top', subtype: 'T-shirt', hex: '#B5502D', warmth: 1, formality: 2 })
    const shirt = g({ category: 'top', subtype: 'Shirt', hex: '#F4F4F1', warmth: 1, formality: 3 })
    const chinos = g({ category: 'bottom', subtype: 'Chinos', hex: '#D8C4A2', warmth: 1, formality: 3 })
    const loafers = g({ category: 'footwear', subtype: 'Loafers', hex: '#6B4A33', formality: 3 })
    const [best] = suggestOutfits([tee, shirt, chinos, loafers], ctx({ occasion: 'work', routine: 'business-casual' }))
    expect(best!.pieces).toContain(shirt)
    // …but on a casual day the rust tee is a fine pick.
    const [casual] = suggestOutfits([tee, shirt, chinos, loafers], ctx({ occasion: 'casual' }))
    expect(casual!.pieces).toContain(tee)
  })
})
