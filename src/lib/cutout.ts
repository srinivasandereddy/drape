// Removes the background from a garment photo, on the phone, with no AI model:
// it learns the background's colors from the photo's edges and flood-fills from
// the edges inward, stopping where the garment begins. Works best for clothes
// laid on a bed, floor or plain wall (Drape's photo tip). Returns null when it
// can't tell garment from background, so the original photo is kept.

import { deltaE, rgbToLab, type Lab } from './color'
import { loadImage } from './image'

export interface Mask {
  width: number
  height: number
  /** 1 = garment, 0 = background, per pixel. */
  data: Uint8Array
  /** Garment bounding box. */
  box: { x: number; y: number; w: number; h: number }
  /** Share of the image that is garment, 0..1. */
  coverage: number
}

function borderColors(labs: Lab[], w: number, h: number): Lab[] {
  const ring = Math.max(1, Math.round(Math.min(w, h) * 0.04))
  const samples: Lab[] = []
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (x < ring || y < ring || x >= w - ring || y >= h - ring) samples.push(labs[y * w + x]!)
    }
  // Group border colors (a bed can have two tones, a floor a shadow): greedy clustering.
  const groups: { lab: Lab; n: number }[] = []
  for (const s of samples) {
    const g = groups.find((c) => deltaE(c.lab, s) < 10)
    if (g) {
      g.lab = [(g.lab[0] * g.n + s[0]) / (g.n + 1), (g.lab[1] * g.n + s[1]) / (g.n + 1), (g.lab[2] * g.n + s[2]) / (g.n + 1)]
      g.n++
    } else if (groups.length < 12) groups.push({ lab: [...s] as Lab, n: 1 })
  }
  return groups.filter((g) => g.n >= samples.length * 0.08).map((g) => g.lab)
}

/** Finds the garment in an RGBA image. Pure function, tested. */
export function findGarment(rgba: Uint8ClampedArray, width: number, height: number): Mask | null {
  const n = width * height
  if (n === 0) return null
  const labs: Lab[] = new Array(n)
  for (let i = 0; i < n; i++) labs[i] = rgbToLab([rgba[i * 4]!, rgba[i * 4 + 1]!, rgba[i * 4 + 2]!])
  const bg = borderColors(labs, width, height)
  if (bg.length === 0) return null // the edges are all different colors: busy background

  // Flood fill from every edge pixel through background-like pixels.
  const isBg = new Uint8Array(n)
  const nearBg = (i: number) => bg.some((b) => deltaE(labs[i]!, b) < 13)
  const queue: number[] = []
  const push = (i: number) => {
    if (!isBg[i] && nearBg(i)) {
      isBg[i] = 1
      queue.push(i)
    }
  }
  for (let x = 0; x < width; x++) {
    push(x)
    push((height - 1) * width + x)
  }
  for (let y = 0; y < height; y++) {
    push(y * width)
    push(y * width + width - 1)
  }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q]!
    const x = i % width
    const y = (i - x) / width
    if (x > 0) push(i - 1)
    if (x < width - 1) push(i + 1)
    if (y > 0) push(i - width)
    if (y < height - 1) push(i + width)
  }

  // Keep the biggest garment region; drop crumbs and stray specks.
  const label = new Int32Array(n).fill(-1)
  let best = -1
  let bestSize = 0
  let region = 0
  const stack: number[] = []
  for (let s = 0; s < n; s++) {
    if (isBg[s] || label[s] !== -1) continue
    let size = 0
    stack.push(s)
    label[s] = region
    while (stack.length) {
      const i = stack.pop()!
      size++
      const x = i % width
      const y = (i - x) / width
      const next = [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, y > 0 ? i - width : -1, y < height - 1 ? i + width : -1]
      for (const j of next) {
        if (j >= 0 && !isBg[j] && label[j] === -1) {
          label[j] = region
          stack.push(j)
        }
      }
    }
    if (size > bestSize) {
      bestSize = size
      best = region
    }
    region++
  }
  const coverage = bestSize / n
  // Too little: nothing found. Too much: the garment fills the photo, or the background wasn't plain.
  if (best < 0 || coverage < 0.04 || coverage > 0.9) return null

  const data = new Uint8Array(n)
  let minX = width
  let minY = height
  let maxX = 0
  let maxY = 0
  for (let i = 0; i < n; i++) {
    if (label[i] !== best) continue
    data[i] = 1
    const x = i % width
    const y = (i - x) / width
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return { width, height, data, coverage, box: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } }
}

