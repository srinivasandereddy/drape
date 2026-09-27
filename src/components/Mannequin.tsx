import { useEffect, useId, useState, type CSSProperties } from 'react'
import { getPhoto } from '../lib/closet'
import { loadImage } from '../lib/image'
import { hexToLab, labToRgb, rgbToHex } from '../lib/color'
import { bodyFor, bodyPaths, garmentShapes, photoBox, tuckedLook, VIEW_H, VIEW_W, type Shape } from '../lib/mannequin'
import { dominantHex, type Garment } from '../lib/model'
import { HAIR_COLORS, SKIN_TONES } from '../lib/personal'
import type { Profile } from '../lib/profile'

const METAL_HEX: Record<string, string> = { gold: '#C9A227', silver: '#BFC1C4', 'rose-gold': '#C98B7B', other: '#8A8D91' }

/** A darker or lighter version of a color, for outlines and accents. */
function shade(hex: string, dL: number): string {
  const [L, a, b] = hexToLab(hex)
  return rgbToHex(labToRgb([Math.max(0, Math.min(100, L + dL)), a, b]))
}

function colorsOf(g: Garment): { main: string; accent: string } {
  const main = g.metal ? METAL_HEX[g.metal]! : (dominantHex(g) ?? '#8E9196')
  const second = g.colors[1]?.hex
  const L = hexToLab(main)[0]
  return { main, accent: second ?? shade(main, L > 55 ? -18 : 18) }
}

/** Which part of a flat photo holds plain fabric, as fractions of the garment's box. */
const FABRIC_AREA: Record<string, [number, number, number, number]> = {
  top: [0.3, 0.3, 0.7, 0.7],
  outerwear: [0.3, 0.3, 0.7, 0.7],
  dress: [0.3, 0.3, 0.7, 0.8],
  ethnic: [0.3, 0.3, 0.7, 0.8],
  bottom: [0.18, 0.2, 0.42, 0.75], // one leg
  footwear: [0.1, 0.35, 0.4, 0.75],
  bag: [0.3, 0.35, 0.7, 0.75],
}

/**
 * Cuts a swatch of the garment's own fabric out of its background-removed photo,
 * so the mannequin can wear the real color, print and texture.
 */
async function fabricSwatch(thumb: Blob, category: string): Promise<string | null> {
  const img = await loadImage(thumb)
  const w = img.naturalWidth
  const h = img.naturalHeight
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(img, 0, 0)
  const data = ctx.getImageData(0, 0, w, h).data
  // The garment's own box (cut-outs are transparent around it).
  let x0 = w
  let y0 = h
  let x1 = 0
  let y1 = 0
  for (let y = 0; y < h; y += 2)
    for (let x = 0; x < w; x += 2)
      if (data[(y * w + x) * 4 + 3]! > 200) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
  if (x1 <= x0 || y1 <= y0) return null
  const [fx0, fy0, fx1, fy1] = FABRIC_AREA[category] ?? FABRIC_AREA.top!
  const sx = x0 + (x1 - x0) * fx0
  const sy = y0 + (y1 - y0) * fy0
  const sw = (x1 - x0) * (fx1 - fx0)
  const sh = (y1 - y0) * (fy1 - fy0)
  const T = 96
  const out = document.createElement('canvas')
  out.width = T * 2
  out.height = T * 2
  const o = out.getContext('2d')!
  o.drawImage(c, sx, sy, sw, sh, 0, 0, T, T)
  // Too much transparency means the swatch missed the fabric; use colors instead.
  const od = o.getImageData(0, 0, T, T).data
  let opaque = 0
  for (let i = 3; i < od.length; i += 4) if (od[i]! > 200) opaque++
  c.width = 0
  if (opaque < T * T * 0.8) return null
  // Mirror the swatch into a 2×2 tile so it repeats without visible seams.
  const tile = (fx: number, fy: number) => {
    o.save()
    o.translate(fx < 0 ? 2 * T : 0, fy < 0 ? 2 * T : 0)
    o.scale(fx, fy)
    o.drawImage(out, 0, 0, T, T, 0, 0, T, T)
    o.restore()
  }
  tile(-1, 1)
  tile(1, -1)
  tile(-1, -1)
  const blob = await new Promise<Blob | null>((r) => out.toBlob(r, 'image/png'))
  return blob ? URL.createObjectURL(blob) : null
}

