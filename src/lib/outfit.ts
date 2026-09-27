// The outfit engine. Builds complete outfits from the closet and scores them:
//   color harmony 50 · weather 25 · occasion 15 · freshness 10  (= 100)
// For work, evening and festive: harmony 40 · weather 25 · occasion 25 · freshness 10.
// Pure functions only, so every rule is covered by tests.

import { FORMALITY_LABELS, METAL_LABELS, type Formality } from './catalog'
import { colorName } from './color'
import { harmonyOf, type Harmony } from './harmony'
import { displayName, dominantHex, type Garment } from './model'
import { routineDef, type RoutineId } from './profile'
import { idealWarmth, isRainy, isSunny, needsLayer, seasonFromWeather, type Weather } from './weather'

export type Slot = 'top' | 'bottom' | 'onepiece' | 'layer' | 'footwear' | 'jewellery' | 'bag' | 'accessory'
export const SLOT_ORDER: readonly Slot[] = ['layer', 'top', 'onepiece', 'bottom', 'footwear', 'bag', 'jewellery', 'accessory']
const CLOTHING: readonly Slot[] = ['top', 'bottom', 'onepiece', 'layer']
const VISIBLE: readonly Slot[] = ['top', 'bottom', 'onepiece', 'layer', 'footwear']

export function slotOf(g: Pick<Garment, 'category' | 'subtype'>): Slot {
  switch (g.category) {
    case 'top':
      return 'top'
    case 'bottom':
      return 'bottom'
    case 'outerwear':
      return 'layer'
    case 'dress':
      return 'onepiece'
    case 'footwear':
      return 'footwear'
    case 'jewellery':
      return 'jewellery'
    case 'bag':
      return 'bag'
    case 'accessory':
      return 'accessory'
    case 'ethnic':
      if (g.subtype === 'Kurta' || g.subtype === 'Kurti') return 'top'
      if (g.subtype === 'Dhoti') return 'bottom'
      if (g.subtype === 'Nehru jacket') return 'layer'
      if (g.subtype === 'Dupatta') return 'accessory'
      return 'onepiece' // saree, salwar suit, lehenga, sherwani
  }
}

export type OccasionId = 'work' | 'casual' | 'evening' | 'festive' | 'travel'
export const OCCASIONS: readonly { id: OccasionId; label: string }[] = [
  { id: 'work', label: 'Work' },
  { id: 'casual', label: 'Casual' },
  { id: 'evening', label: 'Evening out' },
  { id: 'festive', label: 'Festive' },
  { id: 'travel', label: 'Travel' },
]

export interface OutfitContext {
  occasion: OccasionId
  routine: RoutineId | null
  weather: Weather | null
  now: Date
}

export interface Outfit {
  pieces: Garment[]
  /** 0..100 */
  score: number
  harmony: Harmony
  parts: { harmony: number; weather: number; occasion: number; freshness: number }
}

const OPEN_SHOES = new Set(['Sandals', 'Slippers', 'Heels', 'Kolhapuris', 'Flats'])
const DAY = 86_400_000

export function targetFormality(occasion: OccasionId, routine: RoutineId | null): number {
  switch (occasion) {
    case 'work':
      return routineDef(routine)?.workFormality ?? 3
    case 'casual':
      return 1.75
    case 'evening':
      return 3
    case 'festive':
      return 3.25
    case 'travel':
      return 2
  }
}

const avg = (xs: number[], fallback: number) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : fallback)
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

function weatherScore(pieces: Garment[], w: Weather | null): number {
  if (!w) return 0.7 // unknown weather: neither reward nor punish much
  const ideal = idealWarmth(w.feelsLike)
  const clothes = pieces.filter((p) => CLOTHING.includes(slotOf(p)) && slotOf(p) !== 'layer')
  let score = 1 - avg(clothes.map((p) => Math.abs((p.warmth ?? 2) - ideal)), 0) / 2
  const hasLayer = pieces.some((p) => slotOf(p) === 'layer')
  if (hasLayer && !needsLayer(w) && !isRainy(w)) score *= 0.75
  if (!hasLayer && w.feelsLike < 14) score *= 0.8
  const shoes = pieces.find((p) => slotOf(p) === 'footwear')
  if (shoes && isRainy(w) && OPEN_SHOES.has(shoes.subtype)) score *= 0.6
  const season = seasonFromWeather(w)
  if (season) {
    const offSeason = pieces.filter((p) => p.seasons.length > 0 && !p.seasons.includes(season)).length
    score *= Math.max(0.5, 1 - 0.15 * offSeason)
  }
  return clamp01(score)
}

