import { isoDate, parseDate, type Trip } from './trip'
import { useTrips } from './trips'

/** Whole days from today to a date (YYYY-MM-DD); negative if past. */
export const daysUntil = (date: string) => Math.round((parseDate(date).getTime() - parseDate(isoDate(new Date())).getTime()) / 86_400_000)

/** The next event within a week, if any (for the Today screen). */
export function useUpcomingEvent(): Trip | null {
  const { trips } = useTrips()
  const today = isoDate(new Date())
  return trips.filter((t) => t.kind === 'event' && t.start >= today && daysUntil(t.start) <= 7).sort((a, b) => (a.start < b.start ? -1 : 1))[0] ?? null
}
