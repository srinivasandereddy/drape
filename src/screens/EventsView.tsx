import { CalendarHeart, Plus, Shuffle, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { CitySearch } from '../components/CitySearch'
import { Mannequin } from '../components/Mannequin'
import { Sheet } from '../components/Sheet'
import { ThumbRow } from '../components/ThumbRow'
import { useToast } from '../components/toastContext'
import { planOutfit, useCloset } from '../lib/closet'
import { EVENT_TEMPLATES, eventTemplate } from '../lib/events'
import { explain, OCCASIONS, suggestOutfits, type OutfitContext } from '../lib/outfit'
import { personalPrefs, preferredMetal, useProfile } from '../lib/profile'
import { addDays, isoDate, parseDate } from '../lib/trip'
import { addTrip, deleteTrip, useTrips } from '../lib/trips'
import { daysUntil } from '../lib/upcoming'
import { cityLabel, getTripWeather, type City, type Weather } from '../lib/weather'

const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' })

/** Festivals, weddings, interviews: one-day events with an outfit planned for them. */
export function EventsView({ onOpenPiece }: { onOpenPiece: (id: string) => void }) {
  const { trips } = useTrips()
  const today = isoDate(new Date())
  const events = trips.filter((t) => t.kind === 'event' && t.start >= today)
  const past = trips.filter((t) => t.kind === 'event' && t.start < today).reverse()
  const [adding, setAdding] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <div className="stack">
      <button type="button" className="btn primary" onClick={() => setAdding(true)}>
        <Plus size={18} aria-hidden="true" /> Add an event
      </button>
      {events.length === 0 && (
        <div className="empty">
          <CalendarHeart size={32} aria-hidden="true" />
          <p className="muted">Diwali, a wedding, an interview? Add it and Drape plans an outfit in the right colors and dress code, checked against that day's weather.</p>
        </div>
      )}
      {[...events, ...past].map((e) => {
        const n = daysUntil(e.start)
        return (
          <button key={e.id} type="button" className="trip-row" onClick={() => setOpenId(e.id)}>
            <span className="trip-icon" aria-hidden="true">
              <Sparkles size={18} />
            </span>
            <span>
              <b>{e.title || eventTemplate(e.theme)?.label || 'Event'}</b>
              <span className="muted small">
                {' '}
                · {dayFmt.format(parseDate(e.start))}
                {n === 0 ? ' · today' : n > 0 ? ` · in ${n} day${n === 1 ? '' : 's'}` : ''}
              </span>
            </span>
          </button>
        )
      })}
      {adding && <EventEditor onClose={() => setAdding(false)} onSaved={(id) => (setAdding(false), setOpenId(id))} />}
      {openId && <EventSheet key={openId} id={openId} onClose={() => setOpenId(null)} onOpenPiece={onOpenPiece} />}
    </div>
  )
}

function EventEditor({ onClose, onSaved }: { onClose: () => void; onSaved: (id: string) => void }) {
  const toast = useToast()
  const { profile } = useProfile()
  const [theme, setTheme] = useState<string>('diwali')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(addDays(isoDate(new Date()), 7))
  const [place, setPlace] = useState<City | null>(profile.city)
  const [saving, setSaving] = useState(false)
  const t = eventTemplate(theme)!

  async function save() {
    if (!place || !date) return toast('Choose a date and a place.', 'error')
    if (date < isoDate(new Date())) return toast('Choose today or a future date.', 'error')
    setSaving(true)
    try {
      const trip = await addTrip({ destination: place, start: date, end: date, vibe: '', activities: [t.occasion] }, { kind: 'event', title: title.trim() || t.label, theme })
      onSaved(trip.id)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save.', 'error')
      setSaving(false)
    }
  }

  return (
    <Sheet
      title="Add an event"
      onClose={onClose}
      footer={
        <button type="button" className="btn primary block" disabled={saving || !place} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Plan my outfit'}
        </button>
      }
    >
      <div className="form">
        <div className="field" role="radiogroup" aria-label="What is it?">
          <div className="field-label">What is it?</div>
          <div className="chips">
            {EVENT_TEMPLATES.map((e) => (
              <button key={e.id} type="button" role="radio" aria-checked={theme === e.id} className={theme === e.id ? 'chip on' : 'chip'} onClick={() => setTheme(e.id)}>
                {e.label}
              </button>
            ))}
          </div>
          {t.tip && <p className="muted small">{t.tip}</p>}
        </div>
        <div className="field">
          <label className="field-label" htmlFor="ev-title">
            Name <span className="field-hint">· optional, e.g. "Priya's wedding"</span>
          </label>
          <input id="ev-title" className="text-input" value={title} placeholder={t.label} maxLength={60} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="ev-date">
            Date
          </label>
          <input id="ev-date" className="text-input" type="date" min={isoDate(new Date())} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {place ? (
          <div className="kv">
            <span>Where</span>
            <button type="button" className="link" onClick={() => setPlace(null)}>
              {cityLabel(place)} · Change
            </button>
          </div>
        ) : (
          <CitySearch onSelect={setPlace} />
        )}
      </div>
    </Sheet>
  )
}

