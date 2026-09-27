// Color harmony: how well a set of garment colors works together, using the
// classic color-wheel rules (monochrome, analogous, complementary, triadic).

import { colorName, hueDistance, hueOf, isNeutral } from './color'

export type HarmonyKind = 'neutral' | 'single' | 'analogous' | 'complementary' | 'triadic' | 'split' | 'clash'

export interface Harmony {
  /** 0..1, higher is better. */
  score: number
  kind: HarmonyKind
  label: string
  /** One plain sentence explaining the verdict. */
  reason: string
}

export const HARMONY_LABELS: Record<HarmonyKind, string> = {
  neutral: 'All neutrals',
  single: 'One color + neutrals',
  analogous: 'Analogous',
  complementary: 'Complementary',
  triadic: 'Triadic',
  split: 'Split contrast',
  clash: 'Busy mix',
}

/** Groups hues that sit within 25° of each other into one "color family". */
function hueFamilies(hues: number[]): number[] {
  const families: number[] = []
  for (const h of hues) {
    if (!families.some((f) => hueDistance(f, h) <= 25)) families.push(h)
  }
  return families
}

/** "Cream, beige and brown": first word capitalised, the rest lower case. */
const joinNames = (names: string[]) => {
  const u = [...new Set(names)].map((n, i) => (i === 0 ? n : n.toLowerCase()))
  return u.length <= 1 ? (u[0] ?? '') : `${u.slice(0, -1).join(', ')} and ${u[u.length - 1]}`
}

/**
 * @param colors the dominant color (hex) of each visible piece
 * @param patternedCount how many of those pieces are patterned (not solid)
 */
export function harmonyOf(colors: string[], patternedCount = 0): Harmony {
  const chromatic = colors.filter((c) => !isNeutral(c))
  const neutralNames = colors.filter(isNeutral).map(colorName)
  const families = hueFamilies(chromatic.map(hueOf))
  const names = chromatic.map(colorName)

  let result: Omit<Harmony, 'label'>
  if (families.length === 0) {
    result = {
      score: 0.88,
      kind: 'neutral',
      reason: neutralNames.length ? `${joinNames(neutralNames)} keep it calm and easy to wear.` : 'Neutral tones keep it calm.',
    }
  } else if (families.length === 1) {
    result = {
      score: 1,
      kind: 'single',
      reason: neutralNames.length
        ? `${joinNames(names)} stands out against ${joinNames(neutralNames).toLowerCase()}.`
        : `Tones of ${joinNames(names).toLowerCase()} give a tidy, tonal look.`,
    }
  } else if (families.length === 2) {
    const d = hueDistance(families[0]!, families[1]!)
    if (d <= 45) result = { score: 0.94, kind: 'analogous', reason: `${joinNames(names)} sit side by side on the color wheel, so they blend.` }
    else if (d >= 150) result = { score: 0.9, kind: 'complementary', reason: `${joinNames(names)} sit opposite each other, so each makes the other pop.` }
    else if (d >= 100) result = { score: 0.72, kind: 'split', reason: `${joinNames(names)} contrast well; keep the rest simple.` }
    else result = { score: 0.45, kind: 'clash', reason: `${joinNames(names)} compete for attention.` }
  } else if (families.length === 3) {
    const [a, b, c] = families as [number, number, number]
    const even = [hueDistance(a, b), hueDistance(b, c), hueDistance(a, c)].every((d) => d >= 90 && d <= 150)
    result = even
      ? { score: 0.7, kind: 'triadic', reason: `${joinNames(names)} are spaced evenly around the wheel, a bold but balanced mix.` }
      : { score: 0.32, kind: 'clash', reason: `Three strong colors (${joinNames(names).toLowerCase()}) make it busy.` }
  } else {
    result = { score: 0.2, kind: 'clash', reason: 'Too many strong colors at once.' }
  }

  if (patternedCount > 1) {
    result = { ...result, score: result.score * 0.8, reason: `${result.reason} Two patterns at once is a lot.` }
  }
  return { ...result, label: HARMONY_LABELS[result.kind] }
}
