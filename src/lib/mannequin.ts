// A drawn mannequin shaped by a person's height, weight and gender, and the
// shapes of the clothes on it. Pure geometry (SVG path strings), so it is tested
// without a browser. It is a styling preview, not a fit or size guide.

import type { GenderKind } from './profile'

export const VIEW_W = 200
export const VIEW_H = 440

export interface Body {
  /** Figure height in view units. */
  H: number
  top: number
  cx: number
  shoulder: number
  chest: number
  waist: number
  hip: number
  thigh: number
  knee: number
  ankle: number
  arm: number
  /** Key heights (y) down the figure. */
  y: { head: number; chin: number; shoulder: number; chest: number; waist: number; hip: number; crotch: number; knee: number; ankle: number; floor: number; elbow: number; wrist: number }
  /** Explains what shaped the figure. */
  basis: string
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x))

export function bodyFor(heightCm: number | null, weightKg: number | null, gender: GenderKind | null): Body {
  const h = heightCm ?? (gender === 'female' ? 160 : gender === 'male' ? 172 : 166)
  const w = weightKg ?? (gender === 'female' ? 57 : gender === 'male' ? 70 : 63)
  const bmi = w / (h / 100) ** 2
  const width = clamp(0.8 + (bmi - 18) / 20, 0.8, 1.4)
  const shape = gender === 'female' ? { s: 0.9, c: 0.95, wa: 0.82, hi: 1.08 } : gender === 'male' ? { s: 1.08, c: 1.04, wa: 0.94, hi: 0.95 } : { s: 1, c: 1, wa: 0.88, hi: 1 }
  const H = 400 * clamp(h / 172, 0.82, 1.12)
  const top = VIEW_H - 16 - H
  const at = (f: number) => top + f * H
  const basis = heightCm && weightKg ? `${heightCm} cm, ${weightKg} kg` : heightCm ? `${heightCm} cm` : 'average proportions'
  return {
    H,
    top,
    cx: VIEW_W / 2,
    shoulder: 36 * shape.s * (0.85 + width * 0.15),
    chest: 30 * shape.c * width,
    waist: 25 * shape.wa * width,
    hip: 31 * shape.hi * width,
    thigh: 14 * width,
    knee: 9.5 * (0.85 + width * 0.15),
    ankle: 6,
    arm: 7 * (0.8 + width * 0.2),
    y: {
      head: at(0.065),
      chin: at(0.125),
      shoulder: at(0.18),
      chest: at(0.27),
      waist: at(0.4),
      hip: at(0.5),
      crotch: at(0.53),
      knee: at(0.74),
      ankle: at(0.955),
      floor: at(1),
      elbow: at(0.37),
      wrist: at(0.52),
    },
    basis,
  }
}

const f = (n: number) => Math.round(n * 10) / 10
const poly = (pts: [number, number][]) => `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`

// ---------- the bare figure ----------

export function bodyPaths(b: Body) {
  const { cx, y } = b
  const torso = poly([
    [cx - b.shoulder, y.shoulder + 4],
    [cx - b.chest, y.chest],
    [cx - b.waist, y.waist],
    [cx - b.hip, y.hip],
    [cx - b.hip + 2, y.crotch],
    [cx + b.hip - 2, y.crotch],
    [cx + b.hip, y.hip],
    [cx + b.waist, y.waist],
    [cx + b.chest, y.chest],
    [cx + b.shoulder, y.shoulder + 4],
    [cx + 8, y.shoulder - 2],
    [cx - 8, y.shoulder - 2],
  ])
  const leg = (side: -1 | 1) =>
    poly([
      [cx + side * 1.5, y.crotch - 4],
      [cx + side * b.hip, y.hip],
      [cx + side * (b.thigh + 6), y.knee],
      [cx + side * (b.ankle + 5), y.ankle],
      [cx + side * 3, y.ankle],
      [cx + side * 3, y.knee],
    ])
  const arm = (side: -1 | 1) => {
    const sx = cx + side * b.shoulder
    return poly([
      [sx - side * 2, y.shoulder + 2],
      [sx + side * b.arm, y.shoulder + 8],
      [sx + side * (b.arm + 4), y.elbow],
      [sx + side * (b.arm + 7), y.wrist],
      [sx + side * 4, y.wrist],
      [sx - side * 1, y.elbow],
      [sx - side * 4, y.chest],
    ])
  }
  const neck = poly([
    [cx - 7, y.chin - 2],
    [cx + 7, y.chin - 2],
    [cx + 9, y.shoulder],
    [cx - 9, y.shoulder],
  ])
  return { torso, legs: [leg(-1), leg(1)], arms: [arm(-1), arm(1)], neck, head: { cx, cy: y.head, r: b.H * 0.058 } }
}

// ---------- clothes ----------

