import { useId } from 'react'
import { PALETTE } from '../lib/color'

type Props = { label: string; hint?: string; values: string[]; onChange: (v: string[]) => void; disabled?: string[] }

/** Pick several named colors from Drape's palette, shown as swatches. */
export function ColorPick({ label, hint, values, onChange, disabled = [] }: Props) {
  const id = useId()
  return (
    <div className="field" role="group" aria-labelledby={id}>
      <div className="field-label" id={id}>
        {label}
        {hint && <span className="field-hint"> · {hint}</span>}
      </div>
      <div className="palette">
        {PALETTE.map((p) => {
          const on = values.includes(p.name)
          const off = disabled.includes(p.name)
          return (
            <button
              key={p.name}
              type="button"
              className={on ? 'palette-item on' : 'palette-item'}
              aria-pressed={on}
              disabled={off && !on}
              onClick={() => onChange(on ? values.filter((v) => v !== p.name) : [...values, p.name])}
            >
              <i className="swatch lg" style={{ background: p.hex }} aria-hidden="true" />
              <span>{p.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
