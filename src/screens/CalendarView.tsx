import { ChevronLeft, ChevronRight, Heart, Shuffle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ChoiceChips } from '../components/Chips'
import { Mannequin } from '../components/Mannequin'
import { PieceImage } from '../components/PieceImage'
import { Sheet } from '../components/Sheet'
import { ThumbRow } from '../components/ThumbRow'
import { useToast } from '../components/toastContext'
import { listFeedback, listOutfits, planOutfit, removeOutfit, useCloset } from '../lib/closet'
import type { OutfitRecord } from '../lib/db'
import type { Garment } from '../lib/model'
import { OCCASIONS, suggestOutfits, type OccasionId } from '../lib/outfit'
import { personalPrefs, preferredMetal, useProfile } from '../lib/profile'
import { isoDate, parseDate } from '../lib/trip'
import { getTripWeather, type Weather } from '../lib/weather'

const monthFmt = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/** Month calendar of worn and planned outfits, plus favourite looks. */
export function CalendarView({ onOpenPiece }: { onOpenPiece: (id: string) => void }) {
  const { garments } = useCloset()
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [outfits, setOutfits] = useState<OutfitRecord[]>([])
  const [loved, setLoved] = useState<string[][]>([])
  const [tick, setTick] = useState(0)
  const [openDay, setOpenDay] = useState<string | null>(null)
  const today = isoDate(new Date())

  useEffect(() => {
    let cancelled = false
    void Promise.all([listOutfits(), listFeedback()]).then(([o, f]) => {
      if (cancelled) return
      setOutfits(o)
      const seen = new Set<string>()
      setLoved(
        f
          .filter((x) => x.verdict === 'love')
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
          .map((x) => x.garmentIds)
          .filter((ids) => {
            const k = [...ids].sort().join()
            if (seen.has(k)) return false
            seen.add(k)
            return true
          })
          .slice(0, 8),
      )
    })
    return () => {
      cancelled = true
    }
  }, [tick, garments])

  const byDate = useMemo(() => {
    const m = new Map<string, OutfitRecord[]>()
    for (const o of outfits) m.set(o.date, [...(m.get(o.date) ?? []), o])
    return m
  }, [outfits])
  const byId = useMemo(() => new Map(garments.map((g) => [g.id, g])), [garments])

  // Monday-first grid for the month.
  const first = (month.getDay() + 6) % 7
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => isoDate(new Date(month.getFullYear(), month.getMonth(), i + 1)))]
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1))

  return (
    <div className="stack">
      <div className="card stack-sm">
        <div className="cal-head">
          <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => shift(-1)}>
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <h2>{monthFmt.format(month)}</h2>
          <button type="button" className="icon-btn" aria-label="Next month" onClick={() => shift(1)}>
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="cal-grid" role="grid">
          {WEEKDAYS.map((d, i) => (
            <span key={`w${i}`} className="cal-dow muted small" aria-hidden="true">
              {d}
            </span>
          ))}
          {cells.map((date, i) => {
            if (!date) return <span key={`e${i}`} />
            const list = byDate.get(date) ?? []
            const worn = list.find((o) => !o.planned)
            const plan = list.find((o) => o.planned)
            const shown = worn ?? plan
            const piece = shown ? shown.garmentIds.map((id) => byId.get(id)).find((g) => g && ['top', 'dress', 'ethnic'].includes(g.category)) : undefined
            return (
              <button
                key={date}
                type="button"
                className={`cal-day ${date === today ? 'today' : ''} ${plan && !worn ? 'planned' : ''} ${worn ? 'worn' : ''}`}
                onClick={() => setOpenDay(date)}
                aria-label={`${dayFmt.format(parseDate(date))}${worn ? ', outfit worn' : plan ? ', outfit planned' : ''}`}
              >
                <span className="cal-num">{Number(date.slice(8))}</span>
                {piece && <PieceImage garment={piece} kind="thumb" className="cal-thumb" />}
              </button>
            )
          })}
        </div>
        <p className="muted small">Tap a day to see what you wore, or plan an outfit ahead.</p>
      </div>

      {loved.length > 0 && (
        <div className="card stack-sm">
          <h2>
            <Heart size={18} aria-hidden="true" /> Favourite looks
          </h2>
          {loved.map((ids, i) => {
            const pieces = ids.map((id) => byId.get(id)).filter((g): g is Garment => !!g)
            return pieces.length ? <ThumbRow key={i} garments={pieces} onOpen={onOpenPiece} /> : null
          })}
        </div>
      )}

      {openDay && (
        <DaySheet
          date={openDay}
          records={byDate.get(openDay) ?? []}
          byId={byId}
          onOpenPiece={onOpenPiece}
          onClose={() => setOpenDay(null)}
          onChanged={() => setTick((t) => t + 1)}
        />
      )}
    </div>
  )
}

