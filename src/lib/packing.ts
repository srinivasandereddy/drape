// Plans a trip: one outfit per day from your closet, using the destination's
// weather for each date, then turns those outfits into a packing list.
// Pure function, covered by tests.

import type { Garment } from './model'
import { suggestOutfits, type OccasionId, type Outfit, type OutfitContext } from './outfit'
import { SLOT_ORDER, slotOf, type Slot } from './slots'
import { parseDate, tripDates, type Trip } from './trip'
import { isRainy, isSunny, type DayWeather, type Weather } from './weather'

export interface TripDay {
  date: string
  weather: Weather | null
  source: DayWeather['source'] | null
  occasion: OccasionId
  outfit: Outfit | null
}

export interface PackItem {
  key: string
  label: string
  garment: Garment | null
  /** How many days it is worn on the trip. */
  days: number
}

export interface TripPlan {
  days: TripDay[]
  /** Clothes grouped by slot, in outfit order. */
  pack: { slot: Slot; items: PackItem[] }[]
  essentials: PackItem[]
  notes: string[]
}

const SLOT_TITLES: Record<Slot, string> = {
  layer: 'Layers',
  top: 'Tops',
  onepiece: 'Dresses and sets',
  bottom: 'Bottoms',
  footwear: 'Shoes',
  bag: 'Bags',
  jewellery: 'Jewellery',
  accessory: 'Accessories',
}
export const slotTitle = (s: Slot) => SLOT_TITLES[s]

/** Which occasion each day gets: travel days at both ends, the chosen activities in between. */
export function dayOccasions(n: number, activities: OccasionId[]): OccasionId[] {
  const pool = activities.filter((a) => a !== 'travel')
  const cycle = pool.length ? pool : ['casual' as OccasionId]
  // Trips of 3+ days start and end with a travel day; the days between rotate through the activities.
  const travelEnds = n >= 3
  return Array.from({ length: n }, (_, i) => {
    if (travelEnds && (i === 0 || i === n - 1)) return 'travel'
    return cycle[(travelEnds ? i - 1 : i) % cycle.length]!
  })
}

export function planTrip(garments: Garment[], trip: Trip, weather: DayWeather[], base: Omit<OutfitContext, 'occasion' | 'weather' | 'now'>): TripPlan {
  const dates = tripDates(trip)
  const occasions = dayOccasions(dates.length, trip.activities)
  // A private copy: "wearing" pieces on earlier days makes later days pick others.
  let closet = garments.map((g) => ({ ...g }))
  const packed = new Set<string>()
  const days: TripDay[] = dates.map((date, i) => {
    const w = weather.find((d) => d.date === date) ?? null
    const now = parseDate(date)
    const ctx: OutfitContext = { ...base, occasion: occasions[i]!, weather: w?.weather ?? null, now, preferIds: [...packed] }
    const outfit = suggestOutfits(closet, ctx, 3)[0] ?? null
    if (outfit) {
      const worn = new Set(outfit.pieces.map((p) => p.id))
      for (const id of worn) packed.add(id)
      closet = closet.map((g) => (worn.has(g.id) ? { ...g, lastWornAt: now.toISOString() } : g))
    }
    return { date, weather: w?.weather ?? null, source: w?.source ?? null, occasion: occasions[i]!, outfit }
  })

  const count = new Map<string, { garment: Garment; days: number }>()
  for (const d of days) for (const p of d.outfit?.pieces ?? []) count.set(p.id, { garment: garments.find((g) => g.id === p.id) ?? p, days: (count.get(p.id)?.days ?? 0) + 1 })
  const pack = SLOT_ORDER.map((slot) => ({
    slot,
    items: [...count.values()].filter((c) => slotOf(c.garment) === slot).map((c) => ({ key: c.garment.id, label: c.garment.name || c.garment.subtype || 'Piece', garment: c.garment, days: c.days })),
  })).filter((g) => g.items.length > 0)

  const ws = days.map((d) => d.weather).filter((w): w is Weather => w !== null)
  const essentials: PackItem[] = []
  const add = (key: string, label: string) => essentials.push({ key: `e:${key}`, label, garment: null, days: 0 })
  add('basics', `Underwear, socks and sleepwear for ${dates.length} day${dates.length === 1 ? '' : 's'}`)
  add('toiletries', 'Toiletries and medicines')
  add('chargers', 'Phone charger')
  if (ws.some(isRainy)) add('umbrella', 'Umbrella or rain jacket')
  if (ws.some((w) => isSunny(w) || w.uvMax >= 6)) add('sun', 'Sunscreen')
  if (/beach|pool|swim|resort|island|goa/i.test(trip.vibe + ' ' + trip.destination.name)) add('swim', 'Swimwear')
  if (occasions.includes('active')) add('water', 'Water bottle and gym towel')
  if (occasions.includes('festive')) add('gift', 'Festive accessories or gift')

  const notes: string[] = []
  if (days.some((d) => !d.outfit)) notes.push('Some days have no outfit: add a top and bottom (or a dress) to your closet.')
  if (ws.some((w) => w.feelsLike < 14) && !pack.some((g) => g.slot === 'layer')) notes.push('It will be cold and you have no layer in your closet. Pack a jacket or sweater.')
  if (days.some((d) => d.source === 'typical')) notes.push('Dates more than two weeks away use last year’s weather for the same days. Re-plan closer to the trip for the real forecast.')
  if (ws.length === 0) notes.push('No weather available yet, so outfits ignore the forecast.')

  return { days, pack, essentials, notes }
}
