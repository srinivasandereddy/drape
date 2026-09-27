import { describe, expect, it } from 'vitest'
import { findGarment } from './cutout'

/** A w×h RGBA image: noisy background, with a shape drawn by `inside(x, y)`. */
function img(w: number, h: number, bg: [number, number, number], fg: [number, number, number], inside: (x: number, y: number) => boolean, noise = 6) {
  const d = new Uint8ClampedArray(w * h * 4)
  let seed = 1
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 2 * noise
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = inside(x, y) ? fg : bg
      d.set([c[0] + rnd(), c[1] + rnd(), c[2] + rnd(), 255], (y * w + x) * 4)
    }
  return d
}
// A t-shirt shape: body plus two sleeves.
const tee = (w: number, h: number) => (x: number, y: number) =>
  (x > w * 0.3 && x < w * 0.7 && y > h * 0.2 && y < h * 0.85) || (y > h * 0.2 && y < h * 0.38 && x > w * 0.12 && x < w * 0.88)

describe('background removal', () => {
  it('cuts a navy tee out of a beige bedsheet', () => {
    const m = findGarment(img(120, 120, [216, 200, 170], [31, 42, 68], tee(120, 120)), 120, 120)!
    expect(m).not.toBeNull()
    expect(m.coverage).toBeGreaterThan(0.25)
    expect(m.coverage).toBeLessThan(0.45)
    expect(m.data[60 * 120 + 60]).toBe(1) // centre of the shirt
    expect(m.data[5 * 120 + 5]).toBe(0) // corner of the sheet
    expect(m.box.x).toBeGreaterThanOrEqual(13)
    expect(m.box.x).toBeLessThanOrEqual(16)
  })
  it('keeps a light print inside the garment', () => {
    const w = 100
    const d = img(w, w, [240, 240, 236], [180, 60, 40], tee(w, w))
    // White logo in the middle of the rust shirt, the same color as the wall.
    for (let y = 45; y < 55; y++) for (let x = 45; x < 55; x++) d.set([240, 240, 236, 255], (y * w + x) * 4)
    const m = findGarment(d, w, w)!
    expect(m.data[50 * w + 50]).toBe(1)
  })
  it('handles a two-tone background (bed and floor)', () => {
    const w = 100
    const d = img(w, w, [216, 200, 170], [40, 120, 70], tee(w, w))
    for (let y = 70; y < w; y++) for (let x = 0; x < w; x++) if (!tee(w, w)(x, y)) d.set([120, 90, 60, 255], (y * w + x) * 4)
    expect(findGarment(d, w, w)).not.toBeNull()
  })
  it('gives up when the garment fills the photo or nothing stands out', () => {
    expect(findGarment(img(60, 60, [31, 42, 68], [31, 42, 68], () => true), 60, 60)).toBeNull()
    expect(findGarment(img(60, 60, [200, 200, 200], [200, 200, 200], () => false), 60, 60)).toBeNull()
  })
})