/** Fabric swatches for pieces with a background-removed photo. */
function useFabrics(pieces: Garment[]): Map<string, string> {
  const key = pieces
    .filter((p) => p.photo && p.bgRemoved)
    .map((p) => `${p.id}:${p.photoRev}:${p.category}`)
    .join(',')
  const [urls, setUrls] = useState<Map<string, string>>(new Map())
  useEffect(() => {
    let cancelled = false
    const made: string[] = []
    const entries = key ? key.split(',').map((k) => k.split(':') as [string, string, string]) : []
    void Promise.all(
      entries.map(async ([id, , category]) => {
        const p = await getPhoto(id).catch(() => undefined)
        const url = p ? await fabricSwatch(p.thumb, category).catch(() => null) : null
        if (url) made.push(url)
        return url ? ([id, url] as const) : null
      }),
    ).then((pairs) => {
      if (!cancelled) setUrls(new Map(pairs.filter((x): x is readonly [string, string] => x !== null)))
    })
    return () => {
      cancelled = true
      for (const u of made) URL.revokeObjectURL(u)
    }
  }, [key])
  return urls
}

type Props = { pieces: Garment[]; profile: Pick<Profile, 'heightCm' | 'weightKg' | 'gender' | 'skinTone' | 'hair'> }

type Item = { layer: number; shape: Shape; g: Garment; fill: string; stroke: string; fabric: boolean }

/**
 * The outfit on a mannequin proportioned from the person's height, weight and
 * gender. Pieces with a background-removed photo wear their real fabric, shaped
 * to the body; the rest are drawn in their colors and patterns. A styling preview only.
 */
