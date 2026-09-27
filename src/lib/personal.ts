// Personal coloring and shape: skin tone, undertone, hair, eyes → a color season
// (Spring / Summer / Autumn / Winter) with the colors that flatter, plus simple
// body-shape and fit guidance. Classic image-consulting rules of thumb; a guide, not a verdict.

import type { Pattern } from './catalog'
import { hexToLab } from './color'
import type { GenderKind } from './profile'

export type SkinTone = 'fair' | 'light' | 'medium' | 'tan' | 'deep' | 'rich'
export type Undertone = 'warm' | 'cool' | 'neutral'
export type HairColor = 'black' | 'dark-brown' | 'brown' | 'blonde' | 'red' | 'grey'
export type EyeColor = 'dark-brown' | 'brown' | 'hazel' | 'green' | 'blue' | 'grey'
export type Fit = 'slim' | 'regular' | 'relaxed' | 'oversized'
export type SeasonId = 'spring' | 'summer' | 'autumn' | 'winter'

export const SKIN_TONES: readonly { id: SkinTone; label: string; hex: string }[] = [
  { id: 'fair', label: 'Fair', hex: '#F3D9C6' },
  { id: 'light', label: 'Light', hex: '#E6BF9C' },
  { id: 'medium', label: 'Medium', hex: '#C99A6E' },
  { id: 'tan', label: 'Tan', hex: '#A8764E' },
  { id: 'deep', label: 'Deep', hex: '#7A5236' },
  { id: 'rich', label: 'Rich', hex: '#4E3322' },
]
export const HAIR_COLORS: readonly { id: HairColor; label: string; hex: string }[] = [
  { id: 'black', label: 'Black', hex: '#1E1A18' },
  { id: 'dark-brown', label: 'Dark brown', hex: '#3B2A22' },
  { id: 'brown', label: 'Brown', hex: '#6B4A33' },
  { id: 'blonde', label: 'Blonde', hex: '#C9A45C' },
  { id: 'red', label: 'Red / auburn', hex: '#9A4A2A' },
  { id: 'grey', label: 'Grey / white', hex: '#A5A5A5' },
]
export const EYE_COLORS: readonly { id: EyeColor; label: string; hex: string }[] = [
  { id: 'dark-brown', label: 'Dark brown', hex: '#3A2419' },
  { id: 'brown', label: 'Brown', hex: '#6B4226' },
  { id: 'hazel', label: 'Hazel', hex: '#8E7240' },
  { id: 'green', label: 'Green', hex: '#5E7A4A' },
  { id: 'blue', label: 'Blue', hex: '#4F79A8' },
  { id: 'grey', label: 'Grey', hex: '#8C9398' },
]
export const FITS: readonly { id: Fit; label: string }[] = [
  { id: 'slim', label: 'Slim' },
  { id: 'regular', label: 'Regular' },
  { id: 'relaxed', label: 'Relaxed' },
  { id: 'oversized', label: 'Oversized' },
]

// ---------- undertone helper ----------

export type VeinAnswer = 'green' | 'blue' | 'both'
export type MetalAnswer = 'gold' | 'silver' | 'both'
export type SunAnswer = 'tan' | 'burn' | 'both'

/** Three quick questions → undertone. Majority wins; ties are neutral. */
export function undertoneFrom(veins: VeinAnswer, metal: MetalAnswer, sun: SunAnswer): Undertone {
  let warm = 0
  let cool = 0
  if (veins === 'green') warm++
  if (veins === 'blue') cool++
  if (metal === 'gold') warm++
  if (metal === 'silver') cool++
  if (sun === 'tan') warm++
  if (sun === 'burn') cool++
  return warm >= 2 && warm > cool ? 'warm' : cool >= 2 && cool > warm ? 'cool' : 'neutral'
}

// ---------- color seasons ----------

export interface Season {
  id: SeasonId
  label: string
  summary: string
  /** Palette names (color.ts) that flatter, especially near the face. */
  best: readonly string[]
  /** Palette names that tend to wash out or overpower. */
  avoid: readonly string[]
  metal: 'gold' | 'silver'
}

export const SEASONS: Record<SeasonId, Season> = {
  spring: {
    id: 'spring',
    label: 'Spring',
    summary: 'Warm, light and clear. Fresh, sunny colors light up your face.',
    best: ['Cream', 'Camel', 'Beige', 'Khaki', 'Orange', 'Yellow', 'Mint', 'Green', 'Sky blue', 'Pink', 'Blue'],
    avoid: ['Black', 'Charcoal', 'Maroon', 'Purple'],
    metal: 'gold',
  },
  summer: {
    id: 'summer',
    label: 'Summer',
    summary: 'Cool, soft and gentle. Muted, cool shades suit you best.',
    best: ['Lavender', 'Sky blue', 'Pink', 'Mint', 'Light grey', 'Grey', 'Navy', 'Denim', 'Blue', 'Teal', 'White'],
    avoid: ['Orange', 'Mustard', 'Rust', 'Camel', 'Black'],
    metal: 'silver',
  },
  autumn: {
    id: 'autumn',
    label: 'Autumn',
    summary: 'Warm, rich and earthy. Deep, spicy and golden tones glow on you.',
    best: ['Rust', 'Mustard', 'Olive', 'Camel', 'Brown', 'Dark brown', 'Khaki', 'Teal', 'Maroon', 'Cream', 'Orange', 'Green'],
    avoid: ['Hot pink', 'Lavender', 'Light grey', 'Sky blue', 'Black'],
    metal: 'gold',
  },
  winter: {
    id: 'winter',
    label: 'Winter',
    summary: 'Cool, deep and high-contrast. Bold, clear colors and crisp black and white suit you.',
    best: ['Black', 'White', 'Navy', 'Charcoal', 'Red', 'Hot pink', 'Blue', 'Teal', 'Purple', 'Maroon'],
    avoid: ['Mustard', 'Camel', 'Beige', 'Orange', 'Khaki', 'Rust'],
    metal: 'silver',
  },
}

