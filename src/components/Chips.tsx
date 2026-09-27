import { useId } from 'react'

import type { Option } from '../lib/options'

type SingleProps<T> = {
  label: string
  hint?: string
  options: readonly Option<T>[]
  value: T | null
  onChange: (value: T | null) => void
  /** Tapping the selected chip again clears it. */
  clearable?: boolean
}

export function ChoiceChips<T extends string | number>({ label, hint, options, value, onChange, clearable }: SingleProps<T>) {
  const id = useId()
  return (
    <div className="field" role="group" aria-labelledby={id}>
      <div className="field-label" id={id}>
        {label}
        {hint && <span className="field-hint"> · {hint}</span>}
      </div>
      <div className="chips">
        {options.map((o) => {
          const on = o.value === value
          return (
            <button
              key={String(o.value)}
              type="button"
              className={on ? 'chip on' : 'chip'}
              aria-pressed={on}
              onClick={() => onChange(on && clearable ? null : o.value)}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

type MultiProps<T> = {
  label: string
  hint?: string
  options: readonly Option<T>[]
  values: readonly T[]
  onChange: (values: T[]) => void
}

export function MultiChips<T extends string | number>({ label, hint, options, values, onChange }: MultiProps<T>) {
  const id = useId()
  return (
    <div className="field" role="group" aria-labelledby={id}>
      <div className="field-label" id={id}>
        {label}
        {hint && <span className="field-hint"> · {hint}</span>}
      </div>
      <div className="chips">
        {options.map((o) => {
          const on = values.includes(o.value)
          return (
            <button
              key={String(o.value)}
              type="button"
              className={on ? 'chip on' : 'chip'}
              aria-pressed={on}
              onClick={() => onChange(on ? values.filter((v) => v !== o.value) : [...values, o.value])}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
