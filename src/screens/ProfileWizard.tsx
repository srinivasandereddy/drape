import { Check, ChevronLeft } from 'lucide-react'
import { useId, useState } from 'react'
import { ChoiceChips, MultiChips } from '../components/Chips'
import { CitySearch } from '../components/CitySearch'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/toastContext'
import { ColorPick } from '../components/ColorPick'
import { PALETTE } from '../lib/color'
import { METAL_LABELS, PATTERN_LABELS, type Metal, type Pattern } from '../lib/catalog'
import { optionsFrom } from '../lib/options'
import {
  bodyShapesFor,
  EYE_COLORS,
  FITS,
  HAIR_COLORS,
  seasonFor,
  SEASONS,
  SKIN_TONES,
  undertoneFrom,
  type EyeColor,
  type Fit,
  type HairColor,
  type MetalAnswer,
  type SkinTone,
  type SunAnswer,
  type Undertone,
  type VeinAnswer,
} from '../lib/personal'
import type { DoshaResult } from '../lib/dosha'
import {
  CURRENCIES,
  ROUTINES,
  saveProfile,
  THEMES,
  useProfile,
  type GenderKind,
  type Profile,
  type RoutineId,
  type ThemeId,
  type Currency,
} from '../lib/profile'
import { STYLES, stylesFor, type StyleId } from '../lib/styles'
import { cityLabel } from '../lib/weather'
import { WIZARD_STEPS, type WizardStep } from '../lib/wizardSteps'
import { DoshaQuiz, DoshaResultCard } from './DoshaQuiz'


const STEPS = WIZARD_STEPS.map((s) => s.label)
const PATTERN_OPTIONS = optionsFrom<Pattern>(PATTERN_LABELS).filter((o) => o.value !== 'solid' && o.value !== 'other')
const AGES = Array.from({ length: 100 }, (_, i) => i + 1)

type Props = { onClose: () => void; startAt?: WizardStep; defaultName?: string }

