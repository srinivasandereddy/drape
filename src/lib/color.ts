import { loadImage } from './image'

// Color science for Drape: conversions, friendly names, neutrals, and reading
// the main colors of a garment photo. Everything here is plain math with no
// browser APIs, except `extractColorsFromBlob` at the bottom.

export type RGB = [number, number, number]
export type Lab = [number, number, number]

// ---------- conversions ----------

export function hexToRgb(hex: string): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) throw new Error(`Not a color: ${hex}`)
  const n = parseInt(m[1]!, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgbToHex([r, g, b]: RGB): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase()
}

const toLinear = (v: number) => {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}
const fromLinear = (c: number) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

/** sRGB → CIE Lab (D65). Lab distances roughly match how different colors look. */
export function rgbToLab([r, g, b]: RGB): Lab {
  const R = toLinear(r)
  const G = toLinear(g)
  const B = toLinear(b)
  const x = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047
  const y = 0.2126729 * R + 0.7151522 * G + 0.072175 * B
  const z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116)
  const fx = f(x)
  const fy = f(y)
  const fz = f(z)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

export function labToRgb([L, a, b]: Lab): RGB {
  const fy = (L + 16) / 116
  const fx = fy + a / 500
  const fz = fy - b / 200
  const inv = (t: number) => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27))
  const x = inv(fx) * 0.95047
  const y = inv(fy)
  const z = inv(fz) * 1.08883
  const R = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z
  const G = -0.969266 * x + 1.8760108 * y + 0.041556 * z
  const B = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z
  return [fromLinear(R), fromLinear(G), fromLinear(B)]
}

export const hexToLab = (hex: string): Lab => rgbToLab(hexToRgb(hex))

export function deltaE(p: Lab, q: Lab): number {
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
}

/** Colorfulness (Lab chroma). Below ~10 a color reads as grey/black/white. */
export const chroma = (lab: Lab): number => Math.hypot(lab[1], lab[2])

/** Hue angle on the familiar color wheel (HSL hue, 0 = red, 120 = green, 240 = blue). */
export function hueOf(hex: string): number {
  return hueCache(hex)
}
const hueCache = (() => {
  const cache = new Map<string, number>()
  return (hex: string) => {
    let v = cache.get(hex)
    if (v === undefined) {
      v = computeHue(hex)
      cache.set(hex, v)
    }
    return v
  }
})()
function computeHue(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255) as RGB
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  if (d === 0) return 0
  let h: number
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return (h * 60 + 360) % 360
}

/** Smallest angle between two hues, 0..180. */
export function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

// ---------- names and neutrals ----------

export interface NamedColor {
  name: string
  hex: string
  neutral: boolean
}

/** Reference colors used for friendly names and the manual color picker. */
export const PALETTE: readonly NamedColor[] = [
  { name: 'Black', hex: '#1B1B1D', neutral: true },
  { name: 'Charcoal', hex: '#3A3F45', neutral: true },
  { name: 'Grey', hex: '#8A8D91', neutral: true },
  { name: 'Light grey', hex: '#CDCFD1', neutral: true },
  { name: 'White', hex: '#F4F4F1', neutral: true },
  { name: 'Cream', hex: '#EFE6D0', neutral: true },
  { name: 'Beige', hex: '#D8C4A2', neutral: true },
  { name: 'Khaki', hex: '#B5A77E', neutral: true },
  { name: 'Camel', hex: '#BE9464', neutral: true },
  { name: 'Brown', hex: '#6B4A33', neutral: true },
  { name: 'Dark brown', hex: '#3F2A1E', neutral: true },
  { name: 'Navy', hex: '#1F2A44', neutral: true },
  { name: 'Denim', hex: '#3E5C82', neutral: true },
  { name: 'Blue', hex: '#2F5DAA', neutral: false },
  { name: 'Sky blue', hex: '#8DB9E2', neutral: false },
  { name: 'Teal', hex: '#1E7B7A', neutral: false },
  { name: 'Green', hex: '#3A8A4E', neutral: false },
  { name: 'Olive', hex: '#6B7040', neutral: false },
  { name: 'Mint', hex: '#A9D9BD', neutral: false },
  { name: 'Yellow', hex: '#EBC943', neutral: false },
  { name: 'Mustard', hex: '#C69C22', neutral: false },
  { name: 'Orange', hex: '#E07A2E', neutral: false },
  { name: 'Rust', hex: '#B5502D', neutral: false },
  { name: 'Red', hex: '#C0342B', neutral: false },
  { name: 'Maroon', hex: '#74202C', neutral: false },
  { name: 'Pink', hex: '#EBA3B6', neutral: false },
  { name: 'Hot pink', hex: '#D6336C', neutral: false },
  { name: 'Purple', hex: '#6D3B8E', neutral: false },
  { name: 'Lavender', hex: '#B8A6DA', neutral: false },
]

