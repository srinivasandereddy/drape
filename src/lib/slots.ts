// Where a garment goes in an outfit. Kept apart so every module can use it
// without importing the whole outfit engine.

import type { Garment } from './model'

export type Slot = 'top' | 'bottom' | 'onepiece' | 'layer' | 'footwear' | 'jewellery' | 'bag' | 'accessory'
export const SLOT_ORDER: readonly Slot[] = ['layer', 'top', 'onepiece', 'bottom', 'footwear', 'bag', 'jewellery', 'accessory']
/** Pieces people see at a glance; these decide color harmony and dress code. */
export const VISIBLE: readonly Slot[] = ['top', 'bottom', 'onepiece', 'layer', 'footwear']
export const CLOTHING: readonly Slot[] = ['top', 'bottom', 'onepiece', 'layer']
export const MAIN: readonly Slot[] = ['top', 'bottom', 'onepiece']

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
