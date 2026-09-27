import { useId } from 'react'
import {
  CATEGORIES,
  FORMALITY_LABELS,
  METAL_LABELS,
  PATTERN_LABELS,
  SEASON_LABELS,
  WARMTH_LABELS,
  categoryDef,
  type CategoryId,
  type Formality,
  type Metal,
  type Pattern,
  type Season,
  type Warmth,
} from '../lib/catalog'
import { NAME_MAX, sanitizeDraft, type GarmentDraft } from '../lib/model'
import { optionsFrom } from '../lib/options'
import { ChoiceChips, MultiChips } from './Chips'

const CATEGORY_OPTIONS = CATEGORIES.map((c) => ({ value: c.id, label: c.label }))
const FORMALITY_OPTIONS = optionsFrom<Formality>(FORMALITY_LABELS, true)
const WARMTH_OPTIONS = optionsFrom<Warmth>(WARMTH_LABELS, true)
const PATTERN_OPTIONS = optionsFrom<Pattern>(PATTERN_LABELS)
const SEASON_OPTIONS = optionsFrom<Season>(SEASON_LABELS)
const METAL_OPTIONS = optionsFrom<Metal>(METAL_LABELS)

type Props = { draft: GarmentDraft; onChange: (d: GarmentDraft) => void }

export function GarmentForm({ draft, onChange }: Props) {
  const nameId = useId()
  const set = (patch: Partial<GarmentDraft>) => onChange(sanitizeDraft({ ...draft, ...patch }))
  const def = draft.category ? categoryDef(draft.category) : null

  return (
    <div className="form">
      <ChoiceChips<CategoryId>
        label="What is it?"
        options={CATEGORY_OPTIONS}
        value={draft.category}
        onChange={(category) => category && set({ category })}
      />

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
        </>
      )}
    </div>
  )
}
