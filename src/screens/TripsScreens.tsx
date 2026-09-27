import { CalendarDays, Check, CloudRain, Luggage, MapPin, Plus, Sun, Trash2 } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'
import { MultiChips } from '../components/Chips'
import { CitySearch } from '../components/CitySearch'
import { PieceImage } from '../components/PieceImage'
import { Sheet } from '../components/Sheet'
import { ThumbRow } from '../components/ThumbRow'
import { useToast } from '../components/toastContext'
import { useCloset } from '../lib/closet'
import { OCCASIONS, type OccasionId } from '../lib/outfit'
import { planTrip, slotTitle } from '../lib/packing'
import { personalPrefs, preferredMetal, useProfile } from '../lib/profile'
import { parseStyles } from '../lib/styles'
import { addDays, isoDate, parseDate, tripDates, tripRange, validateTrip, type Trip, type TripDraft } from '../lib/trip'
import { addTrip, deleteTrip, updateTrip, useTrips } from '../lib/trips'
import { CalendarView } from './CalendarView'
import { EventsView } from './EventsView'
import { bestCityMatch, cityLabel, describeCode, getTripWeather, isRainy, searchCities, type DayWeather } from '../lib/weather'

const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric' })
const TRIP_OCCASIONS = OCCASIONS.filter((o) => o.id !== 'travel')

// ---------- list ----------

export type PlansView = 'calendar' | 'trips' | 'events'

export function TripsScreen({ onPlan, onOpen, onOpenPiece, view, onView }: { onPlan: () => void; onOpen: (id: string) => void; onOpenPiece: (id: string) => void; view: PlansView; onView: (v: PlansView) => void }) {
  const { loaded, trips: all } = useTrips()
  const trips = all.filter((t) => t.kind === 'trip')
  const today = isoDate(new Date())
  const upcoming = trips.filter((t) => t.end >= today)
  const past = trips.filter((t) => t.end < today).reverse()

  return (
    <section className="screen" aria-labelledby="plans-title">
      <div className="screen-head">
        <h1 id="plans-title">Plans</h1>
        <p className="muted">Your outfit calendar, trips and events.</p>
      </div>
      <div className="seg" role="tablist" aria-label="Plans">
        {(['calendar', 'trips', 'events'] as PlansView[]).map((v) => (
          <button key={v} type="button" role="tab" aria-selected={view === v} className={view === v ? 'on' : ''} onClick={() => onView(v)}>
            {v === 'calendar' ? 'Calendar' : v === 'trips' ? 'Trips' : 'Events'}
          </button>
        ))}
      </div>

      {view === 'calendar' && <CalendarView onOpenPiece={onOpenPiece} />}
      {view === 'events' && <EventsView onOpenPiece={onOpenPiece} />}
      {view === 'trips' && (
        <>
          <button type="button" className="btn primary" onClick={onPlan}>
            <Plus size={18} aria-hidden="true" /> Plan a trip
          </button>
          {loaded && trips.length === 0 && (
            <div className="empty">
              <Luggage size={32} aria-hidden="true" />
              <p className="muted">No trips yet. Tell Drape where and when, and it checks the weather there, plans each day and builds your packing list.</p>
            </div>
          )}
          {upcoming.length > 0 && <TripList title="Coming up" trips={upcoming} onOpen={onOpen} />}
          {past.length > 0 && <TripList title="Past trips" trips={past} onOpen={onOpen} />}
        </>
      )}
    </section>
  )
}

