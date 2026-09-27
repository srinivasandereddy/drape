// Wardrobe color statistics for the Spectrum screen. Pure functions, tested.

import { colorName, hexToLab, hueOf, isNeutral, temperature } from './color'
import { harmonyOf, type HarmonyKind } from './harmony'
import { dominantHex, inCloset, type Garment } from './model'
import { slotOf, type Slot } from './outfit'

export const HUE_BUCKETS: readonly { id: number; label: string; hue: number }[] = [
  { id: 0, label: 'Red', hue: 0 },
  { id: 1, label: 'Orange', hue: 30 },
  { id: 2, label: 'Yellow', hue: 60 },
  { id: 3, label: 'Lime', hue: 90 },
  { id: 4, label: 'Green', hue: 120 },
  { id: 5, label: 'Teal', hue: 150 },
  { id: 6, label: 'Cyan', hue: 180 },
  { id: 7, label: 'Sky', hue: 210 },
  { id: 8, label: 'Blue', hue: 240 },
  { id: 9, label: 'Violet', hue: 270 },
  { id: 10, label: 'Magenta', hue: 300 },
  { id: 11, label: 'Pink', hue: 330 },
]
export const NEUTRAL_BUCKET = 12

/** 0..11 for a hue family, 12 for neutrals. */
export function bucketOf(hex: string): number {
  if (isNeutral(hex)) return NEUTRAL_BUCKET
  return Math.round(hueOf(hex) / 30) % 12
}

export interface SpectrumStats {
  total: number
  withColors: number
  /** Weighted amount per bucket (index 12 = neutrals). */
  buckets: number[]
  neutralShare: number
  warmShare: number
  coolShare: number
  /** Garments ordered for the palette strip: colors by hue, then neutrals dark to light. */
  strip: { id: string; hex: string }[]
  mostWorn: { name: string; wears: number } | null
  insights: string[]
}

const FAMILY_NAMES: Record<string, number[]> = {
  reds: [0, 11],
  'oranges and rusts': [1],
  yellows: [2],
  greens: [3, 4, 5],
  blues: [6, 7, 8],
  purples: [9, 10],
}

export function spectrumStats(garments: Garment[]): SpectrumStats {
  const colored = garments.filter((g) => g.colors.length > 0)
  const buckets = new Array<number>(13).fill(0)
  let warm = 0
  let cool = 0
  for (const g of colored) {
    for (const c of g.colors) {
      buckets[bucketOf(c.hex)]! += c.share
      const t = temperature(c.hex)
      if (t === 'warm') warm += c.share
      if (t === 'cool') cool += c.share
    }
  }
  const sum = buckets.reduce((a, b) => a + b, 0) || 1

  const strip = colored
    .map((g) => ({ id: g.id, hex: dominantHex(g)! }))
    .sort((a, b) => {
      const na = isNeutral(a.hex)
      const nb = isNeutral(b.hex)
      if (na !== nb) return na ? 1 : -1
      return na ? hexToLab(a.hex)[0] - hexToLab(b.hex)[0] : hueOf(a.hex) - hueOf(b.hex)
    })

  const wearsByName = new Map<string, number>()
  for (const g of colored) {
    const hex = dominantHex(g)
    if (hex && g.wornCount > 0) wearsByName.set(colorName(hex), (wearsByName.get(colorName(hex)) ?? 0) + g.wornCount)
  }
  const top = [...wearsByName.entries()].sort((a, b) => b[1] - a[1])[0]

  const insights: string[] = []
  const neutralShare = buckets[NEUTRAL_BUCKET]! / sum
  if (colored.length >= 5) {
    if (neutralShare >= 0.75) insights.push('Your wardrobe is mostly neutrals. One or two colored pieces would give outfits more life.')
    else if (neutralShare <= 0.25) insights.push('You have lots of color but few neutrals. A few plain black, white, navy or beige basics would make pieces easier to combine.')
    const missingFamilies = Object.entries(FAMILY_NAMES)
      .filter(([, ids]) => ids.every((i) => buckets[i]! === 0))
      .map(([name]) => name)
    if (missingFamilies.length > 0 && missingFamilies.length < 6) insights.push(`Nothing yet in ${missingFamilies.slice(0, 3).join(', ')}.`)
    if (warm + cool > 0) {
      const warmShare = warm / (warm + cool)
      if (warmShare >= 0.7) insights.push('Your colors lean warm (reds, oranges, yellows).')
      else if (warmShare <= 0.3) insights.push('Your colors lean cool (blues, greens, purples).')
    }
  }
  if (garments.length > colored.length) insights.push(`${garments.length - colored.length} piece(s) have no colors yet.`)

  return {
    total: garments.length,
    withColors: colored.length,
    buckets,
    neutralShare,
    warmShare: warm / sum,
    coolShare: cool / sum,
    strip,
    mostWorn: top ? { name: top[0], wears: top[1] } : null,
    insights,
  }
}

