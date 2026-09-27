// Trips: where, when, the vibe, and what you'll be doing. Stored per account.

import { ID_PATTERN, newId } from './id'
import { OCCASIONS, type OccasionId } from './outfit'
import type { City } from './weather'

export const MAX_TRIP_DAYS = 21

export interface Trip {
  id: string
  /** A trip spans days away; an event is one day (a festival, wedding, interview…). */
  kind: 'trip' | 'event'
  /** Event name, e.g. "Diwali" or "Priya's wedding". */
  title: string
  /** Event template id (see events.ts), if one was used. */
  theme: string | null
  destination: City
  /** YYYY-MM-DD, local */
  start: string
  end: string
  vibe: string
  activities: OccasionId[]
  /** Packing checklist: garment ids and essential keys that are packed. */
  packed: string[]
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface TripDraft {
  destination: City | null
  start: string
  end: string
  vibe: string
  activities: OccasionId[]
}

const DATE = /^\d{4}-\d{2}-\d{2}$/

export const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const parseDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y!, m! - 1, d!, 12)
}
export const addDays = (s: string, n: number) => {
  const d = parseDate(s)
  d.setDate(d.getDate() + n)
  return isoDate(d)
}

/** Every date of the trip, inclusive. */
export function tripDates(t: Pick<Trip, 'start' | 'end'>): string[] {
  const out: string[] = []
  for (let d = t.start; d <= t.end && out.length < MAX_TRIP_DAYS; d = addDays(d, 1)) out.push(d)
  return out
}

export function validateTrip(d: TripDraft, today: string = isoDate(new Date())): string[] {
  const errors: string[] = []
  if (!d.destination) errors.push('Choose where you are going.')
  if (!DATE.test(d.start) || !DATE.test(d.end)) errors.push('Choose the dates.')
  else {
    if (d.end < d.start) errors.push('The trip ends before it starts.')
    if (d.end < today) errors.push('That trip is already over.')
    if (tripDates(d).length >= MAX_TRIP_DAYS && addDays(d.start, MAX_TRIP_DAYS - 1) < d.end) errors.push(`Plan up to ${MAX_TRIP_DAYS} days at a time.`)
  }
  return errors
}

export function createTrip(d: TripDraft, now: Date = new Date()): Trip {
  if (!d.destination) throw new Error('A trip needs a destination')
  const at = now.toISOString()
  return {
    id: newId(now.getTime()),
    kind: 'trip',
    title: '',
    theme: null,
    destination: d.destination,
    start: d.start,
    end: d.end,
    vibe: d.vibe.trim().slice(0, 80),
    activities: d.activities.length ? d.activities : ['casual'],
    packed: [],
    createdAt: at,
    updatedAt: at,
    deletedAt: null,
  }
}

export function normalizeTrip(raw: unknown): Trip | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const c = r.destination as Record<string, unknown> | undefined
  if (typeof r.id !== 'string' || !ID_PATTERN.test(r.id)) return null
  if (!c || typeof c.name !== 'string' || typeof c.latitude !== 'number' || typeof c.longitude !== 'number') return null
  if (typeof r.start !== 'string' || !DATE.test(r.start) || typeof r.end !== 'string' || !DATE.test(r.end)) return null
  const createdAt = typeof r.createdAt === 'string' ? r.createdAt : new Date().toISOString()
  return {
    id: r.id,
    kind: r.kind === 'event' ? 'event' : 'trip',
    title: typeof r.title === 'string' ? r.title.slice(0, 60) : '',
    theme: typeof r.theme === 'string' ? r.theme.slice(0, 30) : null,
    destination: { name: c.name, region: String(c.region ?? ''), country: String(c.country ?? ''), latitude: c.latitude, longitude: c.longitude },
    start: r.start,
    end: r.end < r.start ? r.start : r.end,
    vibe: typeof r.vibe === 'string' ? r.vibe.slice(0, 80) : '',
    activities: Array.isArray(r.activities) ? r.activities.filter((a): a is OccasionId => OCCASIONS.some((o) => o.id === a)) : ['casual'],
    packed: Array.isArray(r.packed) ? r.packed.filter((p): p is string => typeof p === 'string').slice(0, 500) : [],
    createdAt,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : createdAt,
    deletedAt: typeof r.deletedAt === 'string' ? r.deletedAt : null,
  }
}

const dayFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
export function tripRange(t: Pick<Trip, 'start' | 'end'>): string {
  const n = tripDates(t).length
  return `${dayFmt.format(parseDate(t.start))}${n > 1 ? ` – ${dayFmt.format(parseDate(t.end))}` : ''} · ${n} day${n === 1 ? '' : 's'}`
}

/** "This weekend", "tomorrow", "for 3 days" → dates. Used by the assistant. */
export function datesFromText(text: string, today: Date = new Date()): { start: string; end: string } | null {
  const t = text.toLowerCase()
  const base = isoDate(today)
  const days = /(\d{1,2})[\s-]*(?:day|night)s?/.exec(t)
  if (t.includes('weekend')) {
    const dow = today.getDay() // 0 Sun … 6 Sat
    if (dow === 0) return t.includes('next') ? { start: addDays(base, 6), end: addDays(base, 7) } : { start: base, end: base }
    const start = addDays(base, (6 - dow) + (t.includes('next') && dow !== 6 ? 7 : 0))
    return { start, end: addDays(start, 1) }
  }
  if (days) {
    const n = Math.max(1, Math.min(MAX_TRIP_DAYS, Number(days[1])))
    const start = t.includes('today') ? base : addDays(base, 1)
    return { start, end: addDays(start, n - 1) }
  }
  if (t.includes('tomorrow')) return { start: addDays(base, 1), end: addDays(base, 1) }
  if (t.includes('next week')) {
    const toMon = ((8 - today.getDay()) % 7) || 7
    const start = addDays(base, toMon)
    return { start, end: addDays(start, 4) }
  }
  return null
}
