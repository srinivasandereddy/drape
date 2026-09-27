// "Should I buy this?" Compares a piece you're thinking of buying with your closet:
// how many pieces it goes with, whether you already own something like it, whether
// it suits your coloring, and whether it fits your usual budget. Pure, tested.

import { colorName, hueDistance, hueOf, isNeutral } from './color'
import { harmonyOf } from './harmony'
import { dominantHex, inCloset, type Garment } from './model'
import { SEASONS, type SeasonId } from './personal'
import { slotOf, type Slot } from './slots'

export interface Advice {
  verdict: 'great' | 'good' | 'think'
  /** Pieces in your closet it pairs well with. */
  pairsWith: Garment[]
  /** Roughly how many new outfits it adds. */
  newOutfits: number
  /** Pieces you already own that are very similar. */
  similar: Garment[]
  flatters: boolean | null
  overBudget: boolean | null
  lines: string[]
}

const PARTNERS: Record<Slot, readonly Slot[]> = {
  top: ['bottom'],
  bottom: ['top'],
  onepiece: ['footwear', 'layer'],
  layer: ['top', 'onepiece'],
  footwear: ['bottom', 'onepiece'],
  bag: ['top', 'onepiece'],
  jewellery: [],
  accessory: ['top', 'onepiece'],
}

function sameColorFamily(a: string, b: string): boolean {
  if (isNeutral(a) || isNeutral(b)) return colorName(a) === colorName(b)
  return hueDistance(hueOf(a), hueOf(b)) <= 20
}

export function adviseOnPurchase(candidate: Garment, closet: Garment[], opts: { season?: SeasonId | null; budget?: number | null; price?: number | null } = {}): Advice {
  const owned = closet.filter((g) => inCloset(g) && g.id !== candidate.id && !g.deletedAt)
  const hex = dominantHex(candidate)
  const slot = slotOf(candidate)
  const partners = owned.filter((g) => PARTNERS[slot].includes(slotOf(g)) && dominantHex(g))
  const pairsWith = hex ? partners.filter((g) => harmonyOf([hex, dominantHex(g)!]).score >= 0.7) : []

  // New outfits: pairs it creates, multiplied by the shoes or tops that complete them.
  const shoes = owned.filter((g) => slotOf(g) === 'footwear').length || 1
  const tops = owned.filter((g) => slotOf(g) === 'top').length
  const bottoms = owned.filter((g) => slotOf(g) === 'bottom').length
  const newOutfits =
    slot === 'top' || slot === 'bottom' ? pairsWith.length * Math.min(shoes, 3) : slot === 'onepiece' ? Math.max(1, Math.min(shoes, 3)) : slot === 'footwear' ? Math.min(tops * bottoms, 20) : pairsWith.length

  const similar = owned.filter(
    (g) => slotOf(g) === slot && (g.subtype === candidate.subtype || !candidate.subtype) && hex && dominantHex(g) && sameColorFamily(hex, dominantHex(g)!),
  )

  const season = opts.season ? SEASONS[opts.season] : null
  const name = hex ? colorName(hex) : null
  const flatters = season && name && ['top', 'onepiece', 'layer'].includes(slot) ? (season.best.includes(name) ? true : season.avoid.includes(name) ? false : null) : null
  const overBudget = opts.budget && opts.price ? opts.price > opts.budget * 1.25 : null

  const lines: string[] = []
  if (pairsWith.length) lines.push(`Goes with ${pairsWith.length} piece${pairsWith.length === 1 ? '' : 's'} you own, about ${newOutfits} new outfit${newOutfits === 1 ? '' : 's'}.`)
  else if (PARTNERS[slot].length) lines.push('Doesn’t pair clearly with anything you own yet.')
  if (similar.length) lines.push(`You already have ${similar.length === 1 ? 'something' : `${similar.length} pieces`} very similar.`)
  if (flatters === true && season) lines.push(`${name} flatters your ${season.label} coloring.`)
  if (flatters === false && season) lines.push(`${name} isn’t one of your ${season.label} colors; wear it away from your face.`)
  if (overBudget) lines.push('It costs more than you usually spend on one piece.')

  let verdict: Advice['verdict'] = 'good'
  if (similar.length > 0 || (PARTNERS[slot].length > 0 && pairsWith.length === 0) || flatters === false) verdict = 'think'
  else if (pairsWith.length >= 3 || newOutfits >= 5) verdict = 'great'
  return { verdict, pairsWith, newOutfits, similar, flatters, overBudget, lines }
}
