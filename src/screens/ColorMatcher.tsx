import { useId, useMemo, useState } from 'react'
import { ChoiceChips } from '../components/Chips'
import { ColorWheel } from '../components/ColorWheel'
import { PieceImage } from '../components/PieceImage'
import { ThumbRow } from '../components/ThumbRow'
import { colorName, hueOf, isNeutral, nearestNamed, rgbToHex } from '../lib/color'
import { dominantHex, type Garment } from '../lib/model'
import { pieceLabel, slotOf } from '../lib/outfit'
import { colorsInText } from '../lib/parser'
import { modeHues, piecesNearHues, WHEEL_MODES, type WheelMode } from '../lib/spectrum'

const WHEEL_SLOTS = new Set(['top', 'bottom', 'onepiece', 'layer', 'footwear', 'bag'])

type Base = { kind: 'piece'; id: string } | { kind: 'hue'; hue: number; label: string }

/** hsl → hex, for the accent swatches. */
function hslHex(h: number, s: number, l: number): string {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return 255 * (l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))
  }
  return rgbToHex([f(0), f(8), f(4)])
}

/**
 * The interactive color wheel: choose a harmony mode and a base color (a piece,
 * a tap on the ring, or a typed color), and see accent colors plus your pieces that fit.
 */
export function ColorMatcher({ garments, onOpen }: { garments: Garment[]; onOpen: (id: string) => void }) {
  const inputId = useId()
  const [mode, setMode] = useState<WheelMode>('complementary')
  const [base, setBase] = useState<Base | null>(null)
  const [typed, setTyped] = useState('')

  const pieces = useMemo(() => garments.filter((g) => dominantHex(g) && WHEEL_SLOTS.has(slotOf(g))), [garments])
  const basePiece = base?.kind === 'piece' ? (pieces.find((g) => g.id === base.id) ?? null) : null
  const baseHex = basePiece ? dominantHex(basePiece)! : null
  const baseNeutral = baseHex ? isNeutral(baseHex) : false
  const baseHue = base?.kind === 'hue' ? base.hue : baseHex && !baseNeutral ? hueOf(baseHex) : null
  const targets = baseHue === null ? [] : modeHues(mode, baseHue)
  const matches = baseHue === null ? [] : piecesNearHues(pieces, targets, basePiece?.id ?? null, mode === 'monochromatic' ? 20 : 25)
  const neutrals = pieces.filter((g) => g.id !== basePiece?.id && isNeutral(dominantHex(g)!))
  const accents =
    baseHue === null ? [] : mode === 'monochromatic' ? [hslHex(baseHue, 55, 30), hslHex(baseHue, 55, 50), hslHex(baseHue, 55, 75)] : targets.map((h) => hslHex(h, 60, 50))

  const baseLabel = basePiece ? pieceLabel(basePiece) : base?.kind === 'hue' ? base.label : null

  function onType(text: string) {
    setTyped(text)
    const hex = colorsInText(text)[0]
    if (!hex) return
    if (isNeutral(hex)) return setBase({ kind: 'hue', hue: hueOf(hex), label: nearestNamed(hex).name })
    setBase({ kind: 'hue', hue: Math.round(hueOf(hex)), label: nearestNamed(hex).name })
  }

  return (
    <div className="card stack">
      <div className="stack-sm">
        <h2>Color wheel matcher</h2>
        <p className="muted small">Choose a harmony, then a base color: tap one of your pieces, tap the ring, or type a color.</p>
      </div>

      <ChoiceChips<WheelMode> label="Harmony" options={WHEEL_MODES.map((m) => ({ value: m.id, label: m.label }))} value={mode} onChange={(m) => m && setMode(m)} />
      <p className="muted small">{WHEEL_MODES.find((m) => m.id === mode)!.hint}</p>

      {pieces.length > 0 && (
        <div className="picker-row" role="listbox" aria-label="Use one of your pieces as the base color">
          {pieces.map((g) => (
            <button
              key={g.id}
              type="button"
              role="option"
              aria-selected={basePiece?.id === g.id}
              className={basePiece?.id === g.id ? 'picker on' : 'picker'}
              onClick={() => setBase({ kind: 'piece', id: g.id })}
              aria-label={pieceLabel(g)}
            >
              <PieceImage garment={g} kind="thumb" className="picker-img" />
            </button>
          ))}
        </div>
      )}

      <div className="field">
        <label className="field-label" htmlFor={inputId}>
          Or type a color <span className="field-hint">· e.g. "sage", "burgundy"</span>
        </label>
        <input id={inputId} className="text-input" type="text" value={typed} onChange={(e) => onType(e.target.value)} autoComplete="off" />
      </div>

      <div className="wheel-wrap">
        <ColorWheel
          garments={pieces}
          selectedId={basePiece?.id ?? null}
          onSelect={(id) => setBase({ kind: 'piece', id })}
          baseHue={baseHue}
          markers={mode === 'monochromatic' ? [] : targets}
          onPickHue={(hue) => setBase({ kind: 'hue', hue, label: colorName(hslHex(hue, 60, 50)) })}
        />
      </div>

      {!base && <p className="muted small">Dots are your pieces, placed by hue. Darker ones sit nearer the middle; neutrals are in the center.</p>}

      {base && baseNeutral && (
        <p className="small">
          <b>{baseLabel}</b> is a neutral, so it goes with every color on the wheel. Pick a colored piece to see harmonies.
        </p>
      )}

      {baseHue !== null && (
        <div className="stack">
          <div className="stack-sm">
            <p className="small">
              <b>{baseLabel}</b>
              <span className="muted"> · {WHEEL_MODES.find((m) => m.id === mode)!.label.toLowerCase()} colors</span>
            </p>
            <div className="accent-row" aria-label="Accent colors">
              <span className="accent" style={{ background: hslHex(baseHue, 60, 50) }} title="Base" />
              <span className="accent-plus" aria-hidden="true">+</span>
              {accents.map((hex) => (
                <span key={hex} className="accent-chip">
                  <span className="accent" style={{ background: hex }} />
                  <span className="small">{colorName(hex)}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="stack-sm">
            <p className="small">
              <b>From your closet</b>
              <span className="muted"> · {matches.length ? `${matches.length} piece${matches.length === 1 ? '' : 's'} in these colors` : 'nothing in these colors yet'}</span>
            </p>
            {matches.length > 0 && <ThumbRow garments={matches} onOpen={onOpen} />}
          </div>
          {neutrals.length > 0 && (
            <div className="stack-sm">
              <p className="small">
                <b>Neutrals to calm it down</b>
              </p>
              <ThumbRow garments={neutrals.slice(0, 10)} onOpen={onOpen} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
