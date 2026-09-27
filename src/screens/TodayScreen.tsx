import { Check, CloudRain, Droplets, Heart, MapPin, RefreshCw, Repeat, Shuffle, Sparkles, Sun, Thermometer, ThumbsDown, Wind } from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { ChoiceChips } from '../components/Chips'
import { PieceImage } from '../components/PieceImage'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/toastContext'
import { accountPrefs } from '../lib/account'
import { listFeedback, saveFeedback, todaysOutfit, useCloset, wearOutfit } from '../lib/closet'
import { colorName } from '../lib/color'
import { applyDislike, learnAffinity, NO_ADJUST, type Affinity, type DayAdjust, type DislikeReason } from '../lib/feedback'
import { parseIntent } from '../lib/intent'
import type { Garment } from '../lib/model'
import {
  explain,
  missingForOutfits,
  OCCASIONS,
  pieceLabel,
  scoreOutfit,
  slotOf,
  suggestOutfits,
  type OccasionId,
  type Outfit,
  type OutfitContext,
} from '../lib/outfit'
import { colorsInText } from '../lib/parser'
import { useProfile } from '../lib/profile'
import { loadSampleWardrobe } from '../lib/sampleLoader'
import { parseStyles, styleDef } from '../lib/styles'
import { FEELING_LABELS, THERMAL_LABELS, type Feeling } from '../lib/thermal'
import { useWeather } from '../lib/useWeather'
import { cityLabel, describeCode, isRainy, searchCities, type City, type Weather } from '../lib/weather'
import { DislikeSheet } from './DislikeSheet'
import { SwapSheet } from './SwapSheet'

const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
const MAIN = new Set(['top', 'bottom', 'onepiece', 'layer', 'footwear'])

/** What the person told Drape about today. Kept per account, reset each day. */
interface DayState {
  date: string
  feeling: Feeling | null
  where: string
  vibe: string
  occasion: OccasionId | null
  adjust: DayAdjust
  useHome: boolean
}

const todayKey = () => new Date().toDateString()
function loadDay(): DayState {
  const fresh: DayState = { date: todayKey(), feeling: null, where: '', vibe: '', occasion: null, adjust: NO_ADJUST, useHome: false }
  try {
    const raw = accountPrefs.get('today')
    const saved = raw ? (JSON.parse(raw) as Partial<DayState>) : null
    if (!saved || saved.date !== fresh.date) return fresh
    return { ...fresh, ...saved, adjust: { ...NO_ADJUST, ...saved.adjust } }
  } catch {
    return fresh
  }
}

type Props = { onAdd: () => void; onQuickAdd: () => void; onEditProfile: () => void }

