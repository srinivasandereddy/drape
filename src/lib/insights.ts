// Closet statistics: what gets worn, what it costs per wear, and what could go.
// Pure functions, tested.

import { inCloset, type Garment } from './model'
import { slotOf } from './slots'

const DAY = 86_400_000

export interface ClosetInsights {
  owned: number
  worn30: number
  /** Share of owned clothes worn in the last 30 days, 0..1. */
  usage: number
  totalValue: number | null
  priced: number
  mostWorn: Garment[]
  neverWorn: Garment[]
  /** Owned for 60+ days and not worn in 60+ days (or never). */
  forgotten: Garment[]
  /** Worn least and owned longest: candidates to donate or sell. */
  clearOut: Garment[]
  bestValue: { g: Garment; cpw: number }[]
  worstValue: { g: Garment; cpw: number }[]
  bySlot: { slot: string; count: number }[]
}

const daysSince = (iso: string | null, now: Date) => (iso ? (now.getTime() - Date.parse(iso)) / DAY : Infinity)
const CLOTHES = new Set(['top', 'bottom', 'onepiece', 'layer', 'footwear'])

export function closetInsights(garments: Garment[], now: Date = new Date()): ClosetInsights {
  const owned = garments.filter((g) => !g.deletedAt && inCloset(g))
  const clothes = owned.filter((g) => CLOTHES.has(slotOf(g)))
  const worn30 = clothes.filter((g) => daysSince(g.lastWornAt, now) <= 30).length
  const priced = owned.filter((g) => g.price !== null)
  const cpw = priced.map((g) => ({ g, cpw: g.price! / Math.max(1, g.wornCount) }))
  const forgotten = clothes
    .filter((g) => daysSince(g.createdAt, now) >= 60 && daysSince(g.lastWornAt, now) >= 60)
    .sort((a, b) => (a.lastWornAt ?? '') < (b.lastWornAt ?? '') ? -1 : 1)
  const clearOut = forgotten.filter((g) => daysSince(g.createdAt, now) >= 90 && g.wornCount <= 2).slice(0, 10)
  const slots = new Map<string, number>()
  for (const g of owned) slots.set(slotOf(g), (slots.get(slotOf(g)) ?? 0) + 1)
  return {
    owned: owned.length,
    worn30,
    usage: clothes.length ? worn30 / clothes.length : 0,
    totalValue: priced.length ? priced.reduce((s, g) => s + g.price!, 0) : null,
    priced: priced.length,
    mostWorn: [...clothes].filter((g) => g.wornCount > 0).sort((a, b) => b.wornCount - a.wornCount).slice(0, 5),
    neverWorn: clothes.filter((g) => g.wornCount === 0),
    forgotten: forgotten.slice(0, 12),
    clearOut,
    bestValue: [...cpw].filter((c) => c.g.wornCount > 0).sort((a, b) => a.cpw - b.cpw).slice(0, 3),
    worstValue: [...cpw].sort((a, b) => b.cpw - a.cpw).slice(0, 3),
    bySlot: [...slots.entries()].map(([slot, count]) => ({ slot, count })).sort((a, b) => b.count - a.count),
  }
}