function DaySheet({
  date,
  records,
  byId,
  onOpenPiece,
  onClose,
  onChanged,
}: {
  date: string
  records: OutfitRecord[]
  byId: Map<string, Garment>
  onOpenPiece: (id: string) => void
  onClose: () => void
  onChanged: () => void
}) {
  const toast = useToast()
  const { garments } = useCloset()
  const { profile } = useProfile()
  const today = isoDate(new Date())
  const future = date >= today
  const worn = records.filter((o) => !o.planned)
  const plan = records.find((o) => o.planned)
  const [planning, setPlanning] = useState(!plan && future && worn.length === 0)
  const [occasion, setOccasion] = useState<OccasionId>('casual')
  const [note, setNote] = useState('')
  const [index, setIndex] = useState(0)
  const [weather, setWeather] = useState<Weather | null>(null)

  useEffect(() => {
    if (!planning || !profile.city) return
    let cancelled = false
    getTripWeather(profile.city, [date])
      .then((d) => {
        if (!cancelled) setWeather(d[0]?.weather ?? null)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [planning, profile.city, date])

  const ideas = useMemo(
    () =>
      planning
        ? suggestOutfits(garments, {
            occasion,
            routine: profile.routine,
            weather,
            now: parseDate(date),
            dosha: profile.dosha?.primary ?? null,
            styles: profile.styles,
            metal: preferredMetal(profile),
            personal: personalPrefs(profile),
          })
        : [],
    [planning, garments, occasion, profile, weather, date],
  )
  const idea = ideas.length ? ideas[index % ideas.length]! : null

  const piecesOf = (o: OutfitRecord) => o.garmentIds.map((id) => byId.get(id)).filter((g): g is Garment => !!g)

  return (
    <Sheet title={dayFmt.format(parseDate(date))} onClose={onClose}>
      <div className="stack">
        {worn.map((o) => (
          <div key={o.id} className="card stack-sm">
            <p className="small">
              <b>Worn</b> · {OCCASIONS.find((x) => x.id === o.occasion)?.label ?? o.occasion}
            </p>
            <ThumbRow garments={piecesOf(o)} onOpen={onOpenPiece} />
          </div>
        ))}

        {plan && !planning && (
          <div className="card stack-sm">
            <p className="small">
              <b>Planned</b> · {OCCASIONS.find((x) => x.id === plan.occasion)?.label ?? plan.occasion}
              {plan.note && ` · ${plan.note}`}
            </p>
            <div className="plan-preview">
              <Mannequin pieces={piecesOf(plan)} profile={profile} />
            </div>
            <ThumbRow garments={piecesOf(plan)} onOpen={onOpenPiece} />
            <div className="row-actions">
              <button type="button" className="btn" onClick={() => setPlanning(true)}>
                Change plan
              </button>
              <button
                type="button"
                className="btn danger-ghost"
                onClick={() =>
                  void removeOutfit(plan.id).then(() => {
                    onChanged()
                    onClose()
                    toast('Plan removed')
                  })
                }
              >
                Remove plan
              </button>
            </div>
          </div>
        )}

        {!planning && !plan && future && (
          <button type="button" className="btn primary" onClick={() => setPlanning(true)}>
            Plan an outfit for this day
          </button>
        )}
        {!future && worn.length === 0 && <p className="muted">Nothing logged on this day.</p>}

        {planning && (
          <div className="stack">
            <ChoiceChips<OccasionId> label="What's the day for?" options={OCCASIONS.map((o) => ({ value: o.id, label: o.label }))} value={occasion} onChange={(o) => o && (setOccasion(o), setIndex(0))} />
            <div className="field">
              <label className="field-label" htmlFor="plan-note">
                Note <span className="field-hint">· optional, e.g. "Interview", "Diwali"</span>
              </label>
              <input id="plan-note" className="text-input" value={note} maxLength={60} onChange={(e) => setNote(e.target.value)} />
            </div>
            {idea ? (
              <div className="card stack-sm">
                <div className="plan-preview">
                  <Mannequin pieces={idea.pieces} profile={profile} />
                </div>
                <ThumbRow garments={idea.pieces} onOpen={onOpenPiece} />
                <p className="muted small">
                  Score {idea.score}
                  {weather ? ` · forecast ${Math.round(weather.todayMin)}–${Math.round(weather.todayMax)}°` : ''}
                </p>
                <div className="row-actions">
                  <button type="button" className="btn" disabled={ideas.length < 2} onClick={() => setIndex((i) => i + 1)}>
                    <Shuffle size={18} aria-hidden="true" /> Another
                  </button>
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() =>
                      void planOutfit(
                        date,
                        idea.pieces.map((p) => p.id),
                        occasion,
                        note,
                      ).then(() => {
                        onChanged()
                        onClose()
                        toast('Outfit planned')
                      })
                    }
                  >
                    Save plan
                  </button>
                </div>
              </div>
            ) : (
              <p className="muted">Add a top and a bottom (or a dress) to your closet to plan outfits.</p>
            )}
          </div>
        )}
      </div>
    </Sheet>
  )
}