export function TodayScreen({ onAdd, onQuickAdd, onEditProfile }: Props) {
  const toast = useToast()
  const ids = { where: useId(), vibe: useId() }
  const { garments, status } = useCloset()
  const { loaded, profile } = useProfile()

  const [day, setDayState] = useState<DayState>(loadDay)
  const setDay = useCallback((patch: Partial<DayState>) => {
    setDayState((d) => {
      const next = { ...d, ...patch }
      accountPrefs.set('today', JSON.stringify(next))
      return next
    })
  }, [])

  // ----- where are you going: occasion and maybe another city -----
  const intent = useMemo(() => parseIntent(day.where), [day.where])
  const [dest, setDest] = useState<{ query: string; city: City | null }>({ query: '', city: null })
  useEffect(() => {
    const place = intent.place
    if (!place || place === dest.query) return
    let cancelled = false
    const t = setTimeout(() => {
      searchCities(place)
        .then((r) => {
          if (!cancelled) setDest({ query: place, city: r[0] ?? null })
        })
        .catch(() => {
          if (!cancelled) setDest({ query: place, city: null })
        })
    }, 600)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [intent.place, dest.query])
  const destCity = intent.place && dest.query === intent.place && !day.useHome ? dest.city : null
  const activeCity = destCity ?? profile.city
  const wx = useWeather(activeCity)

  // ----- vibe -----
  const vibeStyles = useMemo(() => parseStyles(day.vibe), [day.vibe])
  const wishColors = useMemo(() => [...new Set(colorsInText(day.vibe).map(colorName))], [day.vibe])
  const occasion: OccasionId = day.occasion ?? intent.occasion ?? 'casual'

  // ----- learned taste -----
  const [affinity, setAffinity] = useState<Affinity | null>(null)
  const [feedbackTick, setFeedbackTick] = useState(0)
  const refreshAffinity = () => setFeedbackTick((t) => t + 1)
  useEffect(() => {
    let cancelled = false
    void listFeedback().then((records) => {
      if (!cancelled) setAffinity(learnAffinity(records, new Map(garments.map((g) => [g.id, g]))))
    })
    return () => {
      cancelled = true
    }
  }, [garments, feedbackTick])

  // ----- today's logged outfit -----
  const [now] = useState(() => new Date())
  const [wornIds, setWornIds] = useState<string[] | null>(null)
  const [showIdeas, setShowIdeas] = useState(false)
  useEffect(() => {
    let cancelled = false
    void todaysOutfit().then((o) => {
      if (!cancelled) setWornIds(o?.garmentIds ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const ctx: OutfitContext = useMemo(
    () => ({
      occasion,
      routine: profile.routine,
      weather: wx.weather,
      now,
      feeling: day.feeling,
      dosha: profile.dosha?.primary ?? null,
      styles: vibeStyles.length ? vibeStyles : profile.styles,
      wishColors,
      modesty: profile.modesty,
      metal: profile.metal.kind,
      affinity,
      adjust: day.adjust,
      formalityShift: intent.formalityShift,
      preferShoes: intent.preferShoes,
    }),
    [occasion, profile, wx.weather, now, day.feeling, day.adjust, vibeStyles, wishColors, affinity, intent],
  )

  const [index, setIndex] = useState(0)
  const [custom, setCustom] = useState<Outfit | null>(null)
  const outfits = useMemo(() => suggestOutfits(garments, ctx), [garments, ctx])
  const suggestion = custom ?? (outfits.length ? outfits[index % outfits.length]! : null)
  const worn = useMemo(() => {
    if (!wornIds) return null
    const pieces = wornIds.map((id) => garments.find((g) => g.id === id)).filter((g): g is Garment => !!g)
    return pieces.length ? scoreOutfit(pieces, ctx) : null
  }, [wornIds, garments, ctx])
  const showingWorn = worn && !showIdeas
  const outfit = showingWorn ? worn : suggestion
  const missing = missingForOutfits(garments)

  const [swapPicker, setSwapPicker] = useState(false)
  const [swapFor, setSwapFor] = useState<Garment | null>(null)
  const [disliking, setDisliking] = useState(false)
  const [busy, setBusy] = useState(false)

  const resetIdeas = () => {
    setIndex(0)
    setCustom(null)
  }

  async function wear() {
    if (!outfit || busy) return
    setBusy(true)
    try {
      const rec = await wearOutfit(outfit.pieces.map((p) => p.id), occasion)
      setWornIds(rec.garmentIds)
      setShowIdeas(false)
      setCustom(null)
      toast('Logged as today’s outfit. Have a good day!')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save. Try again.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function love() {
    if (!outfit) return
    try {
      await saveFeedback(outfit.pieces.map((p) => p.id), 'love', null)
      refreshAffinity()
      toast('Saved. Drape will suggest looks like this more often.')
    } catch {
      toast('Could not save that. Try again.', 'error')
    }
  }

  async function dislike(reason: DislikeReason, note: string) {
    if (!outfit) return
    setDisliking(false)
    setDay({ adjust: applyDislike(day.adjust, reason, outfit.pieces) })
    resetIdeas()
    try {
      await saveFeedback(outfit.pieces.map((p) => p.id), 'dislike', reason, note)
      refreshAffinity()
    } catch {
      // Today's adjustment still applies even if saving failed.
    }
    toast('Got it. Here’s another idea.')
  }

  async function trySample() {
    setBusy(true)
    try {
      const n = await loadSampleWardrobe(profile.gender.kind)
      toast(`Added ${n} sample pieces. Remove them any time in Settings.`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not add the samples.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const adjusted = JSON.stringify(day.adjust) !== JSON.stringify(NO_ADJUST)

  return (
    <section className="screen" aria-labelledby="today-title">
      <div className="screen-head">
        <p className="muted">{dayFmt.format(now)}</p>
        <h1 id="today-title">{profile.name ? `What to wear, ${profile.name.split(' ')[0]}` : 'What to wear today'}</h1>
      </div>

      {loaded && !profile.onboarded && (
        <div className="card stack-sm">
          <h2>Make it yours</h2>
          <p className="muted small">Five quick steps: about you, your days, your style, body comfort and your look. Suggestions get much better.</p>
          <button type="button" className="btn primary" onClick={onEditProfile}>
            Set up my profile
          </button>
        </div>
      )}

      {activeCity ? (
        <WeatherCard city={cityLabel(activeCity)} isDestination={!!destCity} onUseHome={() => setDay({ useHome: true })} thermal={outfit?.thermal.index ?? null} {...wx} />
      ) : (
        loaded &&
        profile.onboarded && (
          <button type="button" className="notice-btn" onClick={onEditProfile}>
            <MapPin size={16} aria-hidden="true" /> Add your city to get weather-aware outfits
          </button>
        )
      )}

      <ChoiceChips<Feeling>
        label="How do you feel today?"
        options={(['warm', 'neutral', 'cold'] as Feeling[]).map((f) => ({ value: f, label: FEELING_LABELS[f] }))}
        value={day.feeling}
        onChange={(feeling) => {
          setDay({ feeling })
          resetIdeas()
        }}
        clearable
      />

      <div className="field">
        <label className="field-label" htmlFor={ids.where}>
          Where are you going today?
        </label>
        <input
          id={ids.where}
          className="text-input"
          type="text"
          placeholder='e.g. "Office presentation", "Dinner date in Paris"'
          value={day.where}
          maxLength={80}
          enterKeyHint="done"
          onChange={(e) => {
            setDay({ where: e.target.value, occasion: null, useHome: false })
            resetIdeas()
          }}
        />
        {day.where.trim() && (
          <p className="muted small">
            {intent.occasion ? `Reads as: ${OCCASIONS.find((o) => o.id === intent.occasion)!.label}` : 'Not sure what occasion that is; pick one below.'}
            {intent.formalityShift > 0 && ' · dress up a notch'}
            {intent.formalityShift < 0 && ' · keep it relaxed'}
            {intent.place && (destCity ? ` · weather for ${destCity.name}` : dest.query === intent.place && !day.useHome ? ` · couldn't find "${intent.place}"` : '')}
          </p>
        )}
      </div>

      <ChoiceChips<OccasionId>
        label="Occasion"
        options={OCCASIONS.map((o) => ({ value: o.id, label: o.label }))}
        value={occasion}
        onChange={(o) => {
          if (!o) return
          setDay({ occasion: o })
          resetIdeas()
        }}
      />

      <div className="field">
        <label className="field-label" htmlFor={ids.vibe}>
          Today's vibe <span className="field-hint">· optional</span>
        </label>
        <input
          id={ids.vibe}
          className="text-input"
          type="text"
          placeholder={profile.styles.length ? `Your usual: ${profile.styles.map((s) => styleDef(s).label).join(', ')}` : 'e.g. "90s grunge", "old money", "something in pink"'}
          value={day.vibe}
          maxLength={80}
          enterKeyHint="done"
          onChange={(e) => {
            setDay({ vibe: e.target.value })
            resetIdeas()
          }}
        />
        {(vibeStyles.length > 0 || wishColors.length > 0) && (
          <p className="muted small">Going for: {[...vibeStyles.map((s) => styleDef(s).label), ...wishColors.map((c) => c.toLowerCase())].join(', ')}</p>
        )}
      </div>

      {status === 'ready' && missing.length > 0 && (
        <div className="card stack-sm">
          <h2>{garments.length ? 'Add a few more pieces' : 'Your closet is empty'}</h2>
          <p className="muted">To build an outfit Drape needs {missing.join(' and ')}. Shoes help too.</p>
          <div className="row-actions">
            <button type="button" className="btn primary" onClick={onAdd}>
              Add a photo
            </button>
            <button type="button" className="btn" onClick={onQuickAdd}>
              Type a list
            </button>
          </div>
          {garments.length === 0 && (
            <button type="button" className="btn" disabled={busy} onClick={() => void trySample()}>
              Try a sample wardrobe
            </button>
          )}
        </div>
      )}

      {status === 'ready' && missing.length === 0 && !outfit && (
        <div className="card stack-sm">
          <h2>Nothing fits today's settings</h2>
          <p className="muted">Your coverage setting or today's "Don't like" answers rule out every combination. Loosen them, or add a few more pieces.</p>
          {adjusted && (
            <button type="button" className="btn" onClick={() => setDay({ adjust: NO_ADJUST })}>
              Undo today's "Don't like" answers
            </button>
          )}
          <button type="button" className="btn" onClick={onEditProfile}>
            Check my coverage setting
          </button>
        </div>
      )}

      {outfit && (
        <article className="card outfit" aria-label={showingWorn ? 'Today’s outfit' : 'Suggested outfit'}>
          <header className="outfit-head">
            {/* A worn outfit's score drops (its pieces were just worn), so show only the harmony. */}
            <span className={`badge ${showingWorn || outfit.score >= 80 ? 'good' : ''}`}>
              {showingWorn ? outfit.harmony.label : `${outfit.harmony.label} · ${outfit.score}`}
            </span>
            {showingWorn ? (
              <span className="muted small">
                <Check size={14} aria-hidden="true" /> Wearing today
              </span>
            ) : (
              !custom && outfits.length > 1 && <span className="muted small mono">{(index % outfits.length) + 1} of {outfits.length}</span>
            )}
          </header>

          <ul className="outfit-main">
            {outfit.pieces
              .filter((p) => MAIN.has(slotOf(p)))
              .map((p) => (
                <li key={p.id}>
                  <PieceButton piece={p} disabled={!!showingWorn} onClick={() => setSwapFor(p)} />
                </li>
              ))}
          </ul>
          {outfit.pieces.some((p) => !MAIN.has(slotOf(p))) && (
            <ul className="outfit-extras">
              {outfit.pieces
                .filter((p) => !MAIN.has(slotOf(p)))
                .map((p) => (
                  <li key={p.id}>
                    <PieceButton piece={p} small disabled={!!showingWorn} onClick={() => setSwapFor(p)} />
                  </li>
                ))}
            </ul>
          )}

          <div className="why">
            <h3>
              <Sparkles size={16} aria-hidden="true" /> Why this works
            </h3>
            <ul>
              {explain(outfit, ctx).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>

          {showingWorn ? (
            <button type="button" className="btn" onClick={() => setShowIdeas(true)}>
              <Shuffle size={18} aria-hidden="true" /> See other ideas
            </button>
          ) : (
            <div className="stack-sm">
              <div className="feedback-row">
                <button type="button" className="fb" onClick={() => void love()}>
                  <Heart size={20} aria-hidden="true" />
                  <span>Love it</span>
                </button>
                <button type="button" className="fb" onClick={() => setSwapPicker(true)}>
                  <Repeat size={20} aria-hidden="true" />
                  <span>Swap item</span>
                </button>
                <button type="button" className="fb" onClick={() => setDisliking(true)}>
                  <ThumbsDown size={20} aria-hidden="true" />
                  <span>Don't like</span>
                </button>
                <button
                  type="button"
                  className="fb"
                  disabled={outfits.length < 2 && !custom}
                  onClick={() => {
                    setCustom(null)
                    setIndex((i) => i + 1)
                  }}
                >
                  <Shuffle size={20} aria-hidden="true" />
                  <span>Shuffle</span>
                </button>
              </div>
              <button type="button" className="btn primary block" disabled={busy} onClick={() => void wear()}>
                <Check size={18} aria-hidden="true" /> Wear this
              </button>
            </div>
          )}
        </article>
      )}

      {adjusted && outfit && !showingWorn && (
        <button type="button" className="link small" onClick={() => setDay({ adjust: NO_ADJUST })}>
          Undo today's "Don't like" answers
        </button>
      )}

      {swapPicker && suggestion && (
        <Sheet title="Which piece?" onClose={() => setSwapPicker(false)}>
          <ul className="swap-list">
            {suggestion.pieces.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="swap-row"
                  onClick={() => {
                    setSwapPicker(false)
                    setSwapFor(p)
                  }}
                >
                  <PieceImage garment={p} kind="thumb" className="swap-img" />
                  <span className="swap-name">{pieceLabel(p)}</span>
                  <span />
                </button>
              </li>
            ))}
          </ul>
        </Sheet>
      )}

      {swapFor && suggestion && !showingWorn && (
        <SwapSheet
          outfit={suggestion}
          piece={swapFor}
          garments={garments}
          ctx={ctx}
          onClose={() => setSwapFor(null)}
          onPick={(o) => {
            setCustom(o)
            setSwapFor(null)
          }}
        />
      )}

      {disliking && outfit && (
        <DislikeSheet onClose={() => setDisliking(false)} onPick={(r, n) => void dislike(r, n)} hasHeels={outfit.pieces.some((p) => p.subtype === 'Heels')} />
      )}
    </section>
  )
}

function PieceButton({ piece, small, disabled, onClick }: { piece: Garment; small?: boolean; disabled?: boolean; onClick: () => void }) {
  const label = pieceLabel(piece)
  return (
    <button type="button" className={small ? 'piece small' : 'piece'} onClick={onClick} disabled={disabled} aria-label={disabled ? label : `${label}, tap to swap`}>
      <PieceImage garment={piece} kind="thumb" className="piece-img" />
      <span className="piece-name">{label}</span>
    </button>
  )
}

type WeatherCardProps = {
  city: string
  isDestination: boolean
  onUseHome: () => void
  thermal: number | null
} & ReturnType<typeof useWeather>

function WeatherCard({ city, isDestination, onUseHome, thermal, weather, loading, error, refresh }: WeatherCardProps) {
  return (
    <div className="card weather" aria-live="polite">
      <div className="weather-top">
        <div>
          <p className="muted small">
            {isDestination && <MapPin size={12} aria-hidden="true" />} {city}
          </p>
          {weather ? (
            <p className="weather-temp">
              {Math.round(weather.temp)}°<span className="muted"> feels {Math.round(weather.feelsLike)}°</span>
            </p>
          ) : (
            <p className="muted">{loading ? 'Getting the weather…' : 'No weather yet'}</p>
          )}
        </div>
        <button type="button" className="icon-btn" aria-label="Refresh weather" onClick={refresh} disabled={loading}>
          <RefreshCw size={20} aria-hidden="true" className={loading ? 'spin' : ''} />
        </button>
      </div>
      {weather && <WeatherFacts w={weather} />}
      {thermal !== null && (
        <div className="thermal" aria-label={`Outfit thermal index ${thermal} of 5`}>
          <span className="thermal-scale" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((n) => (
              <i key={n} className={n <= thermal ? `on t${n}` : ''} />
            ))}
          </span>
          <span className="small">
            <b>Thermal index {thermal}/5</b> · {THERMAL_LABELS[thermal]}
          </span>
        </div>
      )}
      {isDestination && (
        <button type="button" className="link small" onClick={onUseHome}>
          Use my home city instead
        </button>
      )}
      {error && (
        <p className="small error-text">
          {error}
          {weather && ` Showing the forecast from ${timeFmt.format(new Date(weather.fetchedAt))}.`}
        </p>
      )}
    </div>
  )
}

function WeatherFacts({ w }: { w: Weather }) {
  const rainy = isRainy(w)
  return (
    <ul className="weather-facts">
      <li>
        {rainy ? <CloudRain size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />} {describeCode(w.code)}
      </li>
      <li>
        <Thermometer size={16} aria-hidden="true" /> {Math.round(w.todayMin)}–{Math.round(w.todayMax)}°
      </li>
      <li>
        <Droplets size={16} aria-hidden="true" /> {Math.round(w.humidity)}% · rain {Math.round(w.rainChance)}%
      </li>
      <li>
        <Wind size={16} aria-hidden="true" /> {Math.round(w.windKmh)} km/h
      </li>
      {w.uvMax >= 6 && <li>UV {Math.round(w.uvMax)}</li>}
    </ul>
  )
}