function occasionScore(pieces: Garment[], ctx: OutfitContext): number {
  const target = targetFormality(ctx.occasion, ctx.routine)
  const judged = pieces.filter((p) => VISIBLE.includes(slotOf(p)))
  // Under-dressing costs more than over-dressing, and one badly-off piece drags the look down.
  const fit = judged.map((p) => {
    const d = p.formality - target
    return 1 - Math.min(1, d < 0 ? -d / 1.5 : d / 2.5)
  })
  let score = fit.length ? 0.6 * Math.min(...fit) + 0.4 * avg(fit, 0.6) : 0.6
  const shoes = pieces.find((p) => slotOf(p) === 'footwear')
  if (ctx.occasion === 'festive' && pieces.some((p) => p.category === 'ethnic')) score += 0.15
  if (ctx.occasion === 'travel' && shoes && ['Sneakers', 'Loafers', 'Sandals'].includes(shoes.subtype)) score += 0.1
  if (ctx.occasion === 'work' && ctx.routine === 'field' && shoes) {
    if (['Boots', 'Sneakers'].includes(shoes.subtype)) score += 0.1
    if (shoes.subtype === 'Heels') score -= 0.3
  }
  return clamp01(score)
}

function freshnessScore(pieces: Garment[], now: Date): number {
  const judged = pieces.filter((p) => VISIBLE.includes(slotOf(p)))
  return avg(
    judged.map((p) => {
      if (!p.lastWornAt) return 1
      const days = (now.getTime() - Date.parse(p.lastWornAt)) / DAY
      if (days < 1) return 0
      if (days < 2) return 0.3
      if (days < 4) return 0.7
      return 1
    }),
    1,
  )
}

export function scoreOutfit(pieces: Garment[], ctx: OutfitContext): Outfit {
  const visible = pieces.filter((p) => VISIBLE.includes(slotOf(p)))
  const colors = visible.map(dominantHex).filter((h): h is string => h !== null)
  const patterned = visible.filter((p) => p.pattern && p.pattern !== 'solid').length
  const harmony =
    colors.length > 0
      ? harmonyOf(colors, patterned)
      : { score: 0.7, kind: 'neutral' as const, label: 'Colors unknown', reason: 'Colors are still being read from the photos.' }
  const parts = {
    harmony: harmony.score,
    weather: weatherScore(pieces, ctx.weather),
    occasion: occasionScore(pieces, ctx),
    freshness: freshnessScore(pieces, ctx.now),
  }
  // Dress code matters more when there is one (office, evening, festive).
  const strict = ctx.occasion === 'work' || ctx.occasion === 'evening' || ctx.occasion === 'festive'
  const w = strict ? { harmony: 40, weather: 25, occasion: 25, freshness: 10 } : { harmony: 50, weather: 25, occasion: 15, freshness: 10 }
  const score = Math.round(w.harmony * parts.harmony + w.weather * parts.weather + w.occasion * parts.occasion + w.freshness * parts.freshness)
  const ordered = [...pieces].sort((a, b) => SLOT_ORDER.indexOf(slotOf(a)) - SLOT_ORDER.indexOf(slotOf(b)))
  return { pieces: ordered, score, harmony, parts }
}

// ---------- building outfits ----------

function bySlot(garments: Garment[]): Record<Slot, Garment[]> {
  const out = { top: [], bottom: [], onepiece: [], layer: [], footwear: [], jewellery: [], bag: [], accessory: [] } as Record<Slot, Garment[]>
  for (const g of garments) out[slotOf(g)].push(g)
  return out
}

