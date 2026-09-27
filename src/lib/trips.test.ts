import { describe, expect, it } from 'vitest'
import { respond, findPiece, type AssistantData } from './assistant'
import { createGarment, emptyDraft, type Garment, type GarmentDraft } from './model'
import { dayOccasions, planTrip } from './packing'
import { EMPTY_PROFILE } from './profile'
import { slotOf } from './slots'
import { addDays, createTrip, datesFromText, tripDates, validateTrip } from './trip'
import { bestCityMatch, parseDaily, type City, type DayWeather, type Weather } from './weather'

let seq = 0
const NOW = new Date(2026, 8, 27, 10) // Sunday 27 Sep 2026
function g(patch: Partial<GarmentDraft> & { hex?: string }): Garment {
  const { hex, ...draft } = patch
  const base = createGarment({ ...emptyDraft(), category: 'top', ...draft }, null, new Date(NOW.getTime() - 1e7 + seq++))
  return { ...base, colors: hex ? [{ hex, share: 1 }] : base.colors }
}
const goa: City = { name: 'Goa', region: 'Goa', country: 'India', latitude: 15.3, longitude: 74.1 }
const w = (feelsLike: number, extra: Partial<Weather> = {}): Weather => ({
  temp: feelsLike,
  feelsLike,
  humidity: 70,
  precipitation: 0,
  windKmh: 10,
  code: 1,
  todayMax: feelsLike + 3,
  todayMin: feelsLike - 5,
  rainChance: 10,
  uvMax: 8,
  fetchedAt: NOW.toISOString(),
  ...extra,
})

const closet = [
  g({ subtype: 'T-shirt', hex: '#F4F4F1', formality: 2, warmth: 1 }),
  g({ subtype: 'T-shirt', hex: '#1F2A44', formality: 2, warmth: 1 }),
  g({ subtype: 'Shirt', hex: '#8DB9E2', formality: 3, warmth: 1, name: 'Sky blue linen shirt' }),
  g({ category: 'bottom', subtype: 'Shorts', hex: '#D8C4A2', formality: 2, warmth: 1 }),
  g({ category: 'bottom', subtype: 'Jeans', hex: '#3E5C82', formality: 2, warmth: 2, name: 'Navy jeans' }),
  g({ category: 'footwear', subtype: 'Sandals', hex: '#6B4A33', formality: 2 }),
  g({ category: 'footwear', subtype: 'Sneakers', hex: '#F4F4F1', formality: 2 }),
  g({ category: 'outerwear', subtype: 'Raincoat', hex: '#EBC943', formality: 2, warmth: 2 }),
  g({ category: 'accessory', subtype: 'Sunglasses', hex: '#1B1B1D' }),
]

describe('trip dates', () => {
  it('lists every day and validates', () => {
    expect(tripDates({ start: '2026-10-02', end: '2026-10-04' })).toEqual(['2026-10-02', '2026-10-03', '2026-10-04'])
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    const ok = { destination: goa, start: '2026-10-02', end: '2026-10-04', vibe: '', activities: [] }
    expect(validateTrip(ok, '2026-09-27')).toEqual([])
    expect(validateTrip({ ...ok, end: '2026-10-01' }, '2026-09-27')).toContain('The trip ends before it starts.')
    expect(validateTrip({ ...ok, destination: null }, '2026-09-27')).toContain('Choose where you are going.')
    expect(validateTrip({ ...ok, end: '2026-11-30' }, '2026-09-27').join(' ')).toMatch(/up to 21 days/)
  })
  it('understands "this weekend", "for 3 days" and "tomorrow"', () => {
    const fri = new Date(2026, 9, 2, 10) // Friday 2 Oct
    expect(datesFromText('this weekend', fri)).toEqual({ start: '2026-10-03', end: '2026-10-04' })
    expect(datesFromText('for 3 days', fri)).toEqual({ start: '2026-10-03', end: '2026-10-05' })
    expect(datesFromText('tomorrow', fri)).toEqual({ start: '2026-10-03', end: '2026-10-03' })
    expect(datesFromText('someday')).toBeNull()
    const sun = new Date(2026, 8, 27, 10)
    expect(datesFromText('this weekend', sun)).toEqual({ start: '2026-09-27', end: '2026-09-27' })
    expect(datesFromText('next weekend', sun)).toEqual({ start: '2026-10-03', end: '2026-10-04' })
  })
})

describe('trip weather', () => {
  it('reads daily forecasts and re-dates last year’s weather', () => {
    const raw = { daily: { time: ['2025-10-10', '2025-10-11'], temperature_2m_max: [31, 30], temperature_2m_min: [24, 23], precipitation_sum: [0, 12], weather_code: [1, 63] } }
    const days = parseDaily(raw, 'typical', ['2026-10-10', '2026-10-11'])
    expect(days.map((d) => d.date)).toEqual(['2026-10-10', '2026-10-11'])
    expect(days[1]!.weather.rainChance).toBe(70)
    expect(days[0]!.source).toBe('typical')
  })
})

