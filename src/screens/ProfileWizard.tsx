import { Check, ChevronLeft } from 'lucide-react'
import { useId, useState } from 'react'
import { ChoiceChips, MultiChips } from '../components/Chips'
import { CitySearch } from '../components/CitySearch'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/toastContext'
import { METAL_LABELS, type Metal } from '../lib/catalog'
import type { DoshaResult } from '../lib/dosha'
import {
  ROUTINES,
  saveProfile,
  THEMES,
  useProfile,
  type GenderKind,
  type Profile,
  type RoutineId,
  type ThemeId,
} from '../lib/profile'
import { STYLES, stylesFor, type StyleId } from '../lib/styles'
import { cityLabel } from '../lib/weather'
import { DoshaQuiz, DoshaResultCard } from './DoshaQuiz'

const STEPS = ['About you', 'Your days', 'Your style', 'Body comfort', 'Your look'] as const
const AGES = Array.from({ length: 100 }, (_, i) => i + 1)

type Props = { onClose: () => void; startAt?: number; defaultName?: string }

/** Five short steps that make suggestions personal. Every step can be changed later. */
export function ProfileWizard({ onClose, startAt = 0, defaultName = '' }: Props) {
  const toast = useToast()
  const { profile } = useProfile()
  const [step, setStep] = useState(startAt)
  const [draft, setDraft] = useState<Profile>(() => ({ ...profile, name: profile.name || defaultName }))
  const [quizOpen, setQuizOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [allStyles, setAllStyles] = useState(false)
  const ids = { name: useId(), age: useId(), gender: useId(), height: useId(), weight: useId(), metal: useId() }
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

        {step === 0 && (
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

        {step === 1 && (
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

        {step === 2 && (
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

        {step === 3 &&
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

        {step === 4 && (
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