/** Small stable tie-breaker so equal outfits rotate from day to day instead of always the same one. */
function jitter(ids: string[], now: Date): number {
  const seed = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}|${ids.join(',')}`
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return ((h >>> 0) % 1000) / 1000 - 0.5 // -0.5..0.5 points
}

function bestBy(options: Garment[], base: Garment[], ctx: OutfitContext): { piece: Garment; outfit: Outfit } | null {
  let best: { piece: Garment; outfit: Outfit } | null = null
  for (const piece of options) {
    const outfit = scoreOutfit([...base, piece], ctx)
    if (!best || outfit.score > best.outfit.score) best = { piece, outfit }
  }
  return best
}

const daysSinceWorn = (g: Garment, now: Date) => (g.lastWornAt ? (now.getTime() - Date.parse(g.lastWornAt)) / DAY : 1e6)

function pickJewellery(all: Garment[], ctx: OutfitContext): Garment[] {
  if (all.length === 0) return []
  const max = ctx.occasion === 'festive' ? 3 : ctx.occasion === 'evening' ? 2 : 1
  const target = targetFormality(ctx.occasion, ctx.routine)
  const ranked = [...all].sort(
    (a, b) =>
      Math.abs(a.formality - target) - Math.abs(b.formality - target) ||
      Number(ctx.occasion === 'work' && b.subtype === 'Watch') - Number(ctx.occasion === 'work' && a.subtype === 'Watch') ||
      daysSinceWorn(b, ctx.now) - daysSinceWorn(a, ctx.now),
  )
  const picked: Garment[] = []
  const metal = ranked[0]?.metal ?? null
  for (const j of ranked) {
    if (picked.length >= max) break
    if (picked.some((p) => p.subtype && p.subtype === j.subtype)) continue // one of each kind
    if (metal && j.metal && j.metal !== metal) continue // one metal per outfit
    picked.push(j)
  }
  return picked
}

const BAGS_FOR: Record<OccasionId, readonly string[]> = {
  work: ['Laptop bag', 'Tote', 'Handbag', 'Backpack'],
  casual: ['Sling bag', 'Tote', 'Backpack', 'Handbag'],
  evening: ['Clutch', 'Handbag', 'Sling bag'],
  festive: ['Clutch', 'Handbag'],
  travel: ['Backpack', 'Sling bag', 'Tote'],
}

function addExtras(outfit: Outfit, slots: Record<Slot, Garment[]>, ctx: OutfitContext): Outfit {
  let pieces = [...outfit.pieces]
  const w = ctx.weather
  const has = (s: Slot) => pieces.some((p) => slotOf(p) === s)

  // A layer when it is cool, when rain calls for a raincoat, or a blazer for a formal office.
  const wantsLayer =
    (w && (needsLayer(w) || (isRainy(w) && slots.layer.some((l) => l.subtype === 'Raincoat')))) ||
    (ctx.occasion === 'work' && ctx.routine === 'corporate' && slots.layer.some((l) => l.subtype === 'Blazer') && (!w || w.feelsLike < 30))
  if (wantsLayer && !has('layer') && slots.layer.length) {
    const rainy = w ? isRainy(w) : false
    const options = rainy && slots.layer.some((l) => l.subtype === 'Raincoat') ? slots.layer.filter((l) => l.subtype === 'Raincoat') : slots.layer
    const best = bestBy(options, pieces, ctx)
    if (best) pieces = best.outfit.pieces
  }

  const main = scoreOutfit(pieces, ctx)
  const colors = main.pieces.filter((p) => VISIBLE.includes(slotOf(p))).map(dominantHex).filter((h): h is string => !!h)

  const bags = slots.bag.filter((b) => BAGS_FOR[ctx.occasion].includes(b.subtype) || !b.subtype)
  if (bags.length) {
    const bag = [...bags].sort((a, b) => {
      const ha = harmonyOf([...colors, ...(dominantHex(a) ? [dominantHex(a)!] : [])]).score
      const hb = harmonyOf([...colors, ...(dominantHex(b) ? [dominantHex(b)!] : [])]).score
      return hb - ha || daysSinceWorn(b, ctx.now) - daysSinceWorn(a, ctx.now)
    })[0]
    if (bag) pieces.push(bag)
  }

  pieces.push(...pickJewellery(slots.jewellery, ctx))

  const bottom = pieces.find((p) => slotOf(p) === 'bottom')
  const accessory = (subtype: string) => slots.accessory.find((a) => a.subtype === subtype)
  const extras = [
    w && isSunny(w) && ['casual', 'travel'].includes(ctx.occasion) ? accessory('Sunglasses') : undefined,
    bottom && ['Jeans', 'Trousers', 'Chinos'].includes(bottom.subtype) && ['work', 'evening'].includes(ctx.occasion) ? accessory('Belt') : undefined,
    w && w.feelsLike < 15 ? accessory('Scarf') : undefined,
    ctx.occasion === 'work' && ctx.routine === 'corporate' ? accessory('Tie') : undefined,
    ctx.occasion === 'festive' && pieces.some((p) => ['Kurti', 'Salwar suit'].includes(p.subtype)) ? accessory('Dupatta') : undefined,
  ]
  for (const e of extras) if (e && !pieces.includes(e)) pieces.push(e)

  // Extras change the look but not the score: the score judges the clothes and shoes.
  return { ...main, pieces: scoreOutfit(pieces, ctx).pieces }
}

/** What is still needed before any outfit can be built. Empty means ready. */
export function missingForOutfits(garments: Garment[]): string[] {
  const s = bySlot(garments)
  const missing: string[] = []
  if (s.onepiece.length === 0 && (s.top.length === 0 || s.bottom.length === 0)) {
    if (s.top.length === 0) missing.push('a top or kurta')
    if (s.bottom.length === 0) missing.push('a bottom')
  }
  return missing
}

/** Ranked, varied outfit ideas: no two share the same main pieces. */
export function suggestOutfits(garments: Garment[], ctx: OutfitContext, limit = 12): Outfit[] {
  const s = bySlot(garments)
  const bases: Garment[][] = [...s.onepiece.map((o) => [o])]
  for (const t of s.top) for (const b of s.bottom) bases.push([t, b])
  if (bases.length === 0) return []

  const candidates = bases.map((base) => {
    const withShoes = s.footwear.length ? bestBy(s.footwear, base, ctx)!.outfit : scoreOutfit(base, ctx)
    return { outfit: withShoes, rank: withShoes.score + jitter(base.map((b) => b.id), ctx.now) }
  })
  candidates.sort((a, b) => b.rank - a.rank)

  const picked: Outfit[] = []
  const usedCount = new Map<string, number>()
  for (const { outfit } of candidates) {
    if (picked.length >= limit) break
    const mains = outfit.pieces.filter((p) => ['top', 'bottom', 'onepiece'].includes(slotOf(p)))
    // Variety: each main piece may appear in at most two of the ideas.
    if (mains.some((m) => (usedCount.get(m.id) ?? 0) >= 2)) continue
    for (const m of mains) usedCount.set(m.id, (usedCount.get(m.id) ?? 0) + 1)
    picked.push(addExtras(outfit, s, ctx))
  }
  return picked
}

/** Other pieces that could replace `piece` in `outfit`, best first. */
export function alternatives(outfit: Outfit, piece: Garment, garments: Garment[], ctx: OutfitContext, limit = 12): Outfit[] {
  const slot = slotOf(piece)
  const rest = outfit.pieces.filter((p) => p.id !== piece.id)
  return garments
    .filter((g) => g.id !== piece.id && slotOf(g) === slot && !rest.some((r) => r.id === g.id))
    .map((g) => scoreOutfit([...rest, g], ctx))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

// ---------- explaining ----------

const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })

const OCCASION_PHRASE: Record<OccasionId, string> = {
  work: 'work',
  casual: 'a relaxed day',
  evening: 'an evening out',
  festive: 'a festive occasion',
  travel: 'a day of travel',
}
const WORK_PHRASE: Record<RoutineId, string> = {
  corporate: 'a corporate office',
  'business-casual': 'a business-casual office',
  remote: 'a day working from home',
  field: 'a day of field work',
  student: 'a day of classes',
  creative: 'a creative workplace',
}

export function explain(outfit: Outfit, ctx: OutfitContext): string[] {
  const lines: string[] = []
  const w = ctx.weather
  if (w) {
    const feels = Math.round(w.feelsLike)
    const ideal = idealWarmth(w.feelsLike)
    const weight = ideal <= 1.5 ? 'light pieces to stay cool' : ideal <= 2 ? 'medium-weight pieces' : 'warmer pieces'
    let line = `Feels like ${feels}°C, so ${weight}`
    if (outfit.pieces.some((p) => slotOf(p) === 'layer')) line += ', plus a layer'
    if (isRainy(w)) line += outfit.pieces.some((p) => slotOf(p) === 'footwear' && !OPEN_SHOES.has(p.subtype)) ? '; closed shoes for the rain' : '; rain is likely'
    lines.push(`${line}.`)
  }

  lines.push(outfit.harmony.reason)

  const target = Math.round(targetFormality(ctx.occasion, ctx.routine)) as Formality
  const what = ctx.occasion === 'work' ? WORK_PHRASE[ctx.routine ?? 'business-casual'] : OCCASION_PHRASE[ctx.occasion]
  lines.push(`${FORMALITY_LABELS[Math.min(4, Math.max(1, target)) as Formality]} pieces suit ${what}.`)

  const visible = outfit.pieces.filter((p) => VISIBLE.includes(slotOf(p)))
  const fresh = [...visible].sort((a, b) => daysSinceWorn(b, ctx.now) - daysSinceWorn(a, ctx.now))[0]
  if (fresh) {
    lines.push(
      fresh.lastWornAt
        ? `You last wore the ${displayName(fresh).toLowerCase()} on ${dateFmt.format(new Date(fresh.lastWornAt))}.`
        : `First outing for the ${displayName(fresh).toLowerCase()}.`,
    )
  }

  const metals = [...new Set(outfit.pieces.filter((p) => p.metal).map((p) => p.metal))]
  if (metals.length === 1 && metals[0] !== 'other') lines.push(`Jewellery sticks to one metal (${metals[0]!.replace('-', ' ')}).`)
  return lines
}

/** e.g. "Rust shirt" for lists and accessibility labels. */
export function pieceLabel(g: Garment): string {
  if (g.metal && g.metal !== 'other') return `${METAL_LABELS[g.metal]} ${displayName(g).toLowerCase()}`
  const hex = dominantHex(g)
  return hex ? `${colorName(hex)} ${displayName(g).toLowerCase()}` : displayName(g)
}