describe('packing', () => {
  it('uses travel days at both ends of longer trips', () => {
    expect(dayOccasions(4, ['casual'])).toEqual(['travel', 'casual', 'casual', 'travel'])
    expect(dayOccasions(2, ['casual', 'evening'])).toEqual(['casual', 'evening'])
    expect(dayOccasions(5, ['active', 'evening'])).toEqual(['travel', 'active', 'evening', 'active', 'travel'])
  })
  it('plans an outfit a day and a sensible packing list', () => {
    const trip = createTrip({ destination: goa, start: '2026-10-02', end: '2026-10-05', vibe: 'beach', activities: ['casual'] }, NOW)
    const weather: DayWeather[] = tripDates(trip).map((date, i) => ({ date, source: 'forecast', weather: w(31, i === 2 ? { code: 63, rainChance: 80, precipitation: 1 } : {}) }))
    const plan = planTrip(closet, trip, weather, { routine: null })
    expect(plan.days).toHaveLength(4)
    expect(plan.days.every((d) => d.outfit !== null)).toBe(true)
    // Variety: not the same top every day.
    const tops = new Set(plan.days.map((d) => d.outfit!.pieces.find((p) => slotOf(p) === 'top')?.id))
    expect(tops.size).toBeGreaterThan(1)
    // Rainy day gets closed shoes; essentials follow the weather and vibe.
    const rainy = plan.days[2]!.outfit!.pieces.find((p) => slotOf(p) === 'footwear')!
    expect(rainy.subtype).toBe('Sneakers')
    const essentials = plan.essentials.map((e) => e.label).join(' | ')
    expect(essentials).toMatch(/Umbrella/)
    expect(essentials).toMatch(/Sunscreen/)
    expect(essentials).toMatch(/Swimwear/)
    // Everything worn is packed once, with how many days it is worn.
    const packed = plan.pack.flatMap((grp) => grp.items)
    expect(new Set(packed.map((p) => p.key)).size).toBe(packed.length)
    expect(packed.reduce((s, p) => s + p.days, 0)).toBeGreaterThanOrEqual(8)
  })
  it('explains typical weather and missing clothes', () => {
    const trip = createTrip({ destination: goa, start: '2026-12-20', end: '2026-12-21', vibe: '', activities: [] }, NOW)
    const plan = planTrip([g({ subtype: 'T-shirt' })], trip, tripDates(trip).map((date) => ({ date, source: 'typical', weather: w(28) })), { routine: null })
    expect(plan.notes.join(' ')).toMatch(/last year/)
    expect(plan.notes.join(' ')).toMatch(/no outfit/)
  })
})

describe('assistant', () => {
  const data: AssistantData = { garments: closet, profile: EMPTY_PROFILE, weather: w(30), affinity: null, now: NOW }

  it('finds pieces by color and type', () => {
    expect(findPiece('what goes with my navy jeans?', closet)?.subtype).toBe('Jeans')
    expect(findPiece('the sky blue shirt', closet)?.subtype).toBe('Shirt')
    expect(findPiece('my purple hat', closet)).toBeNull()
  })
  it('answers outfit requests and "another"', () => {
    const first = respond('Suggest an outfit for an unexpected evening party tonight', data, {})
    expect(first.reply.kind).toBe('outfit')
    expect(first.reply.text).toMatch(/evening out/)
    const next = respond('another one', data, first.memory)
    expect(next.reply.kind).toBe('outfit')
    expect(next.memory.lastOutfit?.index).toBe(1)
  })
  it('starts a trip plan with place and dates', () => {
    const fri = { ...data, now: new Date(2026, 9, 2, 10) }
    const { reply } = respond('Help me pack for my weekend getaway to Goa', fri, {})
    expect(reply.kind).toBe('trip')
    if (reply.kind === 'trip') {
      expect(reply.placeQuery).toBe('Goa')
      expect(reply.draft).toMatchObject({ start: '2026-10-03', end: '2026-10-04' })
    }
    const vague = respond('help me pack', fri, {}).reply
    expect(vague.kind === 'trip' && vague.placeQuery).toBe(null)
  })
  it('finds matches, idle pieces, weather and wardrobe gaps', () => {
    expect(respond('what goes with my navy jeans', data, {}).reply.kind).toBe('pieces')
    expect(respond("what haven't I worn lately?", data, {}).reply.kind).toBe('pieces')
    expect(respond('What haven’t I worn?', data, {}).reply.kind).toBe('pieces')
    expect(respond("what's the weather", data, {}).reply).toMatchObject({ kind: 'text' })
    const gaps = respond('What should I add to my wardrobe?', data, {}).reply
    expect(gaps.kind).toBe('text')
    if (gaps.kind === 'text') expect(gaps.text).toMatch(/layer|sneakers|bottoms|top|covered/)
  })
  it('says what it can do when it does not understand', () => {
    expect(respond('blorp', data, {}).reply).toMatchObject({ kind: 'text' })
    expect(respond('hi', data, {}).reply.kind).toBe('text')
  })
})

describe('choosing the right place', () => {
  const c = (name: string, region: string, country: string): City => ({ name, region, country, latitude: 0, longitude: 0 })
  const goaResults = [c('Genoa', 'Liguria', 'Italy'), c('Panaji', 'Goa', 'India'), c('Margao', 'Goa', 'India')]
  it('prefers exact names, then regions, then the home country', () => {
    expect(bestCityMatch('Goa', goaResults, 'India')?.name).toBe('Panaji')
    expect(bestCityMatch('Paris', [c('Paris', 'Texas', 'United States'), c('Paris', 'Île-de-France', 'France')])?.country).toBe('United States')
    expect(bestCityMatch('Paris', [c('Paris', 'Texas', 'United States'), c('Paris', 'Île-de-France', 'France')], 'France')?.country).toBe('France')
    expect(bestCityMatch('Hyderabad', [c('Hyderābād', 'Sindh', 'Pakistan'), c('Hyderabad', 'Telangana', 'India')], 'India')?.country).toBe('India')
    expect(bestCityMatch('Xyz', goaResults)).toBeNull()
  })
})