export function Mannequin({ pieces, profile }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const body = bodyFor(profile.heightCm, profile.weightKg, profile.gender.kind)
  const bare = bodyPaths(body)
  const fabrics = useFabrics(pieces)

  const tucked = tuckedLook(pieces)
  const items: Item[] = []
  for (const g of pieces) {
    const { main, accent } = colorsOf(g)
    const fabric = fabrics.has(g.id)
    const patterned = g.pattern && g.pattern !== 'solid'
    for (const s of garmentShapes(body, g.category, g.subtype, { tucked })) {
      const base = s.tone === 'accent' ? accent : s.tone === 'dark' ? shade(main, -25) : main
      const fill = s.kind === 'fill' && s.tone !== 'accent' && s.tone !== 'dark' ? (fabric ? `url(#${uid}-f-${g.id})` : patterned ? `url(#${uid}-${g.id})` : base) : base
      items.push({ layer: s.layer, shape: s, g, fill, stroke: shade(base, -22), fabric })
    }
  }
  items.sort((a, b) => a.layer - b.layer)
  const withFabric = pieces.filter((p) => fabrics.has(p.id)).length
  // The person's own skin and hair color, when they told us.
  const skinHex = SKIN_TONES.find((s) => s.id === profile.skinTone)?.hex
  const hairHex = HAIR_COLORS.find((h) => h.id === profile.hair)?.hex
  const style = { ...(skinHex ? { '--mannequin': skinHex } : {}), ...(hairHex ? { '--mq-hair': hairHex } : {}) } as CSSProperties

  return (
    <svg
      style={style}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="mannequin"
      role="img"
      aria-label={`Mannequin (${body.figure} figure, ${body.basis}) wearing ${pieces.length} pieces${withFabric ? `, ${withFabric} in their own fabric` : ''}`}
    >
      <defs>
        {/* Soft shading so clothes look rounded rather than flat. */}
        <linearGradient id={`${uid}-shade`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0.28" />
          <stop offset="0.22" stopColor="#000" stopOpacity="0" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0.08" />
          <stop offset="0.8" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.28" />
        </linearGradient>
        {pieces
          .filter((g) => fabrics.has(g.id))
          .map((g) => {
            // Tiled at roughly the real scale of the fabric: the swatch was about 40% of the piece's width.
            const box = photoBox(body, g.category, g.subtype)
            const t = 2 * Math.max(22, Math.min(60, (box?.w ?? 70) * 0.4))
            return (
              <pattern key={`f${g.id}`} id={`${uid}-f-${g.id}`} patternUnits="userSpaceOnUse" x={box?.x ?? 0} y={box?.y ?? 0} width={t} height={t}>
                <image href={fabrics.get(g.id)} x="0" y="0" width={t} height={t} preserveAspectRatio="none" />
              </pattern>
            )
          })}
        {pieces
          .filter((g) => g.pattern && g.pattern !== 'solid')
          .map((g) => {
            const { main, accent } = colorsOf(g)
            const id = `${uid}-${g.id}`
            return (
              <pattern key={id} id={id} width="8" height="8" patternUnits="userSpaceOnUse">
                <rect width="8" height="8" fill={main} />
                {g.pattern === 'striped' && <rect width="8" height="3" fill={accent} />}
                {g.pattern === 'checked' && (
                  <>
                    <rect width="8" height="3" fill={accent} opacity="0.6" />
                    <rect width="3" height="8" fill={accent} opacity="0.6" />
                  </>
                )}
                {(g.pattern === 'printed' || g.pattern === 'other') && <circle cx="4" cy="4" r="1.5" fill={accent} />}
                {g.pattern === 'floral' && (
                  <>
                    <circle cx="2" cy="2" r="1.4" fill={accent} />
                    <circle cx="6" cy="6" r="1.8" fill={accent} opacity="0.8" />
                  </>
                )}
                {g.pattern === 'embroidered' && <path d="M0 4h8M4 0v8" stroke={accent} strokeWidth="0.8" />}
              </pattern>
            )
          })}
      </defs>
      <ellipse cx={body.cx} cy={body.y.floor + 2} rx={body.hip + 24} ry="6" fill="currentColor" opacity="0.08" />
      {bare.hair && bare.hairBehind && <path d={bare.hair} className="mq-hair" />}
      <g className="mq-body">
        {bare.legs.map((d, i) => (
          <path key={`l${i}`} d={d} />
        ))}
        {bare.arms.map((d, i) => (
          <path key={`a${i}`} d={d} />
        ))}
        {bare.hands.map((h, i) => (
          <circle key={`h${i}`} cx={h.cx} cy={h.cy} r={h.r} />
        ))}
        <path d={bare.torso} />
        <path d={bare.neck} />
        <circle cx={bare.head.cx} cy={bare.head.cy} r={bare.head.r} />
      </g>
      {bare.hair && !bare.hairBehind && <path d={bare.hair} className="mq-hair" />}
      {items.map((it, i) =>
        it.shape.kind === 'detail' ? (
          <path key={i} d={it.shape.d} fill="none" stroke={shade(colorsOf(it.g).main, -30)} strokeOpacity="0.55" strokeWidth="0.7" strokeLinecap="round" strokeLinejoin="round" />
        ) : it.shape.kind === 'fill' ? (
          <g key={i}>
            <path d={it.shape.d} fill={it.fill} stroke={it.stroke} strokeWidth="0.8" strokeLinejoin="round" />
            {it.shape.layer < 7 && <path d={it.shape.d} fill={`url(#${uid}-shade)`} stroke="none" pointerEvents="none" />}
          </g>
        ) : (
          <path key={i} d={it.shape.d} fill="none" stroke={it.fill.startsWith('url') ? colorsOf(it.g).main : it.fill} strokeWidth="2.4" strokeLinecap="round" />
        ),
      )}
    </svg>
  )
}
