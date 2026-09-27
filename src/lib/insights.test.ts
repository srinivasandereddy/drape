import { describe, expect, it } from 'vitest'
import { closetInsights } from './insights'
import { createGarment, emptyDraft, type Garment } from './model'

const NOW = new Date('2026-09-27T09:00:00Z')
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString()
let n = 0
function g(patch: Partial<Garment> & { added?: number; worn?: number | null }): Garment {
  const { added = 10, worn = null, ...rest } = patch
  const base = createGarment({ ...emptyDraft(), category: 'top', subtype: 'T-shirt' }, null, new Date(NOW.getTime() - added * 86_400_000 + n++))
  return { ...base, lastWornAt: worn === null ? null : daysAgo(worn), ...rest }
}

describe('closet insights', () => {
  it('counts usage, value and cost per wear', () => {
    const favourite = g({ price: 1000, wornCount: 20, worn: 2 })
    const pricey = g({ price: 6000, wornCount: 1, worn: 40 })
    const old = g({ added: 200, worn: 150, wornCount: 1 })
    const never = g({ added: 120 })
    const wash = g({ status: 'laundry', worn: 1, wornCount: 3 })
    const gone = g({ status: 'retired', price: 999 })
    const wish = g({ status: 'wishlist', price: 2500 })
    const i = closetInsights([favourite, pricey, old, never, wash, gone, wish], NOW)
    expect(i.owned).toBe(5) // donated and wishlist pieces don't count as owned
    expect(i.worn30).toBe(2) // favourite and the one in the wash
    expect(i.totalValue).toBe(7000)
    expect(i.bestValue[0]!.g).toBe(favourite)
    expect(i.bestValue[0]!.cpw).toBe(50)
    expect(i.worstValue[0]!.g).toBe(pricey)
    expect(i.mostWorn[0]).toBe(favourite)
    expect(i.neverWorn).toContain(never)
    expect(i.forgotten).toEqual(expect.arrayContaining([old, never]))
    expect(i.clearOut).toEqual(expect.arrayContaining([old, never]))
    expect(i.clearOut).not.toContain(favourite)
  })
  it('handles an empty closet', () => {
    const i = closetInsights([], NOW)
    expect(i).toMatchObject({ owned: 0, usage: 0, totalValue: null })
  })
})
