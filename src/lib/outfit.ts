// The outfit engine. Builds complete outfits from the closet and scores them out of 100.
//
//   part            casual/travel   work/evening/festive
//   color harmony        40               30
//   weather/thermal      20               20
//   dress code           15               25
//   style / vibe         10               10    (moves to harmony when no style is set)
//   body (dosha)          5                5    (moves to harmony when no dosha result)
//   freshness            10               10
//
// Then learned taste (Love it / Don't like) adds or removes up to 8 points.
// Pure functions only, so every rule is covered by tests.

import { FORMALITY_LABELS, METAL_LABELS, type Formality, type Metal } from './catalog'
import { colorName } from './color'
import { DOSHA_GUIDE, type DoshaId } from './dosha'
import { affinityPoints, NO_ADJUST, pairKey, type Affinity, type DayAdjust } from './feedback'
import { harmonyOf, type Harmony } from './harmony'
import { displayName, dominantHex, type Garment } from './model'
import { MIN_COVERAGE, routineDef, type Modesty, type RoutineId } from './profile'
import { CLOTHING, MAIN, SLOT_ORDER, slotOf, VISIBLE, type Slot } from './slots'
import { styleDef, styleFit, type StyleId } from './styles'
import { thermalIndex, type Feeling, type Thermal } from './thermal'
import { isRainy, isSunny, seasonFromWeather, type Weather } from './weather'

export { SLOT_ORDER, slotOf, type Slot } from './slots'

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
  /** Everything below is optional; missing means "no preference". */
  feeling?: Feeling | null
  dosha?: DoshaId | null
  /** Today's vibe, or the profile's styles when no vibe is typed. */
  styles?: StyleId[]
  /** Color names the person asked for today, e.g. from "something in pink". */
  wishColors?: string[]
  modesty?: Modesty
  metal?: Metal | null
  affinity?: Affinity | null
  adjust?: DayAdjust
  /** From the typed occasion, e.g. +1 for "interview". */
  formalityShift?: number
  preferShoes?: string[]
}

export interface Outfit {
  pieces: Garment[]
  /** 0..100 */
  score: number
  harmony: Harmony
  thermal: Thermal
  parts: { harmony: number; weather: number; occasion: number; style: number | null; body: number | null; freshness: number }
  /** Past feedback liked this pairing. */
  loved: boolean
}

const OPEN_SHOES = new Set(['Sandals', 'Slippers', 'Heels', 'Kolhapuris', 'Flats'])
const DAY = 86_400_000

export function thermalFor(ctx: OutfitContext): Thermal {
  return thermalIndex({
    feelsLike: ctx.weather?.feelsLike ?? null,
    rainy: ctx.weather ? isRainy(ctx.weather) : false,
    dosha: ctx.dosha ?? null,
    feeling: ctx.feeling ?? null,
    shift: ctx.adjust?.thermalShift ?? 0,
  })
}

export function targetFormality(occasion: OccasionId, routine: RoutineId | null, shift = 0): number {
  let base: number
  switch (occasion) {
    case 'work':
      base = routineDef(routine)?.workFormality ?? 3
      break
    case 'casual':
      base = 1.75
      break
    case 'evening':
      base = 3
      break
    case 'festive':
      base = 3.25
      break
    case 'travel':
      base = 2
      break
  }
  return Math.max(1, Math.min(4, base + shift))
}

const ctxFormality = (ctx: OutfitContext) => targetFormality(ctx.occasion, ctx.routine, (ctx.formalityShift ?? 0) + (ctx.adjust?.formalityShift ?? 0))

const avg = (xs: number[], fallback: number) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : fallback)
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const nameOf = (g: Garment) => {
  const hex = dominantHex(g)
  return hex ? colorName(hex) : null
}

function weatherScore(pieces: Garment[], w: Weather | null, thermal: Thermal): number {
  const clothes = pieces.filter((p) => CLOTHING.includes(slotOf(p)) && slotOf(p) !== 'layer')
  let score = 1 - avg(clothes.map((p) => Math.abs((p.warmth ?? 2) - thermal.idealWarmth)), 0) / 2
  const hasLayer = pieces.some((p) => slotOf(p) === 'layer')
  const rainy = w ? isRainy(w) : false
  if (hasLayer && !thermal.needsLayer && !rainy) score *= 0.75
  if (!hasLayer && thermal.index >= 5) score *= 0.8
  if (!w) return clamp01(score * 0.85) // unsure without a forecast
  const shoes = pieces.find((p) => slotOf(p) === 'footwear')
  if (shoes && rainy && OPEN_SHOES.has(shoes.subtype)) score *= 0.6
  const season = seasonFromWeather(w)
  if (season) {
    const offSeason = pieces.filter((p) => p.seasons.length > 0 && !p.seasons.includes(season)).length
    score *= Math.max(0.5, 1 - 0.15 * offSeason)
  }
  return clamp01(score)
}