function TripList({ title, trips, onOpen }: { title: string; trips: Trip[]; onOpen: (id: string) => void }) {
  return (
    <div className="stack-sm">
      <h2>{title}</h2>
      <ul className="trip-list">
        {trips.map((t) => (
          <li key={t.id}>
            <button type="button" className="trip-row" onClick={() => onOpen(t.id)}>
              <span className="trip-icon" aria-hidden="true">
                <MapPin size={20} />
              </span>
              <span>
                <b>{t.destination.name}</b>
                <span className="muted small">
                  {' '}
                  · {tripRange(t)}
                </span>
                {t.packed.length > 0 && <span className="muted small"> · {t.packed.length} packed</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------- create ----------

export type TripPrefill = { draft?: Partial<TripDraft>; placeQuery?: string | null }

export function TripEditor({ prefill, onClose, onSaved }: { prefill?: TripPrefill; onClose: () => void; onSaved: (id: string) => void }) {
  const toast = useToast()
  const { profile } = useProfile()
  const homeCountry = profile.city?.country
  const ids = { start: useId(), end: useId(), vibe: useId() }
  const today = isoDate(new Date())
  const [draft, setDraft] = useState<TripDraft>(() => ({
    destination: null,
    start: addDays(today, 1),
    end: addDays(today, 3),
    vibe: '',
    activities: ['casual'],
    ...Object.fromEntries(Object.entries(prefill?.draft ?? {}).filter(([, v]) => v !== '' && v !== undefined)),
  }))
  const [finding, setFinding] = useState(Boolean(prefill?.placeQuery))
  const [showErrors, setShowErrors] = useState(false)
  const [saving, setSaving] = useState(false)
  const set = (patch: Partial<TripDraft>) => setDraft((d) => ({ ...d, ...patch }))

  // The assistant may pass a place name ("Goa"); look it up once.
  useEffect(() => {
    const q = prefill?.placeQuery
    if (!q) return
    let cancelled = false
    searchCities(q)
      .then((r) => {
        const best = bestCityMatch(q, r, homeCountry)
        if (!cancelled && best) setDraft((d) => (d.destination ? d : { ...d, destination: best }))
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setFinding(false)
      })
    return () => {
      cancelled = true
    }
  }, [prefill?.placeQuery, homeCountry])

  const errors = validateTrip(draft, today)

  async function save() {
    if (errors.length) return setShowErrors(true)
    setSaving(true)
    try {
      const trip = await addTrip(draft)
      toast(`Trip to ${trip.destination.name} planned`)
      onSaved(trip.id)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save the trip.', 'error')
      setSaving(false)
    }
  }

  return (
    <Sheet
      title="Plan a trip"
      onClose={onClose}
      footer={
        <button type="button" className="btn primary block" disabled={saving} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Plan my outfits and packing'}
        </button>
      }
    >
      <div className="form">
        {draft.destination ? (
          <div className="kv">
            <span>Going to</span>
            <button type="button" className="link" onClick={() => set({ destination: null })}>
              {cityLabel(draft.destination)} · Change
            </button>
          </div>
        ) : finding ? (
          <p className="muted">Finding {prefill?.placeQuery}…</p>
        ) : (
          <CitySearch onSelect={(destination) => set({ destination })} />
        )}
        <div className="two-col">
          <div className="field">
            <label className="field-label" htmlFor={ids.start}>
              From
            </label>
            <input id={ids.start} className="text-input" type="date" min={today} value={draft.start} onChange={(e) => set({ start: e.target.value, end: draft.end < e.target.value ? e.target.value : draft.end })} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor={ids.end}>
              To
            </label>
            <input id={ids.end} className="text-input" type="date" min={draft.start || today} value={draft.end} onChange={(e) => set({ end: e.target.value })} />
          </div>
        </div>
        <MultiChips<OccasionId>
          label="What will you be doing?"
          options={TRIP_OCCASIONS.map((o) => ({ value: o.id, label: o.label }))}
          values={draft.activities}
          onChange={(activities) => set({ activities })}
        />
        <div className="field">
          <label className="field-label" htmlFor={ids.vibe}>
            Vibe <span className="field-hint">· optional, e.g. "beach, boho", "city break, minimalist"</span>
          </label>
          <input id={ids.vibe} className="text-input" value={draft.vibe} maxLength={80} onChange={(e) => set({ vibe: e.target.value })} />
        </div>
        {showErrors && errors.length > 0 && (
          <ul className="error-text" role="alert">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  )
}

// ---------- one trip ----------

export function TripSheet({ id, onClose, onOpenPiece }: { id: string; onClose: () => void; onOpenPiece: (id: string) => void }) {
  const toast = useToast()
  const { loaded, trips } = useTrips()
  const { garments } = useCloset()
  const { profile } = useProfile()
  const trip = trips.find((t) => t.id === id)
  const [wx, setWx] = useState<{ days: DayWeather[]; error: string | null; done: boolean }>({ days: [], error: null, done: false })
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (loaded && !trip) onClose()
  }, [loaded, trip, onClose])

  const place = trip?.destination
  const range = trip ? `${trip.start}|${trip.end}` : ''
  useEffect(() => {
    if (!place || !range) return
    let cancelled = false
    const [start, end] = range.split('|') as [string, string]
    getTripWeather(place, tripDates({ start, end }))
      .then((days) => {
        if (!cancelled) setWx({ days, error: null, done: true })
      })
      .catch((e: unknown) => {
        if (!cancelled) setWx({ days: [], error: e instanceof Error ? e.message : 'No weather right now.', done: true })
      })
    return () => {
      cancelled = true
    }
  }, [place, range])

  const plan = useMemo(() => {
    if (!trip || !wx.done) return null
    const vibeStyles = parseStyles(trip.vibe)
    return planTrip(garments, trip, wx.days, {
      routine: profile.routine,
      dosha: profile.dosha?.primary ?? null,
      styles: vibeStyles.length ? vibeStyles : profile.styles,
      metal: preferredMetal(profile),
      personal: personalPrefs(profile),
    })
  }, [trip, wx, garments, profile])

  if (!trip) return null
  const allKeys = plan ? [...plan.pack.flatMap((g) => g.items.map((i) => i.key)), ...plan.essentials.map((e) => e.key)] : []
  const packedCount = allKeys.filter((k) => trip.packed.includes(k)).length

  const toggle = (key: string) =>
    void updateTrip(trip.id, (t) => ({ ...t, packed: t.packed.includes(key) ? t.packed.filter((k) => k !== key) : [...t.packed, key] })).catch(() =>
      toast('Could not save that. Try again.', 'error'),
    )

  return (
    <Sheet title={`Trip to ${trip.destination.name}`} onClose={onClose}>
      <div className="stack">
        <div className="stack-sm">
          <p className="muted">
            <CalendarDays size={14} aria-hidden="true" /> {tripRange(trip)}
            {trip.vibe && ` · ${trip.vibe}`}
          </p>
          <p className="muted small">{trip.activities.map((a) => OCCASIONS.find((o) => o.id === a)?.label).join(', ')}</p>
        </div>

        {!wx.done && <p className="muted">Checking the weather in {trip.destination.name}…</p>}
        {wx.error && <p className="error-text">{wx.error} Outfits are planned without the forecast.</p>}
        {wx.days.length > 0 && (
          <ul className="day-strip" aria-label="Weather each day">
            {wx.days.map((d) => (
              <li key={d.date} className={d.source === 'typical' ? 'typical' : ''}>
                <span className="small">{weekday.format(parseDate(d.date))}</span>
                {isRainy(d.weather) ? <CloudRain size={18} aria-label={describeCode(d.weather.code)} /> : <Sun size={18} aria-label={describeCode(d.weather.code)} />}
                <b className="mono">{Math.round(d.weather.todayMax)}°</b>
                <span className="mono muted small">{Math.round(d.weather.todayMin)}°</span>
                {d.weather.rainChance >= 40 && <span className="small rain">{Math.round(d.weather.rainChance)}%</span>}
              </li>
            ))}
          </ul>
        )}

        {plan && (
          <>
            {plan.notes.length > 0 && (
              <ul className="notice-list small">
                {plan.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}

            <section className="card stack-sm" aria-labelledby="pack-title">
              <div className="kv">
                <h2 id="pack-title">Packing list</h2>
                <span className="mono muted">
                  {packedCount}/{allKeys.length}
                </span>
              </div>
              <div className="meter" aria-hidden="true">
                <i className="meter-pack" style={{ width: `${allKeys.length ? (packedCount / allKeys.length) * 100 : 0}%` }} />
              </div>
              {plan.pack.map((group) => (
                <div key={group.slot} className="stack-sm">
                  <h3 className="pack-group">{slotTitle(group.slot)}</h3>
                  <ul className="pack-list">
                    {group.items.map((item) => (
                      <PackRow key={item.key} item={item} checked={trip.packed.includes(item.key)} onToggle={() => toggle(item.key)} />
                    ))}
                  </ul>
                </div>
              ))}
              <h3 className="pack-group">Essentials</h3>
              <ul className="pack-list">
                {plan.essentials.map((item) => (
                  <PackRow key={item.key} item={item} checked={trip.packed.includes(item.key)} onToggle={() => toggle(item.key)} />
                ))}
              </ul>
            </section>

            <section className="stack-sm" aria-labelledby="days-title">
              <h2 id="days-title">Day by day</h2>
              <ul className="trip-days">
                {plan.days.map((d) => (
                  <li key={d.date} className="card stack-sm">
                    <div className="kv">
                      <b>{weekday.format(parseDate(d.date))}</b>
                      <span className="muted small">
                        {OCCASIONS.find((o) => o.id === d.occasion)?.label}
                        {d.weather && ` · feels ${Math.round(d.weather.feelsLike)}°`}
                      </span>
                    </div>
                    {d.outfit ? <ThumbRow garments={d.outfit.pieces} onOpen={onOpenPiece} /> : <p className="muted small">No outfit possible for this day.</p>}
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}

        {!confirmDelete ? (
          <button type="button" className="btn danger-ghost" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={18} aria-hidden="true" /> Delete this trip
          </button>
        ) : (
          <div className="confirm" role="alert">
            <p>Delete the trip to {trip.destination.name}? Your clothes stay in your closet.</p>
            <div className="row-actions">
              <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>
                Keep it
              </button>
              <button
                type="button"
                className="btn danger"
                onClick={() =>
                  void deleteTrip(trip.id)
                    .then(() => toast('Trip deleted'))
                    .catch(() => toast('Could not delete the trip.', 'error'))
                }
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  )
}

function PackRow({ item, checked, onToggle }: { item: { key: string; label: string; garment: import('../lib/model').Garment | null; days: number }; checked: boolean; onToggle: () => void }) {
  return (
    <li>
      <button type="button" className={checked ? 'pack-row done' : 'pack-row'} role="checkbox" aria-checked={checked} onClick={onToggle}>
        <span className="pack-check" aria-hidden="true">
          {checked && <Check size={16} />}
        </span>
        {item.garment && <PieceImage garment={item.garment} kind="thumb" className="pack-img" />}
        <span className="pack-label">{item.label}</span>
        {item.days > 1 && <span className="mono muted small">×{item.days} days</span>}
      </button>
    </li>
  )
}