/** Short steps that make suggestions personal. Every step is optional and can be changed later. */
export function ProfileWizard({ onClose, startAt = 'about', defaultName = '' }: Props) {
  const toast = useToast()
  const { profile } = useProfile()
  const [step, setStep] = useState(() => Math.max(0, WIZARD_STEPS.findIndex((s) => s.id === startAt)))
  const id = WIZARD_STEPS[step]!.id
  const [undertoneHelp, setUndertoneHelp] = useState<{ veins?: VeinAnswer; metal?: MetalAnswer; sun?: SunAnswer } | null>(null)
  const [draft, setDraft] = useState<Profile>(() => ({ ...profile, name: profile.name || defaultName }))
  const [quizOpen, setQuizOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [allStyles, setAllStyles] = useState(false)
  const ids = { name: useId(), age: useId(), gender: useId(), height: useId(), weight: useId(), metal: useId(), top: useId(), bottom: useId(), shoe: useId(), budget: useId() }
  const season = seasonFor(draft.skinTone, draft.undertone, draft.hair, draft.eyes)
  const set = (patch: Partial<Profile>) => setDraft((d) => ({ ...d, ...patch }))
  const last = step === STEPS.length - 1
  // Closing without finishing undoes the theme preview.
  const cancel = () => {
    document.documentElement.dataset.look = profile.theme
    onClose()
  }

  async function finish() {
    setSaving(true)
    try {
      await saveProfile({ ...draft, onboarded: true })
      toast('Profile saved')
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save your profile.', 'error')
      setSaving(false)
    }
  }

  // Styles suggested for the chosen gender first; anything already picked always stays visible.
  const styleOptions = (group: 'fashion' | 'activity') => {
    const offered = allStyles ? STYLES.filter((s) => s.group === group) : stylesFor(draft.gender.kind, group)
    const extra = STYLES.filter((s) => s.group === group && draft.styles.includes(s.id) && !offered.includes(s))
    return [...offered, ...extra].map((s) => ({ value: s.id, label: s.label }))
  }

  const numberOrNull = (v: string, min: number, max: number) => {
    const n = Number(v)
    return v.trim() === '' || !Number.isFinite(n) || n < min || n > max ? null : Math.round(n)
  }

  return (
    <Sheet
      title={STEPS[step]!}
      onClose={cancel}
      footer={
        !quizOpen && (
          <div className="row-actions">
            {step > 0 && (
              <button type="button" className="btn" onClick={() => setStep(step - 1)}>
                <ChevronLeft size={18} aria-hidden="true" /> Back
              </button>
            )}
            {!last && (
              <button type="button" className="btn" onClick={() => void finish()} disabled={saving}>
                Finish later
              </button>
            )}
            {last ? (
              <button type="button" className="btn primary" onClick={() => void finish()} disabled={saving}>
                <Check size={18} aria-hidden="true" /> {saving ? 'Saving…' : 'Finish'}
              </button>
            ) : (
              <button type="button" className="btn primary" onClick={() => setStep(step + 1)}>
                Next
              </button>
            )}
          </div>
        )
      }
    >
      <div className="stack">
        <ol className="wizard-dots" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <li key={s} className={i === step ? 'on' : i < step ? 'done' : ''}>
              <button type="button" onClick={() => setStep(i)} aria-label={s} aria-current={i === step ? 'step' : undefined} />
            </li>
          ))}
        </ol>

        {id === 'about' && (
          <div className="form">
            <div className="field">
              <label className="field-label" htmlFor={ids.name}>
                Name
              </label>
              <input id={ids.name} className="text-input" value={draft.name} maxLength={40} autoComplete="given-name" onChange={(e) => set({ name: e.target.value })} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor={ids.age}>
                Age
              </label>
              <select id={ids.age} className="text-input" value={draft.age ?? ''} onChange={(e) => set({ age: e.target.value ? Number(e.target.value) : null })}>
                <option value="">Prefer not to say</option>
                {AGES.map((a) => (
                  <option key={a} value={a}>
                    {a === 100 ? '100+' : a}
                  </option>
                ))}
              </select>
            </div>
            <ChoiceChips<GenderKind>
              label="Gender"
              options={[
                { value: 'female', label: 'Female' },
                { value: 'male', label: 'Male' },
                { value: 'other', label: 'Non-binary / other' },
              ]}
              value={draft.gender.kind}
              onChange={(kind) => set({ gender: { ...draft.gender, kind } })}
              clearable
            />
            {draft.gender.kind === 'other' && (
              <div className="field">
                <label className="field-label" htmlFor={ids.gender}>
                  In your words <span className="field-hint">· optional</span>
                </label>
                <input id={ids.gender} className="text-input" value={draft.gender.custom} maxLength={40} onChange={(e) => set({ gender: { ...draft.gender, custom: e.target.value } })} />
              </div>
            )}
            <div className="two-col">
              <div className="field">
                <label className="field-label" htmlFor={ids.height}>
                  Height <span className="field-hint">· cm, optional</span>
                </label>
                <input
                  id={ids.height}
                  className="text-input"
                  type="number"
                  inputMode="numeric"
                  min={50}
                  max={250}
                  defaultValue={draft.heightCm ?? ''}
                  onChange={(e) => set({ heightCm: numberOrNull(e.target.value, 50, 250) })}
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor={ids.weight}>
                  Weight <span className="field-hint">· kg, optional</span>
                </label>
                <input
                  id={ids.weight}
                  className="text-input"
                  type="number"
                  inputMode="numeric"
                  min={10}
                  max={300}
                  defaultValue={draft.weightKg ?? ''}
                  onChange={(e) => set({ weightKg: numberOrNull(e.target.value, 10, 300) })}
                />
              </div>
            </div>
            <p className="muted small">Age, gender, height and weight stay on your phone and in your own Drive. They never limit what Drape will suggest.</p>
          </div>
        )}

        {id === 'coloring' && (
          <div className="form">
            <SwatchChoice label="Skin tone" options={SKIN_TONES} value={draft.skinTone} onChange={(skinTone) => set({ skinTone: skinTone as SkinTone | null })} />
            <ChoiceChips<Undertone>
              label="Undertone"
              hint="the hue under your skin"
              options={[
                { value: 'warm', label: 'Warm (golden, peachy)' },
                { value: 'cool', label: 'Cool (pink, rosy)' },
                { value: 'neutral', label: 'Neutral' },
              ]}
              value={draft.undertone}
              onChange={(undertone) => set({ undertone })}
              clearable
            />
            {!undertoneHelp ? (
              <button type="button" className="link small" onClick={() => setUndertoneHelp({})}>
                Not sure? Answer 3 quick questions
              </button>
            ) : (
              <div className="card stack-sm">
                <ChoiceChips<VeinAnswer>
                  label="The veins on your wrist look…"
                  options={[
                    { value: 'green', label: 'Greenish' },
                    { value: 'blue', label: 'Blue or purple' },
                    { value: 'both', label: 'Hard to say' },
                  ]}
                  value={undertoneHelp.veins ?? null}
                  onChange={(veins) => veins && setUndertoneHelp({ ...undertoneHelp, veins })}
                />
                <ChoiceChips<MetalAnswer>
                  label="Which jewellery makes your skin glow?"
                  options={[
                    { value: 'gold', label: 'Gold' },
                    { value: 'silver', label: 'Silver' },
                    { value: 'both', label: 'Both' },
                  ]}
                  value={undertoneHelp.metal ?? null}
                  onChange={(metal) => metal && setUndertoneHelp({ ...undertoneHelp, metal })}
                />
                <ChoiceChips<SunAnswer>
                  label="In the sun, you…"
                  options={[
                    { value: 'tan', label: 'Tan easily' },
                    { value: 'burn', label: 'Burn first' },
                    { value: 'both', label: 'A bit of both' },
                  ]}
                  value={undertoneHelp.sun ?? null}
                  onChange={(sun) => sun && setUndertoneHelp({ ...undertoneHelp, sun })}
                />
                <button
                  type="button"
                  className="btn"
                  disabled={!undertoneHelp.veins || !undertoneHelp.metal || !undertoneHelp.sun}
                  onClick={() => {
                    set({ undertone: undertoneFrom(undertoneHelp.veins!, undertoneHelp.metal!, undertoneHelp.sun!) })
                    setUndertoneHelp(null)
                  }}
                >
                  Work out my undertone
                </button>
              </div>
            )}
            <SwatchChoice label="Hair color" options={HAIR_COLORS} value={draft.hair} onChange={(hair) => set({ hair: hair as HairColor | null })} />
            <SwatchChoice label="Eye color" options={EYE_COLORS} value={draft.eyes} onChange={(eyes) => set({ eyes: eyes as EyeColor | null })} />
            {season ? (
              <div className="card stack-sm season-card">
                <p className="muted small">Your color season</p>
                <h3>{SEASONS[season].label}</h3>
                <p className="small">{SEASONS[season].summary}</p>
                <div className="season-swatches" aria-label="Colors that flatter you">
                  {SEASONS[season].best.map((n) => (
                    <i key={n} title={n} className="swatch lg" style={{ background: paletteHex(n) }} />
                  ))}
                </div>
                <p className="muted small">Metal that suits you: {SEASONS[season].metal}.</p>
              </div>
            ) : (
              <p className="muted small">Choose your skin tone and undertone to see your color season and the colors that flatter you most.</p>
            )}
          </div>
        )}

        {id === 'shape' && (
          <div className="form">
            <div className="field" role="radiogroup" aria-label="Body shape">
              <div className="field-label">
                Body shape <span className="field-hint">· optional, for styling tips</span>
              </div>
              <div className="shape-list">
                {bodyShapesFor(draft.gender.kind).map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    role="radio"
                    aria-checked={draft.bodyShape === b.id}
                    className={draft.bodyShape === b.id ? 'shape-card on' : 'shape-card'}
                    onClick={() => set({ bodyShape: draft.bodyShape === b.id ? null : b.id })}
                  >
                    <b>{b.label}</b>
                    <span className="muted small">{b.hint}</span>
                  </button>
                ))}
              </div>
            </div>
            <ChoiceChips<Fit> label="How do you like clothes to fit?" options={FITS.map((f) => ({ value: f.id, label: f.label }))} value={draft.fit} onChange={(fit) => set({ fit })} clearable />
          </div>
        )}

        {id === 'colors' && (
          <div className="form">
            <ColorPick label="Colors you love" hint="Drape leans towards these" values={draft.favoriteColors} disabled={draft.avoidColors} onChange={(favoriteColors) => set({ favoriteColors })} />
            <ColorPick label="Colors you never wear" hint="Drape avoids these" values={draft.avoidColors} disabled={draft.favoriteColors} onChange={(avoidColors) => set({ avoidColors })} />
            <MultiChips<Pattern> label="Patterns you love" options={PATTERN_OPTIONS} values={draft.lovePatterns} onChange={(lovePatterns) => set({ lovePatterns, avoidPatterns: draft.avoidPatterns.filter((p) => !lovePatterns.includes(p)) })} />
            <MultiChips<Pattern> label="Patterns you avoid" options={PATTERN_OPTIONS} values={draft.avoidPatterns} onChange={(avoidPatterns) => set({ avoidPatterns, lovePatterns: draft.lovePatterns.filter((p) => !avoidPatterns.includes(p)) })} />
          </div>
        )}

        {id === 'sizes' && (
          <div className="form">
            <div className="two-col">
              <div className="field">
                <label className="field-label" htmlFor={ids.top}>
                  Top size
                </label>
                <input id={ids.top} className="text-input" placeholder="e.g. M, 40" value={draft.sizes.top} maxLength={12} onChange={(e) => set({ sizes: { ...draft.sizes, top: e.target.value } })} />
              </div>
              <div className="field">
                <label className="field-label" htmlFor={ids.bottom}>
                  Bottom size
                </label>
                <input id={ids.bottom} className="text-input" placeholder="e.g. 32, M" value={draft.sizes.bottom} maxLength={12} onChange={(e) => set({ sizes: { ...draft.sizes, bottom: e.target.value } })} />
              </div>
            </div>
            <div className="field">
              <label className="field-label" htmlFor={ids.shoe}>
                Shoe size
              </label>
              <input id={ids.shoe} className="text-input" placeholder="e.g. UK 8" value={draft.sizes.shoe} maxLength={12} onChange={(e) => set({ sizes: { ...draft.sizes, shoe: e.target.value } })} />
            </div>
            <ChoiceChips<Currency> label="Currency" options={CURRENCIES.map((c) => ({ value: c, label: c }))} value={draft.currency} onChange={(currency) => currency && set({ currency })} />
            <div className="field">
              <label className="field-label" htmlFor={ids.budget}>
                Usual spend on one piece <span className="field-hint">· optional, for the shopping advisor</span>
              </label>
              <input
                id={ids.budget}
                className="text-input"
                type="number"
                inputMode="numeric"
                min={0}
                defaultValue={draft.budget ?? ''}
                onChange={(e) => set({ budget: numberOrNull(e.target.value, 0, 10_000_000) })}
              />
            </div>
            <p className="muted small">Sizes are a handy note for shopping; they don't change suggestions.</p>
          </div>
        )}

        {id === 'days' && (
          <div className="form">
            {draft.city ? (
              <div className="kv">
                <span>City</span>
                <button type="button" className="link" onClick={() => set({ city: null })}>
                  {cityLabel(draft.city)} · Change
                </button>
              </div>
            ) : (
              <CitySearch onSelect={(city) => set({ city })} />
            )}
            <ChoiceChips<RoutineId>
              label="What does a normal weekday look like?"
              options={ROUTINES.map((r) => ({ value: r.id, label: r.label }))}
              value={draft.routine}
              onChange={(routine) => set({ routine })}
              clearable
            />
          </div>
        )}

        {id === 'style' && (
          <div className="form">
            <MultiChips<StyleId>
              label="Styles you love"
              hint="pick any"
              options={styleOptions('fashion')}
              values={draft.styles}
              onChange={(styles) => set({ styles })}
            />
            <MultiChips<StyleId>
              label="Activities you dress for"
              hint="pick any"
              options={styleOptions('activity')}
              values={draft.styles}
              onChange={(styles) => set({ styles })}
            />
            {draft.gender.kind && draft.gender.kind !== 'other' && !allStyles && (
              <button type="button" className="link small" onClick={() => setAllStyles(true)}>
                Show all styles
              </button>
            )}
            <ChoiceChips<Metal>
              label="Jewellery metal"
              options={(['gold', 'silver', 'rose-gold', 'other'] as Metal[]).map((m) => ({ value: m, label: METAL_LABELS[m] }))}
              value={draft.metal.kind}
              onChange={(kind) => set({ metal: { ...draft.metal, kind } })}
              clearable
            />
            {draft.metal.kind === 'other' && (
              <div className="field">
                <label className="field-label" htmlFor={ids.metal}>
                  Which metal?
                </label>
                <input id={ids.metal} className="text-input" placeholder="e.g. Gunmetal, oxidised silver" value={draft.metal.custom} maxLength={40} onChange={(e) => set({ metal: { ...draft.metal, custom: e.target.value } })} />
              </div>
            )}
          </div>
        )}

        {id === 'body' &&
          (quizOpen ? (
            <DoshaQuiz
              onDone={(dosha: DoshaResult) => {
                set({ dosha })
                setQuizOpen(false)
              }}
              onSkip={() => setQuizOpen(false)}
            />
          ) : (
            <div className="stack">
              {draft.dosha ? (
                <DoshaResultCard result={draft.dosha} />
              ) : (
                <p>
                  A 10-question Ayurveda quiz about your body frame, temperature, skin, sleep and more. Drape uses the result to
                  tune how warm to dress you and which fabrics and colors to favor.
                </p>
              )}
              <button type="button" className="btn" onClick={() => setQuizOpen(true)}>
                {draft.dosha ? 'Retake the quiz' : 'Take the quiz (2 minutes)'}
              </button>
              {draft.dosha && (
                <button type="button" className="btn danger-ghost" onClick={() => set({ dosha: null })}>
                  Don't use my dosha
                </button>
              )}
            </div>
          ))}

        {id === 'look' && (
          <div className="form">
            <div className="field" role="radiogroup" aria-label="App colors">
              <div className="field-label">App colors</div>
              <div className="theme-grid">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={draft.theme === t.id}
                    className={draft.theme === t.id ? 'theme-card on' : 'theme-card'}
                    onClick={() => {
                      set({ theme: t.id as ThemeId })
                      document.documentElement.dataset.look = t.id
                    }}
                  >
                    <span className="theme-swatch" style={{ background: t.swatch[0] }}>
                      <i style={{ background: t.swatch[1] }} />
                    </span>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="muted small">Pick whatever feels like you. You can change it any time in Settings.</p>
          </div>
        )}
      </div>
    </Sheet>
  )
}

const PALETTE_BY_NAME = new Map(PALETTE.map((p) => [p.name, p.hex]))
const paletteHex = (name: string) => PALETTE_BY_NAME.get(name) ?? '#999999'

function SwatchChoice({ label, options, value, onChange }: { label: string; options: readonly { id: string; label: string; hex: string }[]; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <div className="field" role="radiogroup" aria-label={label}>
      <div className="field-label">
        {label} <span className="field-hint">· optional</span>
      </div>
      <div className="swatch-choice">
        {options.map((o) => (
          <button key={o.id} type="button" role="radio" aria-checked={value === o.id} className={value === o.id ? 'swatch-opt on' : 'swatch-opt'} onClick={() => onChange(value === o.id ? null : o.id)}>
            <i style={{ background: o.hex }} aria-hidden="true" />
            <span>{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
