import { useEffect, useId, useState } from 'react'
import { getPhoto } from '../lib/closet'
import { hexToLab, labToRgb, rgbToHex } from '../lib/color'
import { bodyFor, bodyPaths, garmentShapes, photoBox, VIEW_H, VIEW_W, type PhotoBox, type Shape } from '../lib/mannequin'
import { dominantHex, type Garment } from '../lib/model'
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

/** Object URLs for the cut-out photos of these pieces (only cut-outs look right on a body). */
function useCutoutUrls(pieces: Garment[]): Map<string, string> {
  const key = pieces
    .filter((p) => p.photo && p.bgRemoved)
    .map((p) => `${p.id}:${p.photoRev}`)
    .join(',')
  const [urls, setUrls] = useState<Map<string, string>>(new Map())
  useEffect(() => {
    let cancelled = false
    const made: string[] = []
    const ids = key ? key.split(',').map((k) => k.split(':')[0]!) : []
    void Promise.all(
      ids.map(async (id) => {
        const p = await getPhoto(id).catch(() => undefined)
        if (!p) return null
        const url = URL.createObjectURL(p.thumb)
        made.push(url)
        return [id, url] as const
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

type Props = { pieces: Garment[]; profile: Pick<Profile, 'heightCm' | 'weightKg' | 'gender'> }

type Item =
  | { kind: 'shape'; layer: number; shape: Shape; g: Garment; fill: string; stroke: string }
  | { kind: 'photo'; layer: number; box: PhotoBox; url: string; g: Garment }

/**
 * The outfit on a mannequin proportioned from the person's height, weight and
 * gender. Pieces with a cut-out photo appear as that photo; the rest are drawn
 * in their colors and patterns. A styling preview only.
 */
export function Mannequin({ pieces, profile }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const body = bodyFor(profile.heightCm, profile.weightKg, profile.gender.kind)
  const bare = bodyPaths(body)
  const urls = useCutoutUrls(pieces)

  const items: Item[] = []
  for (const g of pieces) {
    const url = urls.get(g.id)
    const box = url ? photoBox(body, g.category, g.subtype) : null
    if (url && box) {
      items.push({ kind: 'photo', layer: box.layer, box, url, g })
      continue
    }
    const { main, accent } = colorsOf(g)
    const patterned = g.pattern && g.pattern !== 'solid'
    for (const s of garmentShapes(body, g.category, g.subtype)) {
      const base = s.tone === 'accent' ? accent : s.tone === 'dark' ? shade(main, -25) : main
      items.push({ kind: 'shape', layer: s.layer, shape: s, g, fill: patterned && s.tone !== 'accent' && s.kind === 'fill' ? `url(#${uid}-${g.id})` : base, stroke: shade(base, -22) })
    }
  }
  items.sort((a, b) => a.layer - b.layer)
  const photos = items.filter((i) => i.kind === 'photo').length

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="mannequin"
      role="img"
      aria-label={`Mannequin (${body.figure} figure, ${body.basis}) wearing ${pieces.length} pieces${photos ? `, ${photos} shown as their photos` : ''}`}
    >
      <defs>
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
        it.kind === 'photo' ? (
          <image key={i} href={it.url} x={it.box.x} y={it.box.y} width={it.box.w} height={it.box.h} preserveAspectRatio="xMidYMid meet" />
        ) : it.shape.kind === 'fill' ? (
          <path key={i} d={it.shape.d} fill={it.fill} stroke={it.stroke} strokeWidth="0.8" strokeLinejoin="round" />
        ) : (
          <path key={i} d={it.shape.d} fill="none" stroke={it.fill.startsWith('url') ? colorsOf(it.g).main : it.fill} strokeWidth="2.4" strokeLinecap="round" />
        ),
      )}
    </svg>
  )
}