function EventSheet({ id, onClose, onOpenPiece }: { id: string; onClose: () => void; onOpenPiece: (id: string) => void }) {
  const toast = useToast()
  const { trips, loaded } = useTrips()
  const { garments } = useCloset()
  const { profile } = useProfile()
  const ev = trips.find((t) => t.id === id)
  const [weather, setWeather] = useState<Weather | null>(null)
  const [index, setIndex] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (loaded && !ev) onClose()
  }, [loaded, ev, onClose])

  const place = ev?.destination
  const date = ev?.start
  useEffect(() => {
    if (!place || !date) return
    let cancelled = false
    getTripWeather(place, [date])
      .then((d) => {
        if (!cancelled) setWeather(d[0]?.weather ?? null)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [place, date])

  const t = ev ? eventTemplate(ev.theme) : null
  const ctx: OutfitContext | null = useMemo(
    () =>
      ev
        ? {
            occasion: t?.occasion ?? 'casual',
            routine: profile.routine,
            weather,
            now: parseDate(ev.start),
            dosha: profile.dosha?.primary ?? null,
            styles: t?.styles.length ? t.styles : profile.styles,
            wishColors: t?.colors ?? [],
            formalityShift: t?.formalityShift ?? 0,
            metal: preferredMetal(profile),
            personal: personalPrefs(profile),
          }
        : null,
    [ev, t, weather, profile],
  )
  const ideas = useMemo(() => (ctx ? suggestOutfits(garments, ctx) : []), [garments, ctx])
  if (!ev || !ctx) return null
  const idea = ideas.length ? ideas[index % ideas.length]! : null
  const n = daysUntil(ev.start)

  return (
    <Sheet title={ev.title || t?.label || 'Event'} onClose={onClose}>
      <div className="stack">
        <p className="muted">
          {dayFmt.format(parseDate(ev.start))}
          {n === 0 ? ' · today' : n > 0 ? ` · in ${n} day${n === 1 ? '' : 's'}` : ''} · {cityLabel(ev.destination)}
          {weather && ` · ${Math.round(weather.todayMin)}–${Math.round(weather.todayMax)}°`}
        </p>
        {t?.tip && <p className="card small">{t.tip}</p>}
        {idea ? (
          <div className="card stack-sm">
            <div className="plan-preview">
              <Mannequin pieces={idea.pieces} profile={profile} />
            </div>
            <ThumbRow garments={idea.pieces} onOpen={onOpenPiece} />
            <ul className="why-mini">
              {explain(idea, ctx)
                .slice(0, 5)
                .map((l) => (
                  <li key={l}>{l}</li>
                ))}
            </ul>
            <div className="row-actions">
              <button type="button" className="btn" disabled={ideas.length < 2} onClick={() => setIndex((i) => i + 1)}>
                <Shuffle size={18} aria-hidden="true" /> Another
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() =>
                  void planOutfit(
                    ev.start,
                    idea.pieces.map((p) => p.id),
                    ctx.occasion,
                    ev.title || t?.label || '',
                  ).then(() => toast('Added to your calendar'))
                }
              >
                Put it in my calendar
              </button>
            </div>
          </div>
        ) : (
          <p className="muted">Add a few more pieces to your closet to plan an outfit.</p>
        )}
        {t?.occasion === 'festive' && !garments.some((g) => g.category === 'ethnic') && (
          <p className="muted small">You have no ethnic wear in your closet yet; add some for festive suggestions.</p>
        )}
        <p className="muted small">Occasion: {OCCASIONS.find((o) => o.id === ctx.occasion)?.label}</p>
        {!confirmDelete ? (
          <button type="button" className="btn danger-ghost" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={18} aria-hidden="true" /> Delete this event
          </button>
        ) : (
          <div className="confirm" role="alert">
            <p>Delete this event? A plan already in your calendar stays there.</p>
            <div className="row-actions">
              <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>
                Keep it
              </button>
              <button type="button" className="btn danger" onClick={() => void deleteTrip(ev.id).then(() => toast('Event deleted'))}>
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  )
}
