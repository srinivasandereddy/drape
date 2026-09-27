// Love it / Don't like feedback: what each reason changes today, and what Drape
// learns for the future. Stored per account; pure scoring helpers are tested.

import type { Garment } from './model'
import { slotOf } from './slots'

export type Verdict = 'love' | 'dislike'
export type DislikeReason = 'too-formal' | 'too-casual' | 'too-warm' | 'too-cold' | 'wrong-style' | 'colors' | 'no-heels' | 'worn-recently' | 'other'

export const DISLIKE_REASONS: readonly { id: DislikeReason; label: string }[] = [
  { id: 'too-formal', label: 'Too formal' },
  { id: 'too-casual', label: 'Too casual' },
  { id: 'too-warm', label: 'Too warm for today' },
  { id: 'too-cold', label: 'Too cold for today' },
  { id: 'wrong-style', label: 'Not my style' },
  { id: 'colors', label: "Don't like the colors together" },
  { id: 'no-heels', label: "Don't want heels today" },
  { id: 'worn-recently', label: 'Wore these recently' },
  { id: 'other', label: 'Something else' },
]

export interface FeedbackRecord {
  id: string
  date: string
  garmentIds: string[]
  verdict: Verdict
  reason: DislikeReason | null
  note: string
  createdAt: string
  /** Set when deleted, so the delete syncs to other phones. */
  deletedAt?: string | null
}

/** Changes that apply for the rest of today after a "Don't like". */
export interface DayAdjust {
  formalityShift: number
  thermalShift: number
  avoidIds: string[]
  avoidSubtypes: string[]
  avoidPairs: string[]
}

export const NO_ADJUST: DayAdjust = { formalityShift: 0, thermalShift: 0, avoidIds: [], avoidSubtypes: [], avoidPairs: [] }

export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)

const MAIN = new Set(['top', 'bottom', 'onepiece', 'layer', 'footwear'])

function mainPairs(pieces: Garment[]): string[] {
  const mains = pieces.filter((p) => MAIN.has(slotOf(p)))
  const out: string[] = []
  for (let i = 0; i < mains.length; i++) for (let j = i + 1; j < mains.length; j++) out.push(pairKey(mains[i]!.id, mains[j]!.id))
  return out
}

export function applyDislike(adj: DayAdjust, reason: DislikeReason, pieces: Garment[]): DayAdjust {
  const next: DayAdjust = { ...adj, avoidIds: [...adj.avoidIds], avoidSubtypes: [...adj.avoidSubtypes], avoidPairs: [...adj.avoidPairs] }
  const mains = pieces.filter((p) => ['top', 'bottom', 'onepiece'].includes(slotOf(p)))
  switch (reason) {
    case 'too-formal':
      next.formalityShift = Math.max(-2, next.formalityShift - 1)
      break
    case 'too-casual':
      next.formalityShift = Math.min(2, next.formalityShift + 1)
      break
    case 'too-warm':
      next.thermalShift = Math.max(-2, next.thermalShift - 1)
      break
    case 'too-cold':
      next.thermalShift = Math.min(2, next.thermalShift + 1)
      break
    case 'no-heels':
      if (!next.avoidSubtypes.includes('Heels')) next.avoidSubtypes.push('Heels')
      break
    case 'wrong-style':
    case 'worn-recently':
      for (const m of mains) if (!next.avoidIds.includes(m.id)) next.avoidIds.push(m.id)
      break
    case 'colors':
    case 'other':
      for (const k of mainPairs(pieces)) if (!next.avoidPairs.includes(k)) next.avoidPairs.push(k)
      break
  }
  return next
}

/** What past feedback says about pieces and pairings: positive = liked. */
export interface Affinity {
  pairs: Map<string, number>
  pieces: Map<string, number>
}

export function learnAffinity(records: FeedbackRecord[], byId: Map<string, Garment>): Affinity {
  const pairs = new Map<string, number>()
  const pieces = new Map<string, number>()
  const bump = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v)
  for (const r of records) {
    const garments = r.garmentIds.map((id) => byId.get(id)).filter((g): g is Garment => !!g)
    if (r.verdict === 'love') {
      for (const k of mainPairs(garments)) bump(pairs, k, 1)
      for (const g of garments) bump(pieces, g.id, 0.5)
    } else if (r.reason === 'wrong-style') {
      for (const g of garments.filter((x) => ['top', 'bottom', 'onepiece'].includes(slotOf(x)))) bump(pieces, g.id, -0.5)
    } else if (r.reason === 'colors' || r.reason === 'other') {
      for (const k of mainPairs(garments)) bump(pairs, k, -1)
    }
    // Weather, dress-code and "worn recently" reasons are about the day, not taste.
  }
  return { pairs, pieces }
}

/** Score points (−8 … +8) from learned taste for a set of pieces. */
export function affinityPoints(pieces: Garment[], a: Affinity | null): { points: number; loved: boolean } {
  if (!a) return { points: 0, loved: false }
  let pts = 0
  let loved = false
  for (const k of mainPairs(pieces)) {
    const v = Math.max(-2, Math.min(2, a.pairs.get(k) ?? 0))
    pts += 3 * v
    if (v > 0) loved = true
  }
  for (const p of pieces) pts += Math.max(-1, Math.min(1, a.pieces.get(p.id) ?? 0))
  return { points: Math.max(-8, Math.min(8, pts)), loved }
}