export type Shape = { d: string; layer: number; kind: 'fill' | 'line'; tone?: 'main' | 'accent' | 'dark' }

const EASE = 1.08

function topShape(b: Body, length: number, sleeves: 'none' | 'short' | 'long', flare = 0): string[] {
  const { cx, y } = b
  const bottom = b.top + length * b.H
  const wAt = (yy: number) => {
    // Body width at a height, with a little room.
    if (yy <= y.chest) return b.chest
    if (yy <= y.waist) return b.chest + ((b.waist - b.chest) * (yy - y.chest)) / (y.waist - y.chest)
    if (yy <= y.hip) return b.waist + ((b.hip - b.waist) * (yy - y.waist)) / (y.hip - y.waist)
    return b.hip + flare * ((yy - y.hip) / (y.knee - y.hip))
  }
  const hemW = wAt(bottom) * EASE + 2
  const body = poly([
    [cx - b.shoulder * 1.02, y.shoulder + 3],
    [cx - b.chest * EASE, y.chest],
    [cx - wAt(Math.min(bottom, y.waist)) * EASE, Math.min(bottom, y.waist)],
    [cx - hemW, bottom],
    [cx + hemW, bottom],
    [cx + wAt(Math.min(bottom, y.waist)) * EASE, Math.min(bottom, y.waist)],
    [cx + b.chest * EASE, y.chest],
    [cx + b.shoulder * 1.02, y.shoulder + 3],
    [cx + 9, y.shoulder - 1],
    [cx, y.shoulder + 6],
    [cx - 9, y.shoulder - 1],
  ])
  const out = [body]
  if (sleeves !== 'none') {
    const end = sleeves === 'short' ? y.shoulder + (y.elbow - y.shoulder) * 0.5 : y.wrist - 2
    for (const side of [-1, 1] as const) {
      const sx = cx + side * b.shoulder
      const t = (end - y.shoulder) / (y.wrist - y.shoulder)
      out.push(
        poly([
          [sx - side * 3, y.shoulder + 1],
          [sx + side * (b.arm + 2), y.shoulder + 7],
          [sx + side * (b.arm + 3 + 6 * t), end],
          [sx + side * (2 + 3 * t), end],
          [sx - side * 3, y.chest],
        ]),
      )
    }
  }
  return out
}

function trouserShape(b: Body, to: 'ankle' | 'knee' | 'thigh', wide = 0): string[] {
  const { cx, y } = b
  const end = to === 'ankle' ? y.ankle - 1 : to === 'knee' ? y.knee - 4 : y.hip + (y.knee - y.hip) * 0.35
  const t = (end - y.hip) / (y.ankle - y.hip)
  const waist = poly([
    [cx - b.waist * EASE, y.waist],
    [cx + b.waist * EASE, y.waist],
    [cx + b.hip * EASE, y.hip],
    [cx + 1, y.crotch],
    [cx - 1, y.crotch],
    [cx - b.hip * EASE, y.hip],
  ])
  const leg = (side: -1 | 1) => {
    const outer = b.hip * EASE + (b.ankle + 6 + wide - b.hip * EASE) * t
    return poly([
      [cx + side * 0.5, y.crotch - 3],
      [cx + side * b.hip * EASE, y.hip],
      [cx + side * (outer + 1), end],
      [cx + side * Math.max(2, 3 - wide / 3), end],
    ])
  }
  return [waist, leg(-1), leg(1)]
}

function skirtShape(b: Body, from: number, to: number, flare: number): string {
  const { cx } = b
  const topW = from <= b.y.waist + 1 ? b.waist * EASE : b.hip * EASE
  return poly([
    [cx - topW, from],
    [cx + topW, from],
    [cx + b.hip * EASE + flare, to],
    [cx - b.hip * EASE - flare, to],
  ])
}

function layerShape(b: Body, length: number, sleeveless = false): string[] {
  const { cx, y } = b
  const bottom = b.top + length * b.H
  const out: string[] = []
  for (const side of [-1, 1] as const) {
    out.push(
      poly([
        [cx + side * 4, y.shoulder + 4],
        [cx + side * (b.shoulder * 1.08), y.shoulder + 2],
        [cx + side * (b.chest * 1.16), y.chest],
        [cx + side * (Math.max(b.waist, b.hip) * 1.18 + (length > 0.6 ? 6 : 0)), bottom],
        [cx + side * 3, bottom],
        [cx + side * 2, y.chest + 10],
      ]),
    )
    if (!sleeveless) {
      const sx = cx + side * b.shoulder
      out.push(
        poly([
          [sx - side * 4, y.shoulder],
          [sx + side * (b.arm + 3), y.shoulder + 6],
          [sx + side * (b.arm + 9), y.wrist - 1],
          [sx + side * 3, y.wrist - 1],
          [sx - side * 4, y.chest],
        ]),
      )
    }
  }
  return out
}

