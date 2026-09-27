// Turns an outfit into a shareable picture: the mannequin, the pieces, and a line
// or two of why it works. Drawn on a canvas on the phone, then handed to the
// phone's share sheet (WhatsApp, Instagram…), or saved when sharing isn't available.

import { getPhoto } from './closet'
import { loadImage } from './image'
import { dominantHex, type Garment } from './model'
import { pieceLabel } from './outfit'

const W = 1080
const H = 1350

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(b)
  })

/** An SVG element as a standalone image: styles inlined and photos embedded, so it draws on a canvas. */
async function svgToImage(svg: SVGSVGElement): Promise<HTMLImageElement> {
  const clone = svg.cloneNode(true) as SVGSVGElement
  const src = [svg, ...svg.querySelectorAll('*')]
  const dst = [clone, ...clone.querySelectorAll('*')]
  src.forEach((el, i) => {
    const cs = getComputedStyle(el)
    const d = dst[i] as SVGElement
    if (el instanceof SVGPathElement || el instanceof SVGCircleElement || el instanceof SVGEllipseElement) {
      if (!d.getAttribute('fill') || d.getAttribute('fill')!.startsWith('var')) d.setAttribute('fill', cs.fill)
      if (!d.getAttribute('stroke')) d.setAttribute('stroke', cs.stroke)
      if (cs.opacity !== '1') d.setAttribute('opacity', cs.opacity)
    }
  })
  for (const img of clone.querySelectorAll('image')) {
    const href = img.getAttribute('href')
    if (href?.startsWith('blob:')) img.setAttribute('href', await blobToDataUrl(await (await fetch(href)).blob()))
  }
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', '400')
  clone.setAttribute('height', '880')
  const xml = new XMLSerializer().serializeToString(clone)
  return loadImage(new Blob([xml], { type: 'image/svg+xml' }))
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number, maxLines: number): number {
  const words = text.split(' ')
  let line = ''
  let lines = 0
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y + lines * lineH)
      lines++
      line = w
      if (lines >= maxLines) return lines
    } else line = test
  }
  if (line && lines < maxLines) {
    ctx.fillText(line, x, y + lines * lineH)
    lines++
  }
  return lines
}

export interface ShareInput {
  title: string
  subtitle: string
  pieces: Garment[]
  lines: string[]
  mannequin: SVGSVGElement | null
}

export async function renderOutfitImage(input: ShareInput): Promise<Blob> {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  const dark = matchMedia('(prefers-color-scheme: dark)').matches
  const paper = dark ? '#15171a' : '#f7f7f4'
  const card = dark ? '#1f2226' : '#ffffff'
  const ink = dark ? '#eceeef' : '#17191c'
  const mute = dark ? '#9aa0a6' : '#6b7075'
  ctx.fillStyle = paper
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = ink
  ctx.font = '700 64px "Bricolage Grotesque Variable", system-ui, sans-serif'
  ctx.fillText(input.title, 64, 120)
  ctx.fillStyle = mute
  ctx.font = '400 34px "DM Sans Variable", system-ui, sans-serif'
  ctx.fillText(input.subtitle, 64, 172)

  // Mannequin on the left.
  roundRect(ctx, 48, 220, 440, 900, 36)
  ctx.fillStyle = card
  ctx.fill()
  if (input.mannequin) {
    try {
      const m = await svgToImage(input.mannequin)
      ctx.drawImage(m, 68, 230, 400, 880)
    } catch {
      /* the pieces alone still make a good picture */
    }
  }

  // Pieces on the right, two columns.
  const cell = 240
  const gap = 24
  const x0 = 520
  let i = 0
  for (const g of input.pieces.slice(0, 6)) {
    const x = x0 + (i % 2) * (cell + gap)
    const y = 220 + Math.floor(i / 2) * (cell + 60)
    roundRect(ctx, x, y, cell, cell, 24)
    ctx.fillStyle = card
    ctx.fill()
    const photo = g.photo ? await getPhoto(g.id).catch(() => undefined) : undefined
    if (photo) {
      try {
        const img = await loadImage(photo.thumb)
        const s = Math.min((cell - 24) / img.naturalWidth, (cell - 24) / img.naturalHeight)
        const w = img.naturalWidth * s
        const h = img.naturalHeight * s
        ctx.save()
        roundRect(ctx, x, y, cell, cell, 24)
        ctx.clip()
        ctx.drawImage(img, x + (cell - w) / 2, y + (cell - h) / 2, w, h)
        ctx.restore()
      } catch {
        /* skip a photo that won't load */
      }
    } else {
      ctx.fillStyle = dominantHex(g) ?? '#999999'
      roundRect(ctx, x + 40, y + 40, cell - 80, cell - 80, 20)
      ctx.fill()
    }
    ctx.fillStyle = ink
    ctx.font = '500 26px "DM Sans Variable", system-ui, sans-serif'
    wrap(ctx, pieceLabel(g), x, y + cell + 34, cell, 30, 1)
    i++
  }

  // Why it works.
  ctx.fillStyle = ink
  ctx.font = '400 30px "DM Sans Variable", system-ui, sans-serif'
  let y = 1170
  for (const l of input.lines.slice(0, 2)) y += wrap(ctx, `• ${l}`, 64, y, W - 128, 38, 2) * 38
  ctx.fillStyle = mute
  ctx.font = '500 26px "DM Mono", ui-monospace, monospace'
  ctx.fillText('Styled with Drape', 64, H - 40)

  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'))
  c.width = 0
  if (!blob) throw new Error('Could not create the picture.')
  return blob
}

/** Opens the phone's share sheet with the picture, or saves it when sharing files isn't supported. */
export async function shareImage(blob: Blob, text: string): Promise<'shared' | 'saved' | 'cancelled'> {
  const file = new File([blob], 'drape-outfit.png', { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text })
      return 'shared'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
      throw e
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'drape-outfit.png'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  return 'saved'
}