/** Turns the hard 0/1 mask into 0..255 alpha with a slightly soft edge (two box-blur passes). */
export function softEdges(mask: Mask): Uint8ClampedArray {
  const { width: w, height: h } = mask
  let a = new Float32Array(mask.data.length)
  for (let i = 0; i < a.length; i++) a[i] = mask.data[i]! * 255
  for (let pass = 0; pass < 2; pass++) {
    const b = new Float32Array(a.length)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let sum = 0
        let cnt = 0
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx
            const yy = y + dy
            if (xx >= 0 && yy >= 0 && xx < w && yy < h) {
              sum += a[yy * w + xx]!
              cnt++
            }
          }
        b[y * w + x] = sum / cnt
      }
    a = b
  }
  return Uint8ClampedArray.from(a)
}

// ---------- browser: apply the mask to a photo ----------

const WORK_PX = 360
const OUT_FULL = 1200
const OUT_THUMB = 480

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('This phone ran out of memory for photos.')
  return { c, ctx }
}

const toBlob = (c: HTMLCanvasElement, type: string) =>
  new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not save the cut-out.'))), type, 0.9))

export interface Cutout {
  full: Blob
  thumb: Blob
  width: number
  height: number
}

/** Cuts the garment out of a photo. Returns null if the background isn't plain enough. */
export async function cutOut(photo: Blob): Promise<Cutout | null> {
  const img = await loadImage(photo)
  const scale = Math.min(1, WORK_PX / Math.max(img.naturalWidth, img.naturalHeight))
  const ww = Math.max(1, Math.round(img.naturalWidth * scale))
  const wh = Math.max(1, Math.round(img.naturalHeight * scale))
  const work = canvas(ww, wh)
  work.ctx.drawImage(img, 0, 0, ww, wh)
  const mask = findGarment(work.ctx.getImageData(0, 0, ww, wh).data, ww, wh)
  work.c.width = 0
  if (!mask) return null

  // Mask as an image with soft edges, scaled up to the photo.
  const m = canvas(ww, wh)
  const md = m.ctx.createImageData(ww, wh)
  const alpha = softEdges(mask)
  for (let i = 0; i < alpha.length; i++) md.data[i * 4 + 3] = alpha[i]!
  m.ctx.putImageData(md, 0, 0)

  // Crop to the garment with a little breathing room, so it fills its tile.
  const pad = 0.06
  const bx = Math.max(0, (mask.box.x - mask.box.w * pad) / scale)
  const by = Math.max(0, (mask.box.y - mask.box.h * pad) / scale)
  const bw = Math.min(img.naturalWidth - bx, (mask.box.w * (1 + 2 * pad)) / scale)
  const bh = Math.min(img.naturalHeight - by, (mask.box.h * (1 + 2 * pad)) / scale)

  const render = async (max: number) => {
    const s = Math.min(1, max / Math.max(bw, bh))
    const w = Math.max(1, Math.round(bw * s))
    const h = Math.max(1, Math.round(bh * s))
    const out = canvas(w, h)
    out.ctx.drawImage(img, bx, by, bw, bh, 0, 0, w, h)
    out.ctx.globalCompositeOperation = 'destination-in'
    out.ctx.imageSmoothingQuality = 'high'
    out.ctx.drawImage(m.c, bx * scale, by * scale, bw * scale, bh * scale, 0, 0, w, h)
    const blob = await toBlob(out.c, 'image/png')
    out.c.width = 0
    return { blob, w, h }
  }
  try {
    const full = await render(OUT_FULL)
    const thumb = await render(OUT_THUMB)
    return { full: full.blob, thumb: thumb.blob, width: full.w, height: full.h }
  } finally {
    m.c.width = 0
  }
}