const PALETTE_LAB = PALETTE.map((p) => ({ ...p, lab: hexToLab(p.hex) }))

export function nearestNamed(hex: string): NamedColor {
  const lab = hexToLab(hex)
  let best = PALETTE_LAB[0]!
  let bestD = Infinity
  for (const p of PALETTE_LAB) {
    const d = deltaE(lab, p.lab)
    if (d < bestD) {
      bestD = d
      best = p
    }
  }
  return best
}

/** Caches results per hex; outfit scoring asks about the same few colors thousands of times. */
function memo<T>(fn: (hex: string) => T): (hex: string) => T {
  const cache = new Map<string, T>()
  return (hex) => {
    const key = hex.toUpperCase()
    let v = cache.get(key)
    if (v === undefined) {
      v = fn(key)
      if (cache.size > 2000) cache.clear()
      cache.set(key, v)
    }
    return v
  }
}

export const colorName = memo((hex): string => nearestNamed(hex).name)

/** Neutrals (black, white, grey, beige, navy, denim, brown…) go with almost anything. */
export const isNeutral = memo((hex): boolean => chroma(hexToLab(hex)) < 10 || nearestNamed(hex).neutral)

/** Warm (reds, oranges, yellows) or cool (greens, blues, purples). Null for neutrals. */
export function temperature(hex: string): 'warm' | 'cool' | null {
  if (isNeutral(hex)) return null
  const h = hueOf(hex)
  return h < 75 || h >= 330 ? 'warm' : 'cool'
}

// ---------- reading the main colors from pixels ----------

export interface ExtractedColor {
  hex: string
  share: number
}

type Pixel = { lab: Lab; w: number }

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)] ?? 0
}

/**
 * Finds up to `max` main colors of the garment in an RGBA pixel buffer.
 * 1. Guess the background from the border (plain wall, bed, floor) and ignore it.
 * 2. Weight pixels near the center more, since that is where the garment usually is.
 * 3. Group similar colors (k-means in Lab), merging light and shadow of the same color.
 */
export function extractColors(data: Uint8ClampedArray, width: number, height: number, max = 3): ExtractedColor[] {
  if (width <= 0 || height <= 0 || data.length < width * height * 4) return []
  const border = Math.max(1, Math.round(Math.min(width, height) * 0.06))
  const borderLabs: Lab[] = []
  const all: { lab: Lab; x: number; y: number }[] = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (data[i + 3]! < 128) continue
      const lab = rgbToLab([data[i]!, data[i + 1]!, data[i + 2]!])
      all.push({ lab, x, y })
      if (x < border || y < border || x >= width - border || y >= height - border) borderLabs.push(lab)
    }
  }
  if (all.length === 0) return []

  // Background: the border's median color, if most of the border agrees on it.
  let background: Lab | null = null
  if (borderLabs.length > 0) {
    const med: Lab = [median(borderLabs.map((l) => l[0])), median(borderLabs.map((l) => l[1])), median(borderLabs.map((l) => l[2]))]
    const agreeing = borderLabs.filter((l) => deltaE(l, med) < 12).length / borderLabs.length
    if (agreeing >= 0.6) background = med
  }

  const cx = (width - 1) / 2
  const cy = (height - 1) / 2
  const pick = (skipBackground: boolean): Pixel[] =>
    all
      .filter((p) => !skipBackground || !background || deltaE(p.lab, background) >= 10)
      .map((p) => {
        const dx = (p.x - cx) / (cx || 1)
        const dy = (p.y - cy) / (cy || 1)
        return { lab: p.lab, w: 1.25 - 0.5 * Math.min(1, (dx * dx + dy * dy) / 2) }
      })
  let pixels = pick(true)
  // If almost everything matched the "background", the garment fills the frame.
  if (pixels.length < all.length * 0.05) pixels = pick(false)

  const clusters = kMeans(pixels, 5)
  const merged = mergeSimilar(clusters)
  const total = merged.reduce((s, c) => s + c.w, 0)
  const kept = merged
    .map((c) => ({ lab: c.lab, share: c.w / total }))
    .filter((c) => c.share >= 0.08)
    .sort((a, b) => b.share - a.share)
    .slice(0, max)
  const keptTotal = kept.reduce((s, c) => s + c.share, 0)
  return kept.map((c) => ({ hex: rgbToHex(labToRgb(c.lab)), share: Math.round((c.share / keptTotal) * 100) / 100 }))
}