function shoeShape(b: Body, kind: string): string[] {
  const { cx, y } = b
  const out: string[] = []
  for (const side of [-1, 1] as const) {
    const x0 = cx + side * 3
    const x1 = cx + side * (b.ankle + 13)
    const top = kind === 'Boots' ? y.ankle - 16 : kind === 'Heels' ? y.ankle - 2 : y.ankle - 4
    const floor = y.floor
    if (kind === 'Sandals' || kind === 'Slippers' || kind === 'Kolhapuris') {
      out.push(poly([[x0, floor - 3], [x1, floor - 3], [x1, floor], [x0, floor]]))
      out.push(poly([[x0 + side * 2, floor - 9], [x1 - side * 3, floor - 5], [x1 - side * 3, floor - 3], [x0 + side * 2, floor - 7]]))
    } else if (kind === 'Heels') {
      out.push(poly([[x0, top], [x0 + side * 6, top], [x1, floor - 2], [x1 - side * 2, floor], [x0 + side * 2, floor - 4], [x0 + side * 1, floor]]))
    } else {
      out.push(poly([[x0, top], [x0 + side * 8, top + 1], [x1, floor - 6], [x1 + side * 1, floor], [x0, floor]]))
    }
  }
  return out
}

/** The clothing shapes for one garment on this body, drawn in its color. */
export function garmentShapes(b: Body, category: string, subtype: string): Shape[] {
  const S = (ds: string[], layer: number, tone: Shape['tone'] = 'main'): Shape[] => ds.map((d) => ({ d, layer, kind: 'fill', tone }))
  const { y, cx } = b
  const L = (yy: number) => (yy - b.top) / b.H
  switch (category) {
    case 'top': {
      if (subtype === 'Sports bra') return S(topShape(b, L(y.chest + 16), 'none'), 3)
      if (subtype === 'Crop top') return S(topShape(b, L(y.waist - 6), 'short'), 3)
      if (subtype === 'Tank top') return S(topShape(b, L(y.hip + 4), 'none'), 3)
      const long = ['Shirt', 'Blouse', 'Sweater', 'Hoodie'].includes(subtype)
      return S(topShape(b, L(y.hip + (subtype === 'Hoodie' || subtype === 'Sweater' ? 6 : 10)), long ? 'long' : 'short'), 3)
    }
    case 'bottom': {
      if (subtype === 'Shorts') return S(trouserShape(b, 'thigh', 3), 2)
      if (subtype === 'Skirt') return S([skirtShape(b, y.waist, y.knee + 4, 10)], 2)
      if (subtype === 'Dhoti') return S(trouserShape(b, 'ankle', 10), 2)
      if (subtype === 'Leggings') return S(trouserShape(b, 'ankle', -2), 2)
      return S(trouserShape(b, 'ankle', subtype === 'Joggers' ? 0 : 2), 2)
    }
    case 'outerwear': {
      if (subtype === 'Coat' || subtype === 'Raincoat') return S(layerShape(b, L(y.knee + 6)), 5)
      if (subtype === 'Cardigan') return S(layerShape(b, L(y.hip + 8)), 5)
      return S(layerShape(b, L(y.hip + 12)), 5)
    }
    case 'dress': {
      const toAnkle = subtype === 'Formal dress'
      if (subtype === 'Jumpsuit' || subtype === 'Co-ord set') return [...S(topShape(b, L(y.waist + 4), 'short'), 3), ...S(trouserShape(b, 'ankle', 3), 2)]
      return [...S(topShape(b, L(y.waist + 2), 'none'), 3), ...S([skirtShape(b, y.waist, toAnkle ? y.ankle - 2 : y.knee + 6, toAnkle ? 16 : 12)], 3)]
    }
    case 'ethnic': {
      if (subtype === 'Kurta' || subtype === 'Kurti') return S(topShape(b, L(y.knee - (subtype === 'Kurti' ? 12 : 0)), 'long', 8), 3)
      if (subtype === 'Nehru jacket') return S(layerShape(b, L(y.hip + 10), true), 5)
      if (subtype === 'Dhoti') return S(trouserShape(b, 'ankle', 10), 2)
      if (subtype === 'Dupatta') return [{ d: `M${f(cx - b.shoulder)} ${f(y.shoulder)}Q${f(cx)} ${f(y.chest + 16)} ${f(cx + b.shoulder)} ${f(y.shoulder)}`, layer: 6, kind: 'line', tone: 'main' }]
      if (subtype === 'Saree') {
        return [
          ...S(topShape(b, L(y.chest + 14), 'short'), 3, 'accent'),
          ...S([skirtShape(b, y.waist - 4, y.ankle - 1, 12)], 3),
          ...S([poly([[cx - b.chest, y.waist + 4], [cx - b.chest + 10, y.waist - 2], [cx + b.shoulder, y.shoulder + 2], [cx + b.shoulder - 8, y.shoulder + 10]])], 4),
        ]
      }
      if (subtype === 'Lehenga') return [...S(topShape(b, L(y.chest + 16), 'short'), 3, 'accent'), ...S([skirtShape(b, y.waist, y.ankle - 1, 30)], 3)]
      if (subtype === 'Salwar suit') return [...S(trouserShape(b, 'ankle', 4), 2, 'accent'), ...S(topShape(b, L(y.knee), 'long', 10), 3)]
      if (subtype === 'Sherwani') return [...S(trouserShape(b, 'ankle', 0), 2, 'accent'), ...S(topShape(b, L(y.knee + 4), 'long', 6), 3)]
      return S(topShape(b, L(y.knee), 'long', 8), 3)
    }
    case 'footwear':
      return S(shoeShape(b, subtype), 7)
    case 'bag': {
      if (subtype === 'Backpack') return [{ d: `M${f(cx - b.chest + 4)} ${f(y.shoulder + 2)}L${f(cx - b.chest + 2)} ${f(y.waist)}M${f(cx + b.chest - 4)} ${f(y.shoulder + 2)}L${f(cx + b.chest - 2)} ${f(y.waist)}`, layer: 8, kind: 'line', tone: 'main' }]
      const bx = cx + b.hip + 8
      const strap = { d: `M${f(cx - b.shoulder + 6)} ${f(y.shoulder + 2)}L${f(bx)} ${f(y.hip - 6)}`, layer: 8, kind: 'line' as const, tone: 'dark' as const }
      const size = subtype === 'Clutch' ? 8 : subtype === 'Tote' || subtype === 'Laptop bag' ? 20 : 14
      return [...(subtype === 'Clutch' ? [] : [strap]), { d: poly([[bx - size / 2, y.hip - 6], [bx + size / 2 + 4, y.hip - 6], [bx + size / 2 + 6, y.hip + size], [bx - size / 2 - 2, y.hip + size]]), layer: 8, kind: 'fill', tone: 'main' }]
    }
    case 'jewellery': {
      const r = b.H * 0.058
      if (subtype === 'Necklace') return [{ d: `M${f(cx - 10)} ${f(y.shoulder)}Q${f(cx)} ${f(y.shoulder + 16)} ${f(cx + 10)} ${f(y.shoulder)}`, layer: 9, kind: 'line', tone: 'main' }]
      if (subtype === 'Earrings') return [-1, 1].map((s) => ({ d: `M${f(cx + s * r)} ${f(y.head + 2)}l0 5`, layer: 9, kind: 'line' as const, tone: 'main' as const }))
      if (subtype === 'Watch' || subtype === 'Bracelet' || subtype === 'Bangles') {
        const sx = cx - b.shoulder - b.arm - 6
        return [{ d: poly([[sx - 1, y.wrist - 10], [sx + 8, y.wrist - 10], [sx + 8, y.wrist - 6], [sx - 1, y.wrist - 6]]), layer: 9, kind: 'fill', tone: 'main' }]
      }
      return []
    }
    case 'accessory': {
      const r = b.H * 0.058
      if (subtype === 'Sunglasses') return [{ d: `M${f(cx - r * 0.8)} ${f(y.head)}h${f(r * 0.7)}M${f(cx + r * 0.1)} ${f(y.head)}h${f(r * 0.7)}`, layer: 9, kind: 'line', tone: 'main' }]
      if (subtype === 'Cap / hat') return [{ d: `M${f(cx - r - 2)} ${f(y.head - r * 0.35)}Q${f(cx)} ${f(y.head - r * 1.5)} ${f(cx + r + 2)} ${f(y.head - r * 0.35)}Z`, layer: 9, kind: 'fill', tone: 'main' }]
      if (subtype === 'Belt') return [{ d: poly([[cx - b.waist * EASE, y.waist + 1], [cx + b.waist * EASE, y.waist + 1], [cx + b.waist * EASE, y.waist + 6], [cx - b.waist * EASE, y.waist + 6]]), layer: 6, kind: 'fill', tone: 'main' }]
      if (subtype === 'Scarf') return [{ d: poly([[cx - 12, y.shoulder - 3], [cx + 12, y.shoulder - 3], [cx + 10, y.shoulder + 6], [cx + 4, y.chest + 20], [cx - 2, y.chest + 20], [cx - 10, y.shoulder + 6]]), layer: 6, kind: 'fill', tone: 'main' }]
      if (subtype === 'Tie') return [{ d: poly([[cx - 3, y.shoulder + 4], [cx + 3, y.shoulder + 4], [cx + 5, y.waist - 8], [cx, y.waist - 2], [cx - 5, y.waist - 8]]), layer: 4, kind: 'fill', tone: 'main' }]
      return []
    }
    default:
      return []
  }
}
