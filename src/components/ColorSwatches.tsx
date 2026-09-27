import { Plus, X } from 'lucide-react'
import { useId, useState } from 'react'
import { colorName, PALETTE } from '../lib/color'
import { MAX_COLORS, type GarmentColor } from '../lib/model'

/** Read-only row of a garment's colors with their names. */
export function ColorSwatches({ colors }: { colors: GarmentColor[] }) {
  if (colors.length === 0) return <span className="muted">Not read yet</span>
  return (
    <span className="swatches">
      {colors.map((c) => (
        <span key={c.hex} className="swatch-chip">
          <i className="swatch" style={{ background: c.hex }} aria-hidden="true" />
          {colorName(c.hex)}
        </span>
      ))}
    </span>
  )
}

type FieldProps = {
  colors: GarmentColor[]
  onChange: (colors: GarmentColor[]) => void
  /** e.g. "Reading colors…" while the photo is being analysed */
  status?: string | null
}

/** Editable colors on the Add / Edit form: remove wrong ones, add from a palette. */
export function ColorsField({ colors, onChange, status }: FieldProps) {
  const id = useId()
  const [picking, setPicking] = useState(false)
  const remove = (hex: string) => {
    const rest = colors.filter((c) => c.hex !== hex)
    const total = rest.reduce((s, c) => s + c.share, 0) || 1
    onChange(rest.map((c) => ({ ...c, share: Math.round((c.share / total) * 100) / 100 })))
  }
  const add = (hex: string) => {
    if (colors.some((c) => c.hex === hex) || colors.length >= MAX_COLORS) return
    // A color added by hand counts as a smaller part than the ones already there.
    const share = colors.length === 0 ? 1 : 0.2
    const scaled = colors.map((c) => ({ ...c, share: Math.round(c.share * (1 - share) * 100) / 100 }))
    onChange([...scaled, { hex, share }])
    setPicking(false)
  }

  return (
    <div className="field" role="group" aria-labelledby={id}>
      <div className="field-label" id={id}>
        Colors <span className="field-hint">· main color first; tap × if one is wrong</span>
      </div>
      {status && <p className="muted small" role="status">{status}</p>}
      <div className="chips">
        {colors.map((c) => (
          <span key={c.hex} className="chip swatch-edit">
            <i className="swatch" style={{ background: c.hex }} aria-hidden="true" />
            {colorName(c.hex)}
            <span className="mono muted">{Math.round(c.share * 100)}%</span>
            <button type="button" className="swatch-remove" aria-label={`Remove ${colorName(c.hex)}`} onClick={() => remove(c.hex)}>
              <X size={14} aria-hidden="true" />
            </button>
          </span>
        ))}
        {colors.length < MAX_COLORS && (
          <button type="button" className="chip" aria-expanded={picking} onClick={() => setPicking((p) => !p)}>
            <Plus size={14} aria-hidden="true" /> Add color
          </button>
        )}
      </div>
      {picking && (
        <div className="palette" role="listbox" aria-label="Pick a color">
          {PALETTE.map((p) => (
            <button
              key={p.hex}
              type="button"
              role="option"
              aria-selected={colors.some((c) => c.hex === p.hex)}
              className="palette-item"
              onClick={() => add(p.hex)}
            >
              <i className="swatch lg" style={{ background: p.hex }} aria-hidden="true" />
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