/** Distance that cares less about lightness, so a color and its shadow count as one. */
const shadeDistance = (p: Lab, q: Lab) => Math.hypot((p[0] - q[0]) * 0.45, p[1] - q[1], p[2] - q[2])

function kMeans(pixels: Pixel[], k: number): { lab: Lab; w: number }[] {
  if (pixels.length === 0) return []
  // Deterministic start: heaviest-weighted mean, then repeatedly the farthest pixel.
  const centers: Lab[] = []
  const totalW = pixels.reduce((s, p) => s + p.w, 0)
  centers.push([0, 1, 2].map((i) => pixels.reduce((s, p) => s + p.lab[i]! * p.w, 0) / totalW) as Lab)
  while (centers.length < Math.min(k, pixels.length)) {
    let far = pixels[0]!
    let farD = -1
    for (const p of pixels) {
      const d = Math.min(...centers.map((c) => deltaE(p.lab, c)))
      if (d > farD) {
        farD = d
        far = p
      }
    }
    if (farD < 4) break // the rest is all one color
    centers.push([...far.lab] as Lab)
  }

  const assign = new Array<number>(pixels.length).fill(0)
  for (let iter = 0; iter < 12; iter++) {
    let moved = false
    pixels.forEach((p, i) => {
      let best = 0
      let bestD = Infinity
      centers.forEach((c, j) => {
        const d = deltaE(p.lab, c)
        if (d < bestD) {
          bestD = d
          best = j
        }
      })
      if (assign[i] !== best) moved = true
      assign[i] = best
    })
    const sums = centers.map(() => ({ L: 0, a: 0, b: 0, w: 0 }))
    pixels.forEach((p, i) => {
      const s = sums[assign[i]!]!
      s.L += p.lab[0] * p.w
      s.a += p.lab[1] * p.w
      s.b += p.lab[2] * p.w
      s.w += p.w
    })
    sums.forEach((s, j) => {
      if (s.w > 0) centers[j] = [s.L / s.w, s.a / s.w, s.b / s.w]
    })
    if (!moved && iter > 0) break
  }
  const weights = centers.map(() => 0)
  pixels.forEach((p, i) => (weights[assign[i]!]! += p.w))
  return centers.map((lab, j) => ({ lab, w: weights[j]! })).filter((c) => c.w > 0)
}

function mergeSimilar(clusters: { lab: Lab; w: number }[]): { lab: Lab; w: number }[] {
  const out = [...clusters].sort((a, b) => b.w - a.w)
  for (let i = 0; i < out.length; i++) {
    for (let j = out.length - 1; j > i; j--) {
      const a = out[i]!
      const b = out[j]!
      if (shadeDistance(a.lab, b.lab) < 12) {
        // Keep the bigger cluster's color; add the weight.
        out[i] = { lab: a.lab, w: a.w + b.w }
        out.splice(j, 1)
      }
    }
  }
  return out
}

// ---------- browser: read colors from a stored photo ----------

const SAMPLE_PX = 96

export async function extractColorsFromBlob(blob: Blob): Promise<ExtractedColor[]> {
  {
    const img = await loadImage(blob)
    const scale = Math.min(1, SAMPLE_PX / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.max(1, Math.round(img.naturalWidth * scale))
    const h = Math.max(1, Math.round(img.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    try {
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return []
      ctx.drawImage(img, 0, 0, w, h)
      return extractColors(ctx.getImageData(0, 0, w, h).data, w, h)
    } finally {
      canvas.width = 0
      canvas.height = 0
    }
  }
}