function occasionScore(pieces: Garment[], ctx: OutfitContext): number {
  const target = ctxFormality(ctx)
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
  if (shoes && ctx.preferShoes?.length) score += ctx.preferShoes.includes(shoes.subtype) ? 0.1 : -0.1
  if (ctx.occasion === 'work' && ctx.routine === 'field' && shoes) {
    if (['Boots', 'Sneakers'].includes(shoes.subtype)) score += 0.1
    if (shoes.subtype === 'Heels') score -= 0.3
  }
  return clamp01(score)
}

function styleScore(pieces: Garment[], ctx: OutfitContext): number | null {
  const styles = ctx.styles ?? []
  const wish = ctx.wishColors ?? []
  if (styles.length === 0 && wish.length === 0) return null
  const visible = pieces.filter((p) => VISIBLE.includes(slotOf(p)))
  const fits = visible.map((p) => (styles.length ? Math.max(...styles.map((s) => styleFit(p, nameOf(p), s))) : 0))
  let score = styles.length ? avg(fits, 0) : 0.5
  if (wish.length) {
    const hit = visible.some((p) => p.colors.some((c) => wish.includes(colorName(c.hex))))
    score = hit ? Math.min(1, score + 0.4) : score * 0.7
  }
  return clamp01(score)
}

function bodyScore(pieces: Garment[], dosha: DoshaId | null | undefined): number | null {
  if (!dosha) return null
  const g = DOSHA_GUIDE[dosha]
  const clothes = pieces.filter((p) => CLOTHING.includes(slotOf(p)))
  const fabric = avg(clothes.filter((p) => p.fabric).map((p) => (g.fabricIds.includes(p.fabric!) ? 1 : 0.3)), 0.6)
  const color = avg(clothes.map((p) => (nameOf(p) && g.colorNames.includes(nameOf(p)!) ? 1 : 0.5)), 0.5)
  return clamp01(0.5 * fabric + 0.5 * color)
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

export function scoreOutfit(pieces: Garment[], ctx: OutfitContext, thermal: Thermal = thermalFor(ctx)): Outfit {
  const visible = pieces.filter((p) => VISIBLE.includes(slotOf(p)))
  const colors = visible.map(dominantHex).filter((h): h is string => h !== null)
  const patterned = visible.filter((p) => p.pattern && p.pattern !== 'solid').length
  const harmony =
    colors.length > 0
      ? harmonyOf(colors, patterned)
      : { score: 0.7, kind: 'neutral' as const, label: 'Colors unknown', reason: 'Colors are still being read from the photos.' }
  const parts = {
    harmony: harmony.score,
    weather: weatherScore(pieces, ctx.weather, thermal),
    occasion: occasionScore(pieces, ctx),
    style: styleScore(pieces, ctx),
    body: bodyScore(pieces, ctx.dosha),
    freshness: freshnessScore(pieces, ctx.now),
  }
  // Dress code matters more when there is one (office, evening, festive).
  const strict = ctx.occasion === 'work' || ctx.occasion === 'evening' || ctx.occasion === 'festive'
  const w = strict
    ? { harmony: 30, weather: 20, occasion: 25, style: 10, body: 5, freshness: 10 }
    : { harmony: 40, weather: 20, occasion: 15, style: 10, body: 5, freshness: 10 }
  let harmonyWeight = w.harmony
  if (parts.style === null) harmonyWeight += w.style
  if (parts.body === null) harmonyWeight += w.body
  let score =
    harmonyWeight * parts.harmony +
    w.weather * parts.weather +
    w.occasion * parts.occasion +
    (parts.style ?? 0) * w.style +
    (parts.body ?? 0) * w.body +
    w.freshness * parts.freshness

  const { points, loved } = affinityPoints(visible, ctx.affinity ?? null)
  score += points
  // A pairing disliked earlier today is a last resort.
  const avoid = ctx.adjust?.avoidPairs ?? []
  if (avoid.length) {
    const mains = visible.map((p) => p.id)
    for (let i = 0; i < mains.length; i++) for (let j = i + 1; j < mains.length; j++) if (avoid.includes(pairKey(mains[i]!, mains[j]!))) score -= 30
  }

  const ordered = [...pieces].sort((a, b) => SLOT_ORDER.indexOf(slotOf(a)) - SLOT_ORDER.indexOf(slotOf(b)))
  return { pieces: ordered, score: Math.max(0, Math.min(100, Math.round(score))), harmony, thermal, parts, loved }
}

// ---------- building outfits ----------

/** Pieces allowed today: modesty, and anything ruled out by today's feedback. */
export function allowedPieces(garments: Garment[], ctx: OutfitContext): Garment[] {
  const minCoverage = MIN_COVERAGE[ctx.modesty ?? 3]
  const adj = ctx.adjust ?? NO_ADJUST
  return garments.filter(
    (g) =>
      !(CLOTHING.includes(slotOf(g)) && g.coverage < minCoverage) &&
      !adj.avoidIds.includes(g.id) &&
      !adj.avoidSubtypes.includes(g.subtype),
  )
}

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

function bestBy(options: Garment[], base: Garment[], ctx: OutfitContext, thermal: Thermal): Outfit | null {
  let best: Outfit | null = null
  for (const piece of options) {
    const outfit = scoreOutfit([...base, piece], ctx, thermal)
    if (!best || outfit.score > best.score) best = outfit
  }
  return best
}

const daysSinceWorn = (g: Garment, now: Date) => (g.lastWornAt ? (now.getTime() - Date.parse(g.lastWornAt)) / DAY : 1e6)

function pickJewellery(all: Garment[], ctx: OutfitContext): Garment[] {
  if (all.length === 0) return []
  const max = ctx.occasion === 'festive' ? 3 : ctx.occasion === 'evening' ? 2 : 1
  const target = ctxFormality(ctx)
  // Stick to the person's metal when they own pieces in it; pieces with no metal set always qualify.
  const preferred = ctx.metal ? all.filter((j) => !j.metal || j.metal === ctx.metal) : all
  const pool = preferred.some((j) => j.metal === ctx.metal) ? preferred : all
  const ranked = [...pool].sort(
    (a, b) =>
      Number(!!ctx.metal && b.metal === ctx.metal) - Number(!!ctx.metal && a.metal === ctx.metal) ||
      Math.abs(a.formality - target) - Math.abs(b.formality - target) ||
      Number(ctx.occasion === 'work' && b.subtype === 'Watch') - Number(ctx.occasion === 'work' && a.subtype === 'Watch') ||
      daysSinceWorn(b, ctx.now) - daysSinceWorn(a, ctx.now),
  )
  const picked: Garment[] = []
  const metal = ranked.find((j) => j.metal)?.metal ?? null
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
  const thermal = outfit.thermal
  const has = (s: Slot) => pieces.some((p) => slotOf(p) === s)
  const rainy = w ? isRainy(w) : false

  // A layer when the thermal index says so, when rain calls for a raincoat, or a blazer for a formal office.
  const wantsLayer =
    thermal.needsLayer ||
    (rainy && slots.layer.some((l) => l.subtype === 'Raincoat')) ||
    (ctx.occasion === 'work' && ctx.routine === 'corporate' && slots.layer.some((l) => l.subtype === 'Blazer') && thermal.index >= 2)
  if (wantsLayer && !has('layer') && slots.layer.length) {
    const options = rainy && slots.layer.some((l) => l.subtype === 'Raincoat') ? slots.layer.filter((l) => l.subtype === 'Raincoat') : slots.layer
    const best = bestBy(options, pieces, ctx, thermal)
    if (best) pieces = best.pieces
  }

  const main = scoreOutfit(pieces, ctx, thermal)
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
    thermal.index >= 4 ? accessory('Scarf') : undefined,
    ctx.occasion === 'work' && ctx.routine === 'corporate' ? accessory('Tie') : undefined,
    ctx.occasion === 'festive' && pieces.some((p) => ['Kurti', 'Salwar suit'].includes(p.subtype)) ? accessory('Dupatta') : undefined,
    ctx.occasion === 'travel' ? accessory('Headphones') : undefined,
  ]
  for (const e of extras) if (e && !pieces.includes(e)) pieces.push(e)

  // Extras change the look but not the score: the score judges the clothes and shoes.
  return { ...main, pieces: scoreOutfit(pieces, ctx, thermal).pieces }
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
  const thermal = thermalFor(ctx)
  const s = bySlot(allowedPieces(garments, ctx))
  const bases: Garment[][] = [...s.onepiece.map((o) => [o])]
  for (const t of s.top) for (const b of s.bottom) bases.push([t, b])
  if (bases.length === 0) return []

  const candidates = bases.map((base) => {
    const outfit = (s.footwear.length ? bestBy(s.footwear, base, ctx, thermal) : null) ?? scoreOutfit(base, ctx, thermal)
    return { outfit, rank: outfit.score + jitter(base.map((b) => b.id), ctx.now) }
  })
  candidates.sort((a, b) => b.rank - a.rank)

  const picked: Outfit[] = []
  const usedCount = new Map<string, number>()
  for (const { outfit } of candidates) {
    if (picked.length >= limit) break
    const mains = outfit.pieces.filter((p) => MAIN.includes(slotOf(p)))
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
  return allowedPieces(garments, ctx)
    .filter((g) => g.id !== piece.id && slotOf(g) === slot && !rest.some((r) => r.id === g.id))
    .map((g) => scoreOutfit([...rest, g], ctx, outfit.thermal))
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

const join = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

export function explain(outfit: Outfit, ctx: OutfitContext): string[] {
  const lines: string[] = []
  const t = outfit.thermal
  const w = ctx.weather
  const weight = t.index <= 1 ? 'light, breathable pieces' : t.index === 2 ? 'light pieces' : t.index === 3 ? 'medium-weight pieces' : 'warmer pieces'
  let first = `Thermal index ${t.index}/5`
  if (t.reasons.length) first += ` (${join(t.reasons)})`
  first += `: ${weight}`
  if (outfit.pieces.some((p) => slotOf(p) === 'layer')) first += ', plus a layer'
  if (w && isRainy(w)) first += outfit.pieces.some((p) => slotOf(p) === 'footwear' && !OPEN_SHOES.has(p.subtype)) ? '; closed shoes for the rain' : '; rain is likely'
  lines.push(`${first}.`)

  lines.push(outfit.harmony.reason)

  const target = Math.round(ctxFormality(ctx)) as Formality
  const what = ctx.occasion === 'work' ? WORK_PHRASE[ctx.routine ?? 'business-casual'] : OCCASION_PHRASE[ctx.occasion]
  lines.push(`${FORMALITY_LABELS[Math.min(4, Math.max(1, target)) as Formality]} pieces suit ${what}.`)

  const styles = ctx.styles ?? []
  if (styles.length && outfit.parts.style !== null && outfit.parts.style >= 0.5) {
    const visible = outfit.pieces.filter((p) => VISIBLE.includes(slotOf(p)))
    const best = [...styles].sort((a, b) => avg(visible.map((p) => styleFit(p, nameOf(p), b)), 0) - avg(visible.map((p) => styleFit(p, nameOf(p), a)), 0))[0]!
    lines.push(`Leans ${styleDef(best).label}, as you asked.`)
  }
  if (ctx.wishColors?.length && outfit.pieces.some((p) => p.colors.some((c) => ctx.wishColors!.includes(colorName(c.hex))))) {
    lines.push(`Includes the ${join(ctx.wishColors.map((c) => c.toLowerCase()))} you wanted.`)
  }

  if (ctx.dosha && outfit.parts.body !== null && outfit.parts.body >= 0.7) {
    const g = DOSHA_GUIDE[ctx.dosha]
    lines.push(`Fabrics and colors suit ${g.label}: ${g.thermalShift < 0 ? 'cooling and breathable' : 'warming and grounding'}.`)
  }

  if ((ctx.modesty ?? 3) <= 2) lines.push('Keeps to your coverage preference.')

  const visible = outfit.pieces.filter((p) => VISIBLE.includes(slotOf(p)))
  const fresh = [...visible].sort((a, b) => daysSinceWorn(b, ctx.now) - daysSinceWorn(a, ctx.now))[0]
  if (fresh) {
    lines.push(
      fresh.lastWornAt
        ? `You last wore the ${displayName(fresh).toLowerCase()} on ${dateFmt.format(new Date(fresh.lastWornAt))}.`
        : `First outing for the ${displayName(fresh).toLowerCase()}.`,
    )
  }

  const metals = [...new Set(outfit.pieces.filter((p) => p.metal).map((p) => p.metal!))]
  if (metals.length === 1 && metals[0] !== 'other') {
    lines.push(ctx.metal === metals[0] ? `${METAL_LABELS[metals[0]!]} jewellery, your favourite metal.` : `Jewellery sticks to one metal (${METAL_LABELS[metals[0]!].toLowerCase()}).`)
  }
  if (outfit.loved) lines.push('You loved this pairing before.')
  return lines
}

/** e.g. "Rust shirt" or "Gold earrings" for lists and accessibility labels. */
export function pieceLabel(g: Garment): string {
  const metal = g.metal && g.metal !== 'other' ? METAL_LABELS[g.metal] : null
  if (metal) return displayName(g).toLowerCase().includes(metal.toLowerCase()) ? displayName(g) : `${metal} ${displayName(g).toLowerCase()}`
  // A name the person typed ("Tan leather tote") is used as it is.
  if (g.name) return g.name
  const hex = dominantHex(g)
  const name = displayName(g)
  return hex ? `${colorName(hex)} ${name.toLowerCase()}` : name
}
