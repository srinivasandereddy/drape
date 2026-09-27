// A tiny database shared by the app and the service worker, holding only what the
// morning reminder needs: whether it is on, the hour, a first name and the city's
// coordinates for the forecast. Nothing about the closet is stored here.

import { openDB } from 'idb'

export interface ReminderSettings {
  enabled: boolean
  /** Local hour, 4..12. */
  hour: number
  name: string
  latitude: number | null
  longitude: number | null
  /** YYYY-MM-DD of the last reminder shown, so it is shown once a day. */
  lastShown: string | null
}

export const REMINDER_DEFAULTS: ReminderSettings = { enabled: false, hour: 7, name: '', latitude: null, longitude: null, lastShown: null }

const open = () =>
  openDB('drape-reminder', 1, {
    upgrade(db) {
      db.createObjectStore('kv')
    },
  })

export async function readReminder(): Promise<ReminderSettings> {
  try {
    const db = await open()
    const v = (await db.get('kv', 'settings')) as Partial<ReminderSettings> | undefined
    db.close()
    return { ...REMINDER_DEFAULTS, ...v }
  } catch {
    return REMINDER_DEFAULTS
  }
}

export async function writeReminder(patch: Partial<ReminderSettings>): Promise<void> {
  const db = await open()
  const now = ((await db.get('kv', 'settings')) as Partial<ReminderSettings> | undefined) ?? {}
  await db.put('kv', { ...REMINDER_DEFAULTS, ...now, ...patch }, 'settings')
  db.close()
}

export const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Whether to show the reminder now: on, at or after the chosen hour, before noon, and not yet today. */
export function reminderDue(s: ReminderSettings, now: Date): boolean {
  if (!s.enabled) return false
  const h = now.getHours()
  return h >= s.hour && h < Math.max(12, s.hour + 3) && s.lastShown !== localDate(now)
}

/** "31° / 25° · rain likely" from an Open-Meteo daily forecast. */
export function forecastLine(daily: { temperature_2m_max?: number[]; temperature_2m_min?: number[]; precipitation_probability_max?: number[] } | undefined): string | null {
  const max = daily?.temperature_2m_max?.[0]
  const min = daily?.temperature_2m_min?.[0]
  if (typeof max !== 'number' || typeof min !== 'number') return null
  const rain = daily?.precipitation_probability_max?.[0] ?? 0
  return `${Math.round(max)}° / ${Math.round(min)}°${rain >= 50 ? ' · rain likely' : rain >= 25 ? ' · maybe some rain' : ''}`
}