// ---------- color wheel matcher ----------

/** Which slots pair naturally with a piece in the given slot. */
const PARTNERS: Record<Slot, readonly Slot[]> = {
  top: ['bottom', 'layer', 'footwear'],
  bottom: ['top', 'layer', 'footwear'],
  onepiece: ['layer', 'footwear', 'bag'],
  layer: ['top', 'bottom', 'onepiece'],
  footwear: ['top', 'bottom', 'onepiece'],
  bag: ['top', 'bottom', 'onepiece'],
  jewellery: [],
  accessory: ['top', 'bottom', 'onepiece'],
}

export const MATCH_GROUPS: readonly { kind: HarmonyKind; label: string; hint: string }[] = [
  { kind: 'complementary', label: 'Complementary', hint: 'Opposite on the wheel, each makes the other stand out' },
  { kind: 'analogous', label: 'Analogous', hint: 'Neighbors on the wheel, they blend smoothly' },
  { kind: 'single', label: 'With neutrals', hint: 'A safe, polished pairing' },
  { kind: 'neutral', label: 'All neutrals', hint: 'Calm and easy' },
  { kind: 'split', label: 'Bold contrast', hint: 'Works if the rest stays simple' },
]

export interface Match {
  garment: Garment
  kind: HarmonyKind
  score: number
}

/** Pieces from the closet that pair well with `piece`, grouped by harmony type. */
export function matchesFor(piece: Garment, garments: Garment[]): Match[] {
  const hex = dominantHex(piece)
  if (!hex) return []
  const partners = PARTNERS[slotOf(piece)]
  return garments
    .filter((g) => g.id !== piece.id && inCloset(g) && partners.includes(slotOf(g)) && dominantHex(g))
    .map((g) => {
      const h = harmonyOf([hex, dominantHex(g)!])
      return { garment: g, kind: h.kind, score: h.score }
    })
    .filter((m) => m.score >= 0.7)
    .sort((a, b) => b.score - a.score)
}

export type WheelMode = 'complementary' | 'monochromatic' | 'analogous' | 'triadic'
export const WHEEL_MODES: readonly { id: WheelMode; label: string; hint: string }[] = [
  { id: 'complementary', label: 'Complementary', hint: 'The opposite color: bold contrast' },
  { id: 'monochromatic', label: 'Monochromatic', hint: 'Lighter and darker shades of one color' },
  { id: 'analogous', label: 'Analogous', hint: 'Neighbors on the wheel: smooth and calm' },
  { id: 'triadic', label: 'Triadic', hint: 'Three evenly spaced colors: playful' },
]

/** The hues that complete a harmony with `hue` in the given mode. */
export function modeHues(mode: WheelMode, hue: number): number[] {
  const at = (d: number) => (((hue + d) % 360) + 360) % 360
  switch (mode) {
    case 'complementary':
      return [at(180)]
    case 'monochromatic':
      return [at(0)]
    case 'analogous':
      return [at(-30), at(30)]
    case 'triadic':
      return [at(120), at(240)]
  }
}

/** Pieces whose main color sits near one of `hues` (chromatic colors only). */
export function piecesNearHues(garments: Garment[], hues: number[], excludeId: string | null, tolerance = 25): Garment[] {
  return garments.filter((g) => {
    if (g.id === excludeId) return false
    const hex = dominantHex(g)
    if (!hex || isNeutral(hex)) return false
    const h = hueOf(hex)
    return hues.some((t) => hueDistanceDeg(h, t) <= tolerance)
  })
}

const hueDistanceDeg = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

/** Positions on the wheel that harmonize with a hue. */
export function harmonyAngles(hue: number) {
  return {
    complementary: (hue + 180) % 360,
    analogous: [(hue + 330) % 360, (hue + 30) % 360] as const,
    triadic: [(hue + 120) % 360, (hue + 240) % 360] as const,
  }
}

