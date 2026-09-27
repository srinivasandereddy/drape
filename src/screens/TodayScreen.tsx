import { Check, CloudRain, Droplets, RefreshCw, Shuffle, Sparkles, Sun, Thermometer } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ChoiceChips } from '../components/Chips'
import { CitySearch } from '../components/CitySearch'
import { GarmentPhoto } from '../components/GarmentPhoto'
import { useToast } from '../components/toastContext'
import { todaysOutfit, useCloset, wearOutfit } from '../lib/closet'
import type { Garment } from '../lib/model'
import { explain, missingForOutfits, OCCASIONS, pieceLabel, scoreOutfit, slotOf, suggestOutfits, type OccasionId, type Outfit, type OutfitContext } from '../lib/outfit'
import { prefs } from '../lib/platform'
import { ROUTINES, saveProfile, useProfile, type RoutineId } from '../lib/profile'
import { useWeather } from '../lib/useWeather'
import { cityLabel, describeCode, isRainy, type Weather } from '../lib/weather'
import { SwapSheet } from './SwapSheet'

const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
const MAIN = new Set(['top', 'bottom', 'onepiece', 'layer', 'footwear'])

type Props = { onAdd: () => void }

export function TodayScreen({ onAdd }: Props) {
  const toast = useToast()
  const { garments, status } = useCloset()
  const { loaded, profile } = useProfile()
  const wx = useWeather(profile.city)

  const [now] = useState(() => new Date())
  const [occasion, setOccasion] = useState<OccasionId>(() => {
    const saved = prefs.get('occasion')
    return OCCASIONS.some((o) => o.id === saved) ? (saved as OccasionId) : 'casual'
  })
  const [index, setIndex] = useState(0)
  const [custom, setCustom] = useState<Outfit | null>(null)
  const [swapFor, setSwapFor] = useState<Garment | null>(null)
  const [wornIds, setWornIds] = useState<string[] | null>(null)
  const [showIdeas, setShowIdeas] = useState(false)
  const [busy, setBusy] = useState(false)

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
    () => ({ occasion, routine: profile.routine, weather: wx.weather, now }),
    [occasion, profile.routine, wx.weather, now],
  )
  const outfits = useMemo(() => suggestOutfits(garments, ctx), [garments, ctx])
  const suggestion = custom ?? (outfits.length ? outfits[index % outfits.length]! : null)

  const worn = useMemo(() => {
    if (!wornIds) return null
    const pieces = wornIds.map((id) => garments.find((g) => g.id === id)).filter((g): g is Garment => !!g)
    return pieces.length ? scoreOutfit(pieces, ctx) : null
  }, [wornIds, garments, ctx])

  const missing = missingForOutfits(garments)
  const showingWorn = worn && !showIdeas
  const outfit = showingWorn ? worn : suggestion

  function chooseOccasion(o: OccasionId | null) {
    if (!o) return
    setOccasion(o)
    prefs.set('occasion', o)
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

  return (
    <section className="screen" aria-labelledby="today-title">
      <div className="screen-head">
        <p className="muted">{dayFmt.format(now)}</p>
        <h1 id="today-title">What to wear today</h1>
      </div>

      {loaded && (!profile.city || !profile.routine) && <SetupCard needsCity={!profile.city} needsRoutine={!profile.routine} />}

      {profile.city && <WeatherCard city={cityLabel(profile.city)} {...wx} />}

      <ChoiceChips<OccasionId> label="Dressing for" options={OCCASIONS.map((o) => ({ value: o.id, label: o.label }))} value={occasion} onChange={chooseOccasion} />

      {status === 'ready' && missing.length > 0 && (
        <div className="card stack-sm">
          <h2>Add a few more pieces</h2>
          <p className="muted">To build an outfit Drape needs {missing.join(' and ')}. A pair of shoes helps too.</p>
          <button type="button" className="btn primary" onClick={onAdd}>
            Add a piece
          </button>
        </div>
      )}

      {outfit && (
        <article className="card outfit" aria-label={showingWorn ? 'Today’s outfit' : 'Suggested outfit'}>
          <header className="outfit-head">
            {/* A worn outfit's score would drop (its pieces were just worn), so show only the harmony. */}
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
            {outfit.pieces.filter((p) => MAIN.has(slotOf(p))).map((p) => (
              <li key={p.id}>
                <PieceButton piece={p} disabled={!!showingWorn} onClick={() => setSwapFor(p)} />
              </li>
            ))}
          </ul>
          {outfit.pieces.some((p) => !MAIN.has(slotOf(p))) && (
            <ul className="outfit-extras">
              {outfit.pieces.filter((p) => !MAIN.has(slotOf(p))).map((p) => (
                <li key={p.id}>
                  <PieceButton piece={p} small disabled={!!showingWorn} onClick={() => setSwapFor(p)} />
                </li>
              ))}
            </ul>
          )}
          {!showingWorn && <p className="muted small">Tap a piece to swap it.</p>}

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
            <div className="row-actions">
              <button type="button" className="btn primary" disabled={busy} onClick={() => void wear()}>
                <Check size={18} aria-hidden="true" /> Wear this
              </button>
              <button
                type="button"
                className="btn"
                disabled={outfits.length < 2 && !custom}
                onClick={() => {
                  setCustom(null)
                  setIndex((i) => i + 1)
                }}
              >
                <Shuffle size={18} aria-hidden="true" /> Show another
              </button>
            </div>
          )}
        </article>
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
    </section>
  )
}

function PieceButton({ piece, small, disabled, onClick }: { piece: Garment; small?: boolean; disabled?: boolean; onClick: () => void }) {
  const label = pieceLabel(piece)
  return (
    <button type="button" className={small ? 'piece small' : 'piece'} onClick={onClick} disabled={disabled} aria-label={disabled ? label : `${label}, tap to swap`}>
      <GarmentPhoto id={piece.id} kind="thumb" alt="" className="piece-img" />
      <span className="piece-name">{label}</span>
    </button>
  )
}

function WeatherCard({ city, weather, loading, error, refresh }: { city: string } & ReturnType<typeof useWeather>) {
  return (
    <div className="card weather" aria-live="polite">
      <div className="weather-top">
        <div>
          <p className="muted small">{city}</p>
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
      {w.uvMax >= 6 && <li>UV {Math.round(w.uvMax)}</li>}
    </ul>
  )
}

function SetupCard({ needsCity, needsRoutine }: { needsCity: boolean; needsRoutine: boolean }) {
  const toast = useToast()
  const save = (patch: Parameters<typeof saveProfile>[0]) =>
    saveProfile(patch).catch((e: unknown) => toast(e instanceof Error ? e.message : 'Could not save.', 'error'))
  return (
    <div className="card stack">
      <div className="stack-sm">
        <h2>Two quick questions</h2>
        <p className="muted small">They make suggestions fit your day. You can change them later in Settings.</p>
      </div>
      {needsCity && <CitySearch onSelect={(city) => void save({ city })} />}
      {needsRoutine && (
        <ChoiceChips<RoutineId>
          label="What does a normal weekday look like?"
          options={ROUTINES.map((r) => ({ value: r.id, label: r.label }))}
          value={null}
          onChange={(routine) => routine && void save({ routine })}
        />
      )}
    </div>
  )
}
