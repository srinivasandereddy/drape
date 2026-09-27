import { describe, expect, it } from 'vitest'
import { adviseOnPurchase } from './advisor'
import { createGarment, emptyDraft, type Garment, type GarmentDraft } from './model'

let n = 0
function g(patch: Partial<GarmentDraft> & { hex: string; status?: Garment['status'] }): Garment {
  const { hex, status, ...d } = patch
  return { ...createGarment({ ...emptyDraft(), category: 'top', ...d }, null, new Date(1_700_000_000_000 + n++)), colors: [{ hex, share: 1 }], status: status ?? 'available' }
}

describe('shopping advisor', () => {
  const closet = [
    g({ category: 'bottom', subtype: 'Jeans', hex: '#3E5C82' }),
    g({ category: 'bottom', subtype: 'Chinos', hex: '#D8C4A2' }),
    g({ category: 'bottom', subtype: 'Trousers', hex: '#1B1B1D' }),
    g({ category: 'footwear', subtype: 'Sneakers', hex: '#F4F4F1' }),
    g({ subtype: 'T-shirt', hex: '#F4F4F1' }),
  ]
  it('recommends a versatile piece that suits you', () => {
    const rust = g({ subtype: 'Shirt', hex: '#B5502D' })
    const a = adviseOnPurchase(rust, closet, { season: 'autumn' })
    expect(a.verdict).toBe('great')
    expect(a.pairsWith).toHaveLength(3)
    expect(a.flatters).toBe(true)
    expect(a.lines.join(' ')).toMatch(/Goes with 3 pieces/)
  })
  it('warns about near-duplicates, unflattering colors and price', () => {
    const anotherWhiteTee = g({ subtype: 'T-shirt', hex: '#F2F2EE' })
    const a = adviseOnPurchase(anotherWhiteTee, closet, { budget: 1000, price: 2000 })
    expect(a.verdict).toBe('think')
    expect(a.similar).toHaveLength(1)
    expect(a.overBudget).toBe(true)
    const lavender = g({ subtype: 'Shirt', hex: '#B8A6DA' })
    expect(adviseOnPurchase(lavender, closet, { season: 'autumn' }).flatters).toBe(false)
  })
  it('ignores wishlist and donated pieces when comparing', () => {
    const wish = g({ subtype: 'T-shirt', hex: '#F4F4F1', status: 'wishlist' })
    const tee = g({ subtype: 'T-shirt', hex: '#1F2A44' })
    expect(adviseOnPurchase(tee, [...closet, wish]).similar).toHaveLength(0)
  })
})