const L = (hex: string) => hexToLab(hex)[0]

/** Works out the color season. Needs at least skin tone and undertone. */
export function seasonFor(skin: SkinTone | null, undertone: Undertone | null, hair: HairColor | null, eyes: EyeColor | null): SeasonId | null {
  if (!skin || !undertone) return null
  const skinHex = SKIN_TONES.find((s) => s.id === skin)!.hex
  const hairHex = HAIR_COLORS.find((h) => h.id === (hair ?? 'dark-brown'))!.hex
  const contrast = Math.abs(L(skinHex) - L(hairHex)) // how strongly skin and hair differ
  const deep = skin === 'deep' || skin === 'rich' || hair === 'black'
  const lightFeatures = (hair === 'blonde' || hair === 'red' || skin === 'fair' || skin === 'light') && hair !== 'black'
  const lightEyes = eyes === 'blue' || eyes === 'green' || eyes === 'grey' || eyes === 'hazel'
  if (undertone === 'warm') return lightFeatures || (lightEyes && !deep) ? 'spring' : 'autumn'
  if (undertone === 'cool') return contrast > 55 || deep ? 'winter' : 'summer'
  // Neutral: lean on depth and contrast.
  if (contrast > 58) return 'winter'
  if (deep) return 'autumn'
  return lightEyes ? 'summer' : 'autumn'
}

// ---------- body shape ----------

export interface BodyShape {
  id: string
  label: string
  hint: string
  tip: string
  /** Balance rule used in scoring: which half should be lighter or brighter. */
  balance: 'top-lighter' | 'bottom-lighter' | 'even'
}

const FEMININE_SHAPES: BodyShape[] = [
  { id: 'hourglass', label: 'Hourglass', hint: 'Shoulders and hips about equal, defined waist', tip: 'Belts and wrap styles show off your waist.', balance: 'even' },
  { id: 'pear', label: 'Pear', hint: 'Hips wider than shoulders', tip: 'Lighter or brighter tops draw the eye up and balance your hips.', balance: 'top-lighter' },
  { id: 'apple', label: 'Apple', hint: 'Fuller around the middle, slimmer legs', tip: 'V-necks and open layers lengthen; show off your legs.', balance: 'bottom-lighter' },
  { id: 'rectangle', label: 'Rectangle', hint: 'Shoulders, waist and hips similar', tip: 'Belts, layers and peplums add shape.', balance: 'even' },
  { id: 'inverted-triangle', label: 'Inverted triangle', hint: 'Shoulders wider than hips', tip: 'Darker tops and lighter or fuller bottoms balance your shoulders.', balance: 'bottom-lighter' },
]
const MASCULINE_SHAPES: BodyShape[] = [
  { id: 'trapezoid', label: 'Trapezoid', hint: 'Broad shoulders, slightly narrower waist', tip: 'Most cuts suit you; fitted shirts show your frame.', balance: 'even' },
  { id: 'inverted-triangle', label: 'Inverted triangle', hint: 'Very broad shoulders, narrow waist', tip: 'Darker tops and lighter trousers balance your upper body.', balance: 'bottom-lighter' },
  { id: 'rectangle', label: 'Rectangle', hint: 'Shoulders, waist and hips similar', tip: 'Layers and structured shoulders add shape.', balance: 'even' },
  { id: 'triangle', label: 'Triangle', hint: 'Hips or waist wider than shoulders', tip: 'Lighter tops and structured shoulders balance your lower half.', balance: 'top-lighter' },
  { id: 'oval', label: 'Oval', hint: 'Fuller around the middle', tip: 'Open layers and vertical lines lengthen; darker trousers ground the look.', balance: 'top-lighter' },
]

export function bodyShapesFor(gender: GenderKind | null): BodyShape[] {
  if (gender === 'male') return MASCULINE_SHAPES
  if (gender === 'female') return FEMININE_SHAPES
  // Everyone else sees both lists, without repeats.
  return [...FEMININE_SHAPES, ...MASCULINE_SHAPES.filter((m) => !FEMININE_SHAPES.some((f) => f.id === m.id))]
}
export const bodyShapeDef = (id: string | null) => (id ? ([...FEMININE_SHAPES, ...MASCULINE_SHAPES].find((s) => s.id === id) ?? null) : null)

// ---------- what the engine needs ----------

export interface PersonalPrefs {
  season: SeasonId | null
  favoriteColors: string[]
  avoidColors: string[]
  lovePatterns: Pattern[]
  avoidPatterns: Pattern[]
  bodyShape: string | null
}

export const hasPersonal = (p: PersonalPrefs | null | undefined): p is PersonalPrefs =>
  !!p && (!!p.season || p.favoriteColors.length > 0 || p.avoidColors.length > 0 || p.lovePatterns.length > 0 || p.avoidPatterns.length > 0 || !!p.bodyShape)
