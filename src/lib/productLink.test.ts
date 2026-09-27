import { describe, expect, it } from 'vitest'
import { colorName } from './color'
import { findUrl, readProductLink } from './productLink'

describe('reading shop links', () => {
  it('Myntra: brand, type and color from the path', () => {
    const r = readProductLink('https://www.myntra.com/tshirts/roadster/roadster-men-navy-blue-pure-cotton-t-shirt/1996777/buy')!
    expect(r).toMatchObject({ store: 'Myntra', brand: 'Roadster' })
    expect(r.item.draft).toMatchObject({ category: 'top', subtype: 'T-shirt', fabric: 'cotton' })
    expect(colorName(r.item.draft.colors[0]!.hex)).toBe('Navy')
  })
  it('Amazon, Flipkart, AJIO and Zara', () => {
    expect(readProductLink('https://www.amazon.in/Levis-Mens-Slim-Jeans-18298-0425/dp/B07HKF6Y1D')!).toMatchObject({ store: 'Amazon', brand: 'Levis', item: { draft: { subtype: 'Jeans' } } })
    const fk = readProductLink('https://www.flipkart.com/roadster-men-solid-round-neck-cotton-blend-black-t-shirt/p/itm4a8b1b1b?pid=TSHFW')!
    expect(fk.item.draft).toMatchObject({ subtype: 'T-shirt', fabric: 'cotton' })
    expect(colorName(fk.item.draft.colors[0]!.hex)).toBe('Black')
    expect(readProductLink('https://www.ajio.com/dnmx-washed-slim-fit-jeans/p/441124570_blue')!.item.draft.subtype).toBe('Jeans')
    expect(readProductLink('https://www.zara.com/in/en/linen-blend-shirt-p04310456.html')!).toMatchObject({ store: 'Zara', brand: 'Zara', item: { draft: { subtype: 'Shirt', fabric: 'linen' } } })
  })
  it('uses the shared title when the link has no words (H&M)', () => {
    const shared = 'Relaxed Fit Linen-blend shirt - Beige - Men | H&M IN https://www2.hm.com/en_in/productpage.1234567001.html'
    const r = readProductLink(shared)!
    expect(r.store).toBe('H&M')
    expect(r.item.draft).toMatchObject({ subtype: 'Shirt', fabric: 'linen' })
    expect(colorName(r.item.draft.colors[0]!.hex)).toBe('Beige')
  })
  it('finds a link inside shared text, and rejects non-links', () => {
    expect(findUrl('Look at this https://www.myntra.com/x/y/z/1/buy!')).toBe('https://www.myntra.com/x/y/z/1/buy')
    expect(readProductLink('not a link')).toBeNull()
    expect(readProductLink('https://example.com/')!.item.recognised).toBe(false)
  })
})
