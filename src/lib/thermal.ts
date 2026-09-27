// The Outfit Thermal Index, 1 (dress light and breathable) to 5 (dress warm, add a layer).
// It combines three things: how the weather feels, your body's tendency (dosha),
// and how you say you feel today.

import { DOSHA_GUIDE, type DoshaId } from './dosha'

export type Feeling = 'warm' | 'neutral' | 'cold'

export const FEELING_LABELS: Record<Feeling, string> = { warm: 'Warm', neutral: 'Neutral', cold: 'Cool / cold' }

export const THERMAL_LABELS: Record<number, string> = {
  1: 'Light and breathable',
  2: 'Light layers',
  3: 'Medium weight',
  4: 'Warm, with a layer',
  5: 'Bundle up',
}

export interface Thermal {
  index: 1 | 2 | 3 | 4 | 5
  /** Garment warmth to aim for, 1 light … 3 warm. */
  idealWarmth: number
  needsLayer: boolean
  /** Plain-language reasons, for "Why this works". */
  reasons: string[]
}

export interface ThermalInput {
  feelsLike: number | null
  rainy: boolean
  dosha: DoshaId | null
  feeling: Feeling | null
  /** From "Don't like: too warm / too cold" feedback today. */
  shift?: number
}

export function thermalIndex({ feelsLike, rainy, dosha, feeling, shift = 0 }: ThermalInput): Thermal {
  const reasons: string[] = []
  // 32°C feels → 1, 25.5 → 2, 19 → 3, 12.5 → 4, 6 → 5
  let value = feelsLike === null ? 3 : 1 + (32 - feelsLike) / 6.5
  if (feelsLike !== null) reasons.push(`feels like ${Math.round(feelsLike)}°C`)
  if (dosha) {
    let d = DOSHA_GUIDE[dosha].thermalShift
    if (dosha === 'kapha' && rainy) d += 0.25
    value += d
    reasons.push(d > 0 ? `${DOSHA_GUIDE[dosha].label} runs cool` : `${DOSHA_GUIDE[dosha].label} runs warm`)
  }
  if (feeling === 'warm') {
    value -= 1
    reasons.push('you feel warm today')
  } else if (feeling === 'cold') {
    value += 1
    reasons.push('you feel cold today')
  }
  value += shift
  const index = Math.max(1, Math.min(5, Math.round(value))) as Thermal['index']
  return { index, idealWarmth: 1 + (index - 1) / 2, needsLayer: index >= 4, reasons }
}
