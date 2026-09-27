import { useId } from 'react'
import { hexToLab, labToRgb, rgbToHex } from '../lib/color'
import { bodyFor, bodyPaths, garmentShapes, VIEW_H, VIEW_W, type Shape } from '../lib/mannequin'
import { dominantHex, type Garment } from '../lib/model'
import type { Profile } from '../lib/profile'

const METAL_HEX: Record<string, string> = { gold: '#C9A227', silver: '#BFC1C4', 'rose-gold': '#C98B7B', other: '#8A8D91' }

/** A darker or lighter version of a color, for outlines and accents. */
function shade(hex: string, dL: number): string {
  const [L, a, b] = hexToLab(hex)
  return rgbToHex(labToRgb([Math.max(0, Math.min(100, L + dL)), a, b]))
}

function colorsOf(g: Garment): { main: string; accent: string } {
  const main = g.metal ? METAL_HEX[g.metal]! : (dominantHex(g) ?? '#9A9C98')
  const second = g.colors[1]?.hex
  const L = hexToLab(main)[0]
  return { main, accent: second ?? shade(main, L > 55 ? -18 : 18) }
}

type Props = { pieces: Garment[]; profile: Pick<Profile, 'heightCm' | 'weightKg' | 'gender'> }

/**
 * The outfit drawn on a mannequin proportioned from the person's height, weight
 * and gender. Colors and patterns come from each piece. A styling preview only.
 */
export function Mannequin({ pieces, profile }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const body = bodyFor(profile.heightCm, profile.weightKg, profile.gender.kind)
  const bare = bodyPaths(body)
  const shapes: (Shape & { g: Garment; fill: string; stroke: string })[] = []
  for (const g of pieces) {
    const { main, accent } = colorsOf(g)
    const patterned = g.pattern && g.pattern !== 'solid'
    for (const s of garmentShapes(body, g.category, g.subtype)) {
      const base = s.tone === 'accent' ? accent : s.tone === 'dark' ? shade(main, -25) : main
      shapes.push({ ...s, g, fill: patterned && s.tone !== 'accent' && s.kind === 'fill' ? `url(#${uid}-${g.id})` : base, stroke: shade(base, -22) })
    }
  }
  shapes.sort((a, b) => a.layer - b.layer)

  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="mannequin" role="img" aria-label={`Mannequin wearing ${pieces.length} pieces, shaped from ${body.basis}`}>
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
      <ellipse cx={body.cx} cy={body.y.floor + 2} rx={body.hip + 22} ry="6" fill="currentColor" opacity="0.08" />
      <g className="mq-body">
        {bare.legs.map((d, i) => (
          <path key={`l${i}`} d={d} />
        ))}
        {bare.arms.map((d, i) => (
          <path key={`a${i}`} d={d} />
        ))}
        <path d={bare.torso} />
        <path d={bare.neck} />
        <circle cx={bare.head.cx} cy={bare.head.cy} r={bare.head.r} />
      </g>
      {shapes.map((s, i) =>
        s.kind === 'fill' ? (
          <path key={i} d={s.d} fill={s.fill} stroke={s.stroke} strokeWidth="0.8" strokeLinejoin="round" />
        ) : (
          <path key={i} d={s.d} fill="none" stroke={s.fill.startsWith('url') ? colorsOf(s.g).main : s.fill} strokeWidth="2.4" strokeLinecap="round" />
        ),
      )}
    </svg>
  )
}
