// A drawn mannequin shaped by a person's height, weight and gender, and the
// shapes of the clothes on it. Pure geometry (SVG path strings), so it is tested
// without a browser. It is a styling preview, not a fit or size guide.

import type { GenderKind } from './profile'

export const VIEW_W = 200
export const VIEW_H = 440

type Figure = 'masculine' | 'feminine' | 'neutral'

export interface Body {
  figure: Figure
  /** Figure height in view units. */
  H: number
  top: number
  cx: number
  /** Half-widths at each level. */
  shoulder: number
  chest: number
  waist: number
  hip: number
  thigh: number
  knee: number
  ankle: number
  /** Arm thickness at the shoulder. */
  arm: number
  neck: number
  headR: number
  /** How far the arms angle out from the body (A-pose), in view units at the wrist. */
  spread: number
  y: { head: number; chin: number; shoulder: number; chest: number; waist: number; hip: number; crotch: number; knee: number; ankle: number; floor: number; elbow: number; wrist: number }
  /** Explains what shaped the figure. */
  basis: string
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x))

export function bodyFor(heightCm: number | null, weightKg: number | null, gender: GenderKind | null): Body {
  const figure: Figure = gender === 'male' ? 'masculine' : gender === 'female' ? 'feminine' : 'neutral'
  const h = heightCm ?? (figure === 'feminine' ? 160 : figure === 'masculine' ? 172 : 166)
  const w = weightKg ?? (figure === 'feminine' ? 57 : figure === 'masculine' ? 70 : 63)
  const bmi = w / (h / 100) ** 2
  const size = clamp(0.8 + (bmi - 18) / 20, 0.8, 1.4)
  // Clear silhouettes: V-shaped and straight for masculine, hourglass for feminine.
  const shape =
    figure === 'masculine'
      ? { shoulder: 41, chest: 33, waist: 28.5, hip: 28, thigh: 15, arm: 8.5, neck: 9, head: 0.057 }
      : figure === 'feminine'
        ? { shoulder: 32, chest: 28, waist: 21, hip: 32, thigh: 15, arm: 6.2, neck: 6.5, head: 0.058 }
        : { shoulder: 36, chest: 30, waist: 24.5, hip: 30, thigh: 14.5, arm: 7.2, neck: 7.5, head: 0.058 }
  const H = 400 * clamp(h / 172, 0.82, 1.12)
  const top = VIEW_H - 16 - H
  const at = (f: number) => top + f * H
  const basis = heightCm && weightKg ? `${heightCm} cm, ${weightKg} kg` : heightCm ? `${heightCm} cm` : 'average proportions'
  // Width grows with size, a little more at the waist than the shoulders.
  return {
    figure,
    H,
    top,
    cx: VIEW_W / 2,
    shoulder: shape.shoulder * (0.88 + size * 0.12),
    chest: shape.chest * (0.75 + size * 0.25),
    waist: shape.waist * size,
    hip: shape.hip * (0.7 + size * 0.3),
    thigh: shape.thigh * (0.7 + size * 0.3),
    knee: 9.5 * (0.85 + size * 0.15),
    ankle: figure === 'masculine' ? 6.5 : 5.5,
    arm: shape.arm * (0.75 + size * 0.25),
    neck: shape.neck,
    headR: H * shape.head,
    spread: H * 0.07,
    y: {
      head: at(0.065),
      chin: at(0.125),
      shoulder: at(0.18),
      chest: at(0.27),
      waist: at(figure === 'feminine' ? 0.39 : 0.41),
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

/**
 * A closed outline through these points with rounded corners, so cloth and body
 * curve like the real thing. Points listed in `sharp` keep a crisp corner (hems, cuffs).
 */
export function smooth(pts: [number, number][], sharp: readonly number[] = []): string {
  const n = pts.length
  const k = 0.42 // how far along each edge the rounding starts
  let d = ''
  for (let i = 0; i < n; i++) {
    const v = pts[i]!
    const p = pts[(i - 1 + n) % n]!
    const q = pts[(i + 1) % n]!
    if (sharp.includes(i)) {
      d += `${i ? 'L' : 'M'}${f(v[0])} ${f(v[1])}`
      continue
    }
    const a: [number, number] = [v[0] + (p[0] - v[0]) * k, v[1] + (p[1] - v[1]) * k]
    const b: [number, number] = [v[0] + (q[0] - v[0]) * k, v[1] + (q[1] - v[1]) * k]
    d += `${i ? 'L' : 'M'}${f(a[0])} ${f(a[1])}Q${f(v[0])} ${f(v[1])} ${f(b[0])} ${f(b[1])}`
  }
  return `${d}Z`
}
const line = (pts: [number, number][]) => `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}`
const curve = (a: [number, number], c: [number, number], b: [number, number]) => `M${f(a[0])} ${f(a[1])}Q${f(c[0])} ${f(c[1])} ${f(b[0])} ${f(b[1])}`

/** A point on an arm's centre line: t = 0 at the shoulder, 1 at the wrist. */
function armAt(b: Body, side: -1 | 1, t: number): [number, number] {
  const x0 = b.cx + side * (b.shoulder - b.arm * 0.2)
  const y0 = b.y.shoulder + 5
  return [x0 + side * b.spread * t, y0 + (b.y.wrist - y0) * t]
}
/** Arm half-thickness at t, plus extra room for a sleeve. */
const armW = (b: Body, t: number, ease = 0) => b.arm * (1 - 0.45 * t) + ease

/** A band around the arm from t0 to t1 (a sleeve, or the bare arm). */
function armBand(b: Body, side: -1 | 1, t0: number, t1: number, ease = 0, shoulderCap = true, rounded = false): string {
  const [ax, ay] = armAt(b, side, t0)
  const [bx, by] = armAt(b, side, t1)
  // Perpendicular to the arm direction.
  const dx = bx - ax
  const dy = by - ay
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  const w0 = armW(b, t0, ease)
  const w1 = armW(b, t1, ease)
  const pts: [number, number][] = [
    [ax + nx * w0, ay + ny * w0],
    [bx + nx * w1, by + ny * w1],
    [bx - nx * w1, by - ny * w1],
    [ax - nx * w0, ay - ny * w0],
  ]
  if (shoulderCap && t0 === 0) pts.push([b.cx + side * (b.shoulder - b.arm - 2), b.y.shoulder + 2])
  // Sleeves get a rounded shoulder and crisp cuffs.
  return rounded ? smooth(pts, [1, 2]) : poly(pts)
}

// ---------- the bare figure ----------

export function bodyPaths(b: Body) {
  const { cx, y } = b
  const torso = smooth([
    [cx - b.neck - 1, y.shoulder - 3],
    [cx - b.shoulder + 3, y.shoulder],
    [cx - b.shoulder, y.shoulder + 6],
    [cx - b.chest, y.chest],
    [cx - b.waist, y.waist],
    [cx - b.hip, y.hip],
    [cx - b.hip + 2, y.crotch],
    [cx + b.hip - 2, y.crotch],
    [cx + b.hip, y.hip],
    [cx + b.waist, y.waist],
    [cx + b.chest, y.chest],
    [cx + b.shoulder, y.shoulder + 6],
    [cx + b.shoulder - 3, y.shoulder],
    [cx + b.neck + 1, y.shoulder - 3],
  ], [6, 7])
  const leg = (side: -1 | 1) =>
    smooth([
      [cx + side * 1.5, y.crotch - 4],
      [cx + side * b.hip, y.hip],
      [cx + side * (b.thigh + 5), (y.hip + y.knee) / 2],
      [cx + side * (b.knee + 4), y.knee],
      [cx + side * (b.ankle + 4), y.ankle],
      [cx + side * 2.5, y.ankle],
      [cx + side * 2.5, y.knee],
    ], [0, 4, 5])
  const arms = [-1, 1].map((s) => armBand(b, s as -1 | 1, 0, 1))
  const hands = [-1, 1].map((s) => {
    const [hx, hy] = armAt(b, s as -1 | 1, 1.06)
    return { cx: hx, cy: hy, r: b.arm * 0.62 }
  })
  const neck = poly([
    [cx - b.neck + 1, y.chin - 3],
    [cx + b.neck - 1, y.chin - 3],
    [cx + b.neck + 1, y.shoulder],
    [cx - b.neck - 1, y.shoulder],
  ])
  const r = b.headR
  const hair =
    b.figure === 'masculine'
      ? // Short hair: a cap over the top of the head.
        `M${f(cx - r - 0.5)} ${f(y.head + r * 0.1)}Q${f(cx - r)} ${f(y.head - r * 1.25)} ${f(cx)} ${f(y.head - r * 1.08)}Q${f(cx + r)} ${f(y.head - r * 1.25)} ${f(cx + r + 0.5)} ${f(y.head + r * 0.1)}Q${f(cx + r * 0.7)} ${f(y.head - r * 0.55)} ${f(cx)} ${f(y.head - r * 0.62)}Q${f(cx - r * 0.7)} ${f(y.head - r * 0.55)} ${f(cx - r - 0.5)} ${f(y.head + r * 0.1)}Z`
      : b.figure === 'feminine'
        ? // Long hair falling behind the shoulders.
          `M${f(cx - r * 1.08)} ${f(y.head)}Q${f(cx - r * 1.2)} ${f(y.head - r * 1.3)} ${f(cx)} ${f(y.head - r * 1.12)}Q${f(cx + r * 1.2)} ${f(y.head - r * 1.3)} ${f(cx + r * 1.08)} ${f(y.head)}L${f(cx + r * 1.15)} ${f(y.shoulder + 14)}Q${f(cx)} ${f(y.shoulder + 20)} ${f(cx - r * 1.15)} ${f(y.shoulder + 14)}Z`
        : null
  return { torso, legs: [leg(-1), leg(1)], arms, hands, neck, head: { cx, cy: y.head, r }, hair, hairBehind: b.figure === 'feminine' }
}

// ---------- clothes ----------

/** 'fill' is cloth, 'line' a strap or chain, 'detail' a seam, fold or edge drawn thin over the cloth. */
export type Shape = { d: string; layer: number; kind: 'fill' | 'line' | 'detail'; tone?: 'main' | 'accent' | 'dark' }

const EASE = 1.08

type Sleeves = 'none' | 'short' | 'elbow' | 'long'
const SLEEVE_T: Record<Exclude<Sleeves, 'none'>, number> = { short: 0.3, elbow: 0.55, long: 0.98 }

function sleevesFor(b: Body, sleeves: Sleeves, ease: number): string[] {
  if (sleeves === 'none') return []
  return [-1, 1].map((s) => armBand(b, s as -1 | 1, 0, SLEEVE_T[sleeves], ease, true, true))
}

function bodyWidthAt(b: Body, yy: number, flare = 0): number {
  const { y } = b
  if (yy <= y.chest) return b.chest
  if (yy <= y.waist) return b.chest + ((b.waist - b.chest) * (yy - y.chest)) / (y.waist - y.chest)
  if (yy <= y.hip) return b.waist + ((b.hip - b.waist) * (yy - y.waist)) / (y.hip - y.waist)
  return b.hip + flare * ((yy - y.hip) / (y.knee - y.hip))
}

function topShape(b: Body, bottom: number, sleeves: Sleeves, flare = 0, loose = 1): string[] {
  const { cx, y } = b
  const e = EASE * loose
  const midY = Math.min(bottom, y.waist)
  const hemW = Math.max(bodyWidthAt(b, bottom, flare) * e + 2, b.figure === 'masculine' ? b.chest * 0.98 : 0)
  const body = smooth([
    [cx - b.neck - 2, y.shoulder - 3],
    [cx - b.shoulder * 1.05, y.shoulder - 0.5],
    [cx - b.chest * e, y.chest],
    [cx - bodyWidthAt(b, midY) * e, midY],
    [cx - hemW, bottom],
    [cx + hemW, bottom],
    [cx + bodyWidthAt(b, midY) * e, midY],
    [cx + b.chest * e, y.chest],
    [cx + b.shoulder * 1.05, y.shoulder - 0.5],
    [cx + b.neck + 2, y.shoulder - 3],
    [cx, y.shoulder + 7],
  ], [0, 4, 5, 9])
  return [...sleevesFor(b, sleeves, 1.8 * loose), body]
}

function trouserShape(b: Body, to: 'ankle' | 'knee' | 'thigh', wide = 0): string[] {
  const { cx, y } = b
  const end = to === 'ankle' ? y.ankle - 1 : to === 'knee' ? y.knee - 4 : y.hip + (y.knee - y.hip) * 0.35
  const t = (end - y.hip) / (y.ankle - y.hip)
  const hipW = Math.max(b.hip, b.waist) * EASE
  // Outer edge narrows from the hip towards the hem (or flares for wide legs).
  const outerAt = (tt: number) => hipW + (b.ankle + 5 + wide - hipW) * tt
  const kneeT = (y.knee - y.hip) / (y.ankle - y.hip)
  const hasKnee = end > y.knee + 4
  const inner = Math.max(1.5, 2.5 - wide / 4)
  // One continuous outline: waistband, down the outside of one leg, up the
  // inside to the crotch, down the other leg and back up to the waist.
  const pts: [number, number][] = []
  const sharp: number[] = []
  const add = (p: [number, number], isSharp = false) => {
    if (isSharp) sharp.push(pts.length)
    pts.push(p)
  }
  add([cx - b.waist * EASE, y.waist], true)
  add([cx - hipW, y.hip])
  if (hasKnee) add([cx - outerAt(kneeT) - (wide > 6 ? 0 : 1.5), y.knee])
  add([cx - outerAt(t) - 1, end], true)
  add([cx - inner, end], true)
  if (hasKnee) add([cx - inner - 1, y.knee])
  add([cx, y.crotch + 1], true)
  if (hasKnee) add([cx + inner + 1, y.knee])
  add([cx + inner, end], true)
  add([cx + outerAt(t) + 1, end], true)
  if (hasKnee) add([cx + outerAt(kneeT) + (wide > 6 ? 0 : 1.5), y.knee])
  add([cx + hipW, y.hip])
  add([cx + b.waist * EASE, y.waist], true)
  return [smooth(pts, sharp)]
}

function skirtShape(b: Body, from: number, to: number, flare: number): string {
  const { cx } = b
  const topW = bodyWidthAt(b, from) * EASE
  const hipY = Math.min(to, Math.max(from + 6, b.y.hip))
  // Fitted at the hip, then falling out to the hem.
  return smooth([
    [cx - topW, from],
    [cx + topW, from],
    [cx + b.hip * EASE + flare * 0.15, hipY],
    [cx + b.hip * EASE + flare, to],
    [cx, to + 1.5],
    [cx - b.hip * EASE - flare, to],
    [cx - b.hip * EASE - flare * 0.15, hipY],
  ], [0, 1, 3, 5])
}

function layerShape(b: Body, bottom: number, sleeveless = false): string[] {
  const { cx, y } = b
  const out: string[] = sleeveless ? [] : sleevesFor(b, 'long', 3.5)
  for (const side of [-1, 1] as const) {
    out.push(
      smooth([
        [cx + side * (b.neck + 1), y.shoulder - 2],
        [cx + side * (b.shoulder * 1.07), y.shoulder + 2],
        [cx + side * (b.chest * 1.16), y.chest],
        [cx + side * (bodyWidthAt(b, Math.min(bottom, y.waist)) * 1.16), Math.min(bottom, y.waist)],
        [cx + side * (Math.max(b.waist, b.hip) * 1.18 + (bottom > y.knee - 20 ? 6 : 0)), bottom],
        [cx + side * 3, bottom],
        [cx + side * 2, y.chest + 12],
      ], [0, 4, 5, 6]),
    )
  }
  return out
}

function shoeShape(b: Body, kind: string): string[] {
  const { cx, y } = b
  const out: string[] = []
  for (const side of [-1, 1] as const) {
    const x0 = cx + side * 2.5
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

/** Seams, edges and folds that make flat shapes read as clothes. */
/** Tops that can be worn tucked into trousers or a skirt. */
const TUCKABLE = new Set(['Shirt', 'Polo', 'Blouse', 'T-shirt', 'Sports tee'])

export interface Wear {
  /** Tucked into the bottoms (smart looks, or when a belt shows). */
  tucked?: boolean
}

function details(b: Body, category: string, subtype: string, wear: Wear): string[] {
  const { cx, y } = b
  const neckV = (depth: number) => line([[cx - b.neck - 2, y.shoulder - 3], [cx, y.shoulder + depth], [cx + b.neck + 2, y.shoulder - 3]])
  const crew = curve([cx - b.neck - 2, y.shoulder - 3], [cx, y.shoulder + 6], [cx + b.neck + 2, y.shoulder - 3])
  const hemFolds = (from: number, to: number, spread: number) =>
    [-0.45, 0, 0.45].map((k) => curve([cx + k * spread * 0.4, from], [cx + k * spread * 0.8 + 2, (from + to) / 2], [cx + k * spread, to - 1]))
  const legCrease = (end: number) => [-1, 1].map((s) => line([[cx + s * (b.thigh * 0.55 + 2), y.hip + 8], [cx + s * (b.ankle + 3), end - 2]]))
  const waistband = line([[cx - b.waist * EASE, y.waist + 4], [cx + b.waist * EASE, y.waist + 4]])
  switch (category) {
    case 'top':
      if (subtype === 'Shirt' || subtype === 'Blouse' || subtype === 'Polo') {
        return [neckV(10), line([[cx, y.shoulder + 10], [cx, wear.tucked ? y.waist + 2 : y.hip + 8]]), ...(subtype === 'Polo' ? [] : [line([[cx - b.neck - 3, y.shoulder - 2], [cx - 3, y.shoulder + 8]]), line([[cx + b.neck + 3, y.shoulder - 2], [cx + 3, y.shoulder + 8]])])]
      }
      if (subtype === 'Hoodie') return [curve([cx - b.neck - 5, y.shoulder - 4], [cx, y.shoulder + 14], [cx + b.neck + 5, y.shoulder - 4]), line([[cx - b.chest * 0.5, y.waist + 2], [cx + b.chest * 0.5, y.waist + 2]])]
      return [crew]
    case 'bottom':
      if (subtype === 'Skirt') return [waistband, ...hemFolds(y.hip, y.knee + 4, b.hip)]
      if (subtype === 'Shorts' || subtype === 'Leggings') return [waistband]
      return [waistband, line([[cx, y.waist + 4], [cx, y.crotch - 4]]), ...legCrease(y.ankle)]
    case 'outerwear':
      return [line([[cx - b.neck - 1, y.shoulder - 2], [cx - b.chest * 0.45, y.chest + 2], [cx - 2, y.chest + 12]]), line([[cx + b.neck + 1, y.shoulder - 2], [cx + b.chest * 0.45, y.chest + 2], [cx + 2, y.chest + 12]])]
    case 'dress':
      if (subtype === 'Jumpsuit' || subtype === 'Co-ord set') return [crew, waistband, ...legCrease(y.ankle)]
      return [crew, line([[cx - b.waist * EASE, y.waist + 2], [cx + b.waist * EASE, y.waist + 2]]), ...hemFolds(y.hip, subtype === 'Formal dress' ? y.ankle - 2 : y.knee + 6, b.hip + 12)]
    case 'ethnic':
      if (subtype === 'Kurta' || subtype === 'Kurti' || subtype === 'Sherwani' || subtype === 'Salwar suit') return [line([[cx, y.shoulder + 2], [cx, y.chest + 14]]), crew, ...hemFolds(y.hip + 6, subtype === 'Kurti' ? y.knee - 12 : y.knee, b.hip + 8)]
      if (subtype === 'Lehenga' || subtype === 'Saree') return hemFolds(y.hip, y.ankle - 1, b.hip + 20)
      return []
    default:
      return []
  }
}

/** The clothing shapes for one garment on this body, drawn in its color. */
export function garmentShapes(b: Body, category: string, subtype: string, wear: Wear = {}): Shape[] {
  const w = { tucked: wear.tucked === true && category === 'top' && TUCKABLE.has(subtype) }
  const all = garmentFills(b, category, subtype, w)
  if (!all.length) return all
  const top = Math.max(...all.map((s) => s.layer))
  return [...all, ...details(b, category, subtype, w).map((d): Shape => ({ d, layer: top + 0.5, kind: 'detail', tone: 'dark' }))]
}

/** Whether a top should be drawn tucked in: smart outfits, or when a belt is worn. */
export function tuckedLook(pieces: readonly { category: string; subtype: string; formality: number }[]): boolean {
  const top = pieces.find((p) => p.category === 'top')
  const bottom = pieces.find((p) => p.category === 'bottom')
  if (!top || !bottom || !TUCKABLE.has(top.subtype) || bottom.subtype === 'Joggers' || bottom.subtype === 'Leggings') return false
  const belt = pieces.some((p) => p.category === 'accessory' && p.subtype === 'Belt')
  return belt || (top.formality >= 3 && top.subtype !== 'T-shirt' && top.subtype !== 'Sports tee')
}

function garmentFills(b: Body, category: string, subtype: string, wear: Wear): Shape[] {
  const S = (ds: string[], layer: number, tone: Shape['tone'] = 'main'): Shape[] => ds.map((d) => ({ d, layer, kind: 'fill', tone }))
  const { y, cx } = b
  switch (category) {
    case 'top': {
      // Tucked: ends just below the waistband, and sits under the bottoms.
      if (wear.tucked) return S(topShape(b, y.waist + 8, subtype === 'Shirt' || subtype === 'Blouse' ? 'long' : 'short'), 1)
      if (subtype === 'Sports bra') return S(topShape(b, y.chest + 16, 'none'), 3)
      if (subtype === 'Crop top') return S(topShape(b, y.waist - 6, 'short'), 3)
      if (subtype === 'Tank top') return S(topShape(b, y.hip + 4, 'none'), 3)
      if (subtype === 'Hoodie' || subtype === 'Sweater') return S(topShape(b, y.hip + 6, 'long', 0, 1.06), 3)
      if (subtype === 'Shirt' || subtype === 'Blouse') return S(topShape(b, y.hip + 10, 'long'), 3)
      return S(topShape(b, y.hip + 10, 'short'), 3)
    }
    case 'bottom': {
      if (subtype === 'Shorts') return S(trouserShape(b, 'thigh', 3), 2)
      if (subtype === 'Skirt') return S([skirtShape(b, y.waist, y.knee + 4, 10)], 2)
      if (subtype === 'Dhoti') return S(trouserShape(b, 'ankle', 10), 2)
      if (subtype === 'Leggings') return S(trouserShape(b, 'ankle', -2), 2)
      return S(trouserShape(b, 'ankle', subtype === 'Joggers' ? 0 : 2), 2)
    }
    case 'outerwear': {
      if (subtype === 'Coat' || subtype === 'Raincoat') return S(layerShape(b, y.knee + 6), 5)
      if (subtype === 'Cardigan') return S(layerShape(b, y.hip + 8), 5)
      return S(layerShape(b, y.hip + 12), 5)
    }
    case 'dress': {
      const toAnkle = subtype === 'Formal dress'
      if (subtype === 'Jumpsuit' || subtype === 'Co-ord set') return [...S(topShape(b, y.waist + 4, 'short'), 3), ...S(trouserShape(b, 'ankle', 3), 2)]
      return [...S(topShape(b, y.waist + 2, 'none'), 3), ...S([skirtShape(b, y.waist, toAnkle ? y.ankle - 2 : y.knee + 6, toAnkle ? 16 : 12)], 3)]
    }
    case 'ethnic': {
      if (subtype === 'Kurta' || subtype === 'Kurti') return S(topShape(b, subtype === 'Kurti' ? y.knee - 12 : y.knee, 'long', 8), 3)
      if (subtype === 'Nehru jacket') return S(layerShape(b, y.hip + 10, true), 5)
      if (subtype === 'Dhoti') return S(trouserShape(b, 'ankle', 10), 2)
      if (subtype === 'Dupatta') return [{ d: `M${f(cx - b.shoulder)} ${f(y.shoulder)}Q${f(cx)} ${f(y.chest + 16)} ${f(cx + b.shoulder)} ${f(y.shoulder)}`, layer: 6, kind: 'line', tone: 'main' }]
      if (subtype === 'Saree') {
        return [
          ...S(topShape(b, y.chest + 14, 'short'), 3, 'accent'),
          ...S([skirtShape(b, y.waist - 4, y.ankle - 1, 12)], 3),
          ...S([poly([[cx - b.chest, y.waist + 4], [cx - b.chest + 10, y.waist - 2], [cx + b.shoulder, y.shoulder + 2], [cx + b.shoulder - 8, y.shoulder + 10]])], 4),
        ]
      }
      if (subtype === 'Lehenga') return [...S(topShape(b, y.chest + 16, 'short'), 3, 'accent'), ...S([skirtShape(b, y.waist, y.ankle - 1, 30)], 3)]
      if (subtype === 'Salwar suit') return [...S(trouserShape(b, 'ankle', 4), 2, 'accent'), ...S(topShape(b, y.knee, 'long', 10), 3)]
      if (subtype === 'Sherwani') return [...S(trouserShape(b, 'ankle', 0), 2, 'accent'), ...S(topShape(b, y.knee + 4, 'long', 6), 3)]
      return S(topShape(b, y.knee, 'long', 8), 3)
    }
    case 'footwear':
      return S(shoeShape(b, subtype), 7)
    case 'bag': {
      if (subtype === 'Backpack') return [{ d: `M${f(cx - b.chest + 4)} ${f(y.shoulder + 2)}L${f(cx - b.chest + 2)} ${f(y.waist)}M${f(cx + b.chest - 4)} ${f(y.shoulder + 2)}L${f(cx + b.chest - 2)} ${f(y.waist)}`, layer: 8, kind: 'line', tone: 'main' }]
      const [hx] = armAt(b, 1, 0.9)
      const bx = hx + 4
      const strap = { d: `M${f(cx - b.shoulder + 6)} ${f(y.shoulder + 2)}L${f(bx)} ${f(y.hip - 6)}`, layer: 8, kind: 'line' as const, tone: 'dark' as const }
      const size = subtype === 'Clutch' ? 8 : subtype === 'Tote' || subtype === 'Laptop bag' ? 20 : 14
      return [...(subtype === 'Clutch' ? [] : [strap]), { d: poly([[bx - size / 2, y.hip - 6], [bx + size / 2 + 4, y.hip - 6], [bx + size / 2 + 6, y.hip + size], [bx - size / 2 - 2, y.hip + size]]), layer: 8, kind: 'fill', tone: 'main' }]
    }
    case 'jewellery': {
      const r = b.headR
      if (subtype === 'Necklace') return [{ d: `M${f(cx - b.neck - 2)} ${f(y.shoulder)}Q${f(cx)} ${f(y.shoulder + 16)} ${f(cx + b.neck + 2)} ${f(y.shoulder)}`, layer: 9, kind: 'line', tone: 'main' }]
      if (subtype === 'Earrings') return [-1, 1].map((s) => ({ d: `M${f(cx + s * r)} ${f(y.head + 2)}l0 5`, layer: 9, kind: 'line' as const, tone: 'main' as const }))
      if (subtype === 'Watch' || subtype === 'Bracelet' || subtype === 'Bangles') return S([armBand(b, -1, 0.9, 0.95, 1.2, false)], 9)
      return []
    }
    case 'accessory': {
      const r = b.headR
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

// ---------- real photos on the mannequin ----------

export interface PhotoBox {
  x: number
  y: number
  w: number
  h: number
  layer: number
}

/**
 * Where a cut-out photo of a piece goes on the body ("paper doll" style). Flat
 * photos of tops include the sleeves, so the box spans the arms as well.
 * Returns null for pieces better drawn as shapes (jewellery, small accessories).
 */
export function photoBox(b: Body, category: string, subtype: string): PhotoBox | null {
  const { cx, y } = b
  const span = (half: number, y0: number, y1: number, layer: number): PhotoBox => ({ x: cx - half, y: y0, w: half * 2, h: y1 - y0, layer })
  const armOut = b.shoulder + b.arm + b.spread * 0.55
  switch (category) {
    case 'top':
      if (subtype === 'Tank top' || subtype === 'Sports bra') return span(b.chest * 1.25, y.shoulder - 6, subtype === 'Sports bra' ? y.chest + 18 : y.hip + 6, 3)
      if (subtype === 'Crop top') return span(armOut * 0.9, y.shoulder - 6, y.waist - 2, 3)
      return span(armOut, y.shoulder - 8, y.hip + 12, 3)
    case 'outerwear':
      return span(armOut + 4, y.shoulder - 10, subtype === 'Coat' || subtype === 'Raincoat' ? y.knee + 8 : y.hip + 16, 5)
    case 'bottom':
      if (subtype === 'Shorts') return span(b.hip * 1.3, y.waist - 2, y.hip + (y.knee - y.hip) * 0.45, 2)
      if (subtype === 'Skirt') return span(b.hip * 1.45, y.waist - 2, y.knee + 6, 2)
      return span(b.hip * 1.25, y.waist - 2, y.ankle, 2)
    case 'dress':
      return span(armOut * 0.95, y.shoulder - 8, subtype === 'Formal dress' || subtype === 'Jumpsuit' ? y.ankle : y.knee + 10, 3)
    case 'ethnic':
      if (subtype === 'Nehru jacket') return span(b.chest * 1.35, y.shoulder - 6, y.hip + 12, 5)
      if (subtype === 'Dhoti') return span(b.hip * 1.5, y.waist - 2, y.ankle, 2)
      if (subtype === 'Dupatta') return null
      if (subtype === 'Kurta' || subtype === 'Kurti') return span(armOut, y.shoulder - 8, y.knee + 4, 3)
      return span(armOut, y.shoulder - 8, y.ankle, 3) // saree, lehenga, suits: full length
    case 'footwear':
      return span(b.ankle + 18, y.ankle - 14, y.floor + 2, 7)
    case 'bag': {
      if (subtype === 'Backpack') return null
      const [hx] = armAt(b, 1, 0.9)
      return { x: hx - 6, y: y.hip - 10, w: 30, h: 30, layer: 8 }
    }
    default:
      return null
  }
}
