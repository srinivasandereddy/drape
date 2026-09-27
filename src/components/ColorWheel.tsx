import type { MouseEvent } from 'react'
import { hexToLab, hueOf, isNeutral } from '../lib/color'
import { dominantHex, type Garment } from '../lib/model'

const SIZE = 320
const C = SIZE / 2
const RING_IN = 128
const RING_OUT = 152
const SEGMENTS = 36

/** Polar to x/y, with hue 0 (red) at the top and hues running clockwise. */
function point(angle: number, r: number): [number, number] {
  const rad = ((angle - 90) * Math.PI) / 180
  return [C + r * Math.cos(rad), C + r * Math.sin(rad)]
}

function arc(a0: number, a1: number, r0: number, r1: number): string {
  const [x0, y0] = point(a0, r1)
  const [x1, y1] = point(a1, r1)
  const [x2, y2] = point(a1, r0)
  const [x3, y3] = point(a0, r0)
  const large = a1 - a0 > 180 ? 1 : 0
  return `M${x0} ${y0}A${r1} ${r1} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 ${large} 0 ${x3} ${y3}Z`
}

/** Darker colors sit nearer the middle, lighter ones nearer the ring. */
const radiusFor = (hex: string) => 44 + (Math.min(100, Math.max(0, hexToLab(hex)[0])) / 100) * 76

type Props = {
  garments: Garment[]
  selectedId: string | null
  onSelect: (id: string) => void
  /** The base hue, drawn as a solid line. */
  baseHue: number | null
  /** Hues that complete the chosen harmony, drawn as markers on the ring. */
  markers: number[]
  /** Tapping the ring picks a hue. */
  onPickHue?: (hue: number) => void
}

export function ColorWheel({ garments, selectedId, onSelect, baseHue, markers, onPickHue }: Props) {
  const colored = garments.filter((g) => dominantHex(g))
  const chromatic = colored.filter((g) => !isNeutral(dominantHex(g)!))
  const neutrals = colored.filter((g) => isNeutral(dominantHex(g)!))

  const pickHue = (e: MouseEvent<SVGGElement>) => {
    if (!onPickHue) return
    const box = e.currentTarget.ownerSVGElement!.getBoundingClientRect()
    const x = ((e.clientX - box.left) / box.width) * SIZE - C
    const y = ((e.clientY - box.top) / box.height) * SIZE - C
    onPickHue(Math.round(((Math.atan2(y, x) * 180) / Math.PI + 90 + 360) % 360))
  }

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="wheel"
      role="img"
      aria-label="Color wheel. Your pieces are dots placed by hue, darker ones nearer the middle and neutrals in the center. Markers show the colors that complete the chosen harmony."
    >
      <g onClick={pickHue} className={onPickHue ? 'wheel-ring pickable' : 'wheel-ring'}>
        {Array.from({ length: SEGMENTS }, (_, i) => {
          const a0 = (i * 360) / SEGMENTS
          return <path key={i} d={arc(a0, a0 + 360 / SEGMENTS + 0.4, RING_IN, RING_OUT)} fill={`hsl(${a0 + 5} 62% 52%)`} />
        })}
      </g>

      {baseHue !== null && (
        <line x1={C} y1={C} x2={point(baseHue, RING_OUT + 6)[0]} y2={point(baseHue, RING_OUT + 6)[1]} className="wheel-line strong" />
      )}
      {markers.map((h, i) => {
        const [x, y] = point(h, (RING_IN + RING_OUT) / 2)
        const [lx, ly] = point(h, RING_OUT + 6)
        return (
          <g key={`${h}-${i}`}>
            <line x1={C} y1={C} x2={lx} y2={ly} className="wheel-line" />
            <circle cx={x} cy={y} r={9} fill={`hsl(${h} 62% 52%)`} className="wheel-marker" />
          </g>
        )
      })}

      {neutrals.length > 0 && <circle cx={C} cy={C} r={30} className="wheel-center" />}
      {neutrals.slice(0, 12).map((g, i) => {
        const n = Math.min(12, neutrals.length)
        const [x, y] = n === 1 ? [C, C] : point((i * 360) / n, 16)
        return <Dot key={g.id} g={g} x={x} y={y} selected={g.id === selectedId} onSelect={onSelect} />
      })}
      {chromatic.map((g) => {
        const hex = dominantHex(g)!
        const [x, y] = point(hueOf(hex), radiusFor(hex))
        return <Dot key={g.id} g={g} x={x} y={y} selected={g.id === selectedId} onSelect={onSelect} />
      })}
    </svg>
  )
}

function Dot({ g, x, y, selected, onSelect }: { g: Garment; x: number; y: number; selected: boolean; onSelect: (id: string) => void }) {
  return <circle cx={x} cy={y} r={selected ? 11 : 7} fill={dominantHex(g)!} className={selected ? 'wheel-dot selected' : 'wheel-dot'} onClick={() => onSelect(g.id)} />
}
