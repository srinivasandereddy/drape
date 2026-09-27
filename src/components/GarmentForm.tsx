import { useId } from 'react'
import {
  CATEGORIES,
  COVERAGE_LABELS,
  defaultCoverage,
  FABRIC_LABELS,
  FORMALITY_LABELS,
  METAL_LABELS,
  PATTERN_LABELS,
  SEASON_LABELS,
  WARMTH_LABELS,
  categoryDef,
  type CategoryId,
  type Coverage,
  type Fabric,
  type Formality,
  type Metal,
  type Pattern,
  type Season,
  type Warmth,
} from '../lib/catalog'
import { colorName } from '../lib/color'
import { NAME_MAX, sanitizeDraft, type GarmentDraft } from '../lib/model'
import { guessStyles, STYLES, styleDef, type StyleId } from '../lib/styles'
import { optionsFrom } from '../lib/options'
import { ChoiceChips, MultiChips } from './Chips'
import { ColorsField } from './ColorSwatches'

const CATEGORY_OPTIONS = CATEGORIES.map((c) => ({ value: c.id, label: c.label }))
const FORMALITY_OPTIONS = optionsFrom<Formality>(FORMALITY_LABELS, true)
const WARMTH_OPTIONS = optionsFrom<Warmth>(WARMTH_LABELS, true)
const PATTERN_OPTIONS = optionsFrom<Pattern>(PATTERN_LABELS)
const SEASON_OPTIONS = optionsFrom<Season>(SEASON_LABELS)
const METAL_OPTIONS = optionsFrom<Metal>(METAL_LABELS)
const FABRIC_OPTIONS = optionsFrom<Fabric>(FABRIC_LABELS)
const COVERAGE_OPTIONS = optionsFrom<Coverage>(COVERAGE_LABELS, true)
const STYLE_OPTIONS = STYLES.map((s) => ({ value: s.id, label: s.label }))

type Props = { draft: GarmentDraft; onChange: (d: GarmentDraft) => void; colorStatus?: string | null }

export function GarmentForm({ draft, onChange, colorStatus }: Props) {
  const nameId = useId()
  const set = (patch: Partial<GarmentDraft>) => onChange(sanitizeDraft({ ...draft, ...patch }))
  const def = draft.category ? categoryDef(draft.category) : null
  const guessed = guessStyles({ styleTags: [], subtype: draft.subtype }, draft.colors[0] ? colorName(draft.colors[0].hex) : null).slice(0, 3)

  return (
    <div className="form">
      <ChoiceChips<CategoryId>
        label="What is it?"
        options={CATEGORY_OPTIONS}
        value={draft.category}
        onChange={(category) => category && set({ category })}
      />

      <ColorsField colors={draft.colors} status={colorStatus} onChange={(colors) => set({ colors, colorsEdited: true })} />

      {def && (
        <>
          <ChoiceChips<string>
            label="Type"
            hint="optional"
            options={def.subtypes.map((s) => ({ value: s, label: s }))}
            value={draft.subtype || null}
            onChange={(subtype) => set({ subtype: subtype ?? '' })}
            clearable
          />

          <div className="field">
            <label className="field-label" htmlFor={nameId}>
              Name <span className="field-hint">· optional, e.g. "Blue linen shirt"</span>
            </label>
            <input
              id={nameId}
              className="text-input"
              type="text"
              value={draft.name}
              maxLength={NAME_MAX}
              autoComplete="off"
              enterKeyHint="done"
              onChange={(e) => set({ name: e.target.value })}
            />
          </div>

          <ChoiceChips<Formality>
            label="How dressy?"
            options={FORMALITY_OPTIONS}
            value={draft.formality}
            onChange={(formality) => formality && set({ formality })}
          />

          {def.has.warmth && (
            <ChoiceChips<Warmth>
              label="Warmth"
              hint="optional"
              options={WARMTH_OPTIONS}
              value={draft.warmth}
              onChange={(warmth) => set({ warmth })}
              clearable
            />
          )}

          {def.has.pattern && (
            <ChoiceChips<Pattern>
              label="Pattern"
              hint="optional"
              options={PATTERN_OPTIONS}
              value={draft.pattern}
              onChange={(pattern) => set({ pattern })}
              clearable
            />
          )}

          {def.has.metal && (
            <ChoiceChips<Metal>
              label="Metal"
              hint="optional"
              options={METAL_OPTIONS}
              value={draft.metal}
              onChange={(metal) => set({ metal })}
              clearable
            />
          )}

          <MultiChips<Season>
            label="Seasons"
            hint="leave empty for all year"
            options={SEASON_OPTIONS}
            values={draft.seasons}
            onChange={(seasons) => set({ seasons })}
          />

          {(def.has.warmth || def.id === 'footwear' || def.id === 'bag') && (
            <ChoiceChips<Fabric> label="Fabric" hint="optional" options={FABRIC_OPTIONS} value={draft.fabric} onChange={(fabric) => set({ fabric })} clearable />
          )}

          {def.has.warmth && def.id !== 'footwear' && (
            <ChoiceChips<Coverage>
              label="Coverage"
              hint={draft.coverage === null ? `guessed: ${COVERAGE_LABELS[defaultCoverage(def.id, draft.subtype)]}` : 'set by you'}
              options={COVERAGE_OPTIONS}
              value={draft.coverage ?? defaultCoverage(def.id, draft.subtype)}
              onChange={(coverage) => set({ coverage })}
            />
          )}

          <MultiChips<StyleId>
            label="Style"
            hint={guessed.length ? `Drape guesses ${guessed.map((s) => styleDef(s).label).join(', ')}` : 'optional'}
            options={STYLE_OPTIONS}
            values={draft.styleTags}
            onChange={(styleTags) => set({ styleTags })}
          />
        </>
      )}
    </div>
  )
}
