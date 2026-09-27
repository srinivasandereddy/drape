import { describe, expect, it } from 'vitest'
import { CATEGORIES } from './catalog'
import { bodyFor, garmentShapes, VIEW_H } from './mannequin'

describe('mannequin', () => {
  it('follows height and weight', () => {
    const short = bodyFor(150, 50, 'female')
    const tall = bodyFor(190, 80, 'male')
    expect(tall.H).toBeGreaterThan(short.H)
    expect(tall.y.floor).toBeLessThanOrEqual(VIEW_H)
    expect(bodyFor(170, 95, null).waist).toBeGreaterThan(bodyFor(170, 55, null).waist)
    expect(bodyFor(null, null, null).basis).toBe('average proportions')
    expect(bodyFor(165, 60, 'female').hip).toBeGreaterThan(bodyFor(165, 60, 'male').hip)
    expect(bodyFor(165, 60, 'male').shoulder).toBeGreaterThan(bodyFor(165, 60, 'female').shoulder)
  })
  it('draws every clothing and shoe type, inside the frame', () => {
    const b = bodyFor(170, 65, 'other')
    for (const c of CATEGORIES) {
      for (const sub of c.subtypes) {
        const shapes = garmentShapes(b, c.id, sub)
        if (['top', 'bottom', 'outerwear', 'dress', 'ethnic', 'footwear'].includes(c.id)) expect(shapes.length, `${c.id}/${sub}`).toBeGreaterThan(0)
        for (const s of shapes) {
          expect(s.d).not.toMatch(/NaN|Infinity/)
          const ys = [...s.d.matchAll(/-?\d+(\.\d+)?/g)].map((m) => Number(m[0]))
          expect(Math.max(...ys)).toBeLessThanOrEqual(VIEW_H + 1)
        }
      }
    }
  })
})
