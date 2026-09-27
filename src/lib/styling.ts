// Styling rules a stylist would apply before looking at color: do the pieces
// belong in the same outfit at all? Consistent dressiness, pieces that clash by
// kind (running shoes with a saree, a blazer with gym shorts), pattern mixing,
// and colors that make sense for heat and rain. Pure, tested.

import { hexToLab } from './color'
import type { Garment } from './model'
import { slotOf, VISIBLE } from './slots'
import type { Weather } from './weather'
import { isRainy } from './weather'

export interface Pairing {
  /** 0..1 */
  score: number
  /** Pieces that don't belong together, in plain words. Each one costs extra points. */
  clashes: string[]
  /** Short positive or cautionary notes for the "why" list. */
  notes: string[]
}

type Rule = { a: (g: Garment) => boolean; b: (g: Garment) => boolean; why: string; unless?: readonly string[] }

const sub = (...names: string[]) => (g: Garment) => names.includes(g.subtype)
const SPORT_SHOES = sub('Running shoes')
const CASUAL_SHOES = sub('Slippers')
const GYM_BOTTOMS = sub('Joggers', 'Leggings', 'Shorts')
const ETHNIC_DRAPE = (g: Garment) => g.category === 'ethnic' && ['Saree', 'Lehenga', 'Sherwani', 'Salwar suit'].includes(g.subtype)
const SUITING = (g: Garment) => g.subtype === 'Blazer' || g.subtype === 'Formal dress' || (g.category === 'bottom' && g.subtype === 'Trousers' && g.formality >= 3)

/** Pairs of kinds that don't go together (outside the occasions listed in `unless`). */
const CLASHES: readonly Rule[] = [
  { a: SPORT_SHOES, b: ETHNIC_DRAPE, why: 'Running shoes with ethnic wear' },
  { a: SPORT_SHOES, b: SUITING, why: 'Running shoes with smart pieces' },
  { a: sub('Formal shoes', 'Heels'), b: GYM_BOTTOMS, why: 'Dress shoes with gym or lounge bottoms', unless: [] },
  { a: sub('Blazer'), b: sub('Joggers', 'Leggings'), why: 'A blazer over joggers or leggings' },
  { a: sub('Blazer'), b: sub('Shorts'), why: 'A blazer with shorts', unless: ['casual', 'travel'] },
  { a: sub('Sports bra'), b: (g) => g.formality >= 2 && g.category !== 'footwear', why: 'A sports bra with everyday pieces' },
  { a: sub('Hoodie'), b: (g) => g.category === 'footwear' && g.subtype === 'Formal shoes', why: 'A hoodie with formal shoes' },
  { a: sub('Sneakers'), b: sub('Saree', 'Lehenga'), why: 'Sneakers with a saree or lehenga', unless: ['casual', 'travel'] },
  { a: CASUAL_SHOES, b: (g) => g.formality >= 3 && g.category !== 'footwear', why: 'Slippers with smart pieces' },
  { a: sub('Boots'), b: sub('Shorts'), why: 'Heavy boots with shorts', unless: ['casual'] },
  { a: sub('Track jacket'), b: SUITING, why: 'A track jacket over smart pieces' },
]

const lightness = (g: Garment) => {
  const hex = g.colors[0]?.hex
  return hex ? hexToLab(hex)[0] : null
}

export function pairingScore(pieces: Garment[], occasion: string, weather: Weather | null): Pairing {
  const clashes: string[] = []
  const notes: string[] = []
  const worn = pieces.filter((p) => VISIBLE.includes(slotOf(p)))

  for (const r of CLASHES) {
    if (r.unless?.includes(occasion)) continue
    if (occasion === 'active' && (r.a === SPORT_SHOES || r.a === CASUAL_SHOES)) continue
    const hitA = worn.find(r.a)
    const hitB = worn.find((g) => g !== hitA && r.b(g))
    if (hitA && hitB && !clashes.includes(r.why)) clashes.push(r.why)
  }

  let score = 1
  // Consistent dressiness: a formal piece next to a very casual one looks accidental.
  const levels = worn.filter((p) => ['top', 'bottom', 'onepiece', 'layer', 'footwear'].includes(slotOf(p))).map((p) => p.formality)
  if (levels.length >= 2) {
    const spread = Math.max(...levels) - Math.min(...levels)
    if (spread >= 3) score -= 0.45
    else if (spread === 2) score -= 0.2
    else notes.push('Every piece is at the same level of dressiness.')
    if (spread >= 3) notes.push('Mixes very dressy and very casual pieces.')
  }

  // Pattern mixing: two busy prints compete; one print plus solids reads as intentional.
  const busy = worn.filter((p) => p.pattern && !['solid', 'embroidered'].includes(p.pattern) && ['top', 'bottom', 'onepiece', 'layer'].includes(slotOf(p)))
  if (busy.length >= 2) {
    const kinds = new Set(busy.map((p) => p.pattern))
    score -= kinds.size >= 2 ? 0.25 : 0.12
    notes.push(kinds.size >= 2 ? 'Two different prints compete for attention.' : 'Two patterned pieces; keep the rest plain.')
  } else if (busy.length === 1 && worn.length >= 2) notes.push('One print with plain pieces keeps it balanced.')

  // Top and bottom: some light/dark contrast keeps the outfit from looking flat,
  // unless it is a deliberate tonal or matching look.
  const top = worn.find((p) => slotOf(p) === 'top')
  const bottom = worn.find((p) => slotOf(p) === 'bottom')
  const lt = top ? lightness(top) : null
  const lb = bottom ? lightness(bottom) : null
  if (lt !== null && lb !== null) {
    const d = Math.abs(lt - lb)
    if (d >= 25) score += 0.05
    else if (d < 6 && top!.colors[0]?.hex !== bottom!.colors[0]?.hex) score -= 0.08 // nearly-but-not-quite matching
  }

  // Weather sense for colors: dark tops soak up sun; pale bottoms show every splash.
  if (weather) {
    const hot = (weather.feelsLike ?? 0) >= 32
    if (hot && top && lt !== null && lt < 30) {
      score -= 0.1
      notes.push('A dark top absorbs heat; a lighter one would be cooler today.')
    }
    if (isRainy(weather) && bottom && lb !== null && lb > 85) {
      score -= 0.12
      notes.push('Pale bottoms show rain splashes; darker ones are safer today.')
    }
  }

  score -= 0.5 * clashes.length
  return { score: Math.max(0, Math.min(1, score)), clashes, notes }
}
