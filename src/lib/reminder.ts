// Turning the morning outfit reminder on and off on this phone. The service worker
// (src/sw/sw.ts) shows it. Only Chrome-based browsers on Android can wake an
// installed web app on a schedule (Periodic Background Sync); iPhones can't
// without a push server, so the Settings card offers a Shortcuts workaround there.

import { isStandalone } from './platform'
import { readReminder, writeReminder, type ReminderSettings } from './reminderStore'

export type ReminderSupport = 'yes' | 'install-first' | 'no'

type PeriodicSync = { register(tag: string, o: { minInterval: number }): Promise<void>; unregister(tag: string): Promise<void> }
type WithPeriodic = ServiceWorkerRegistration & { periodicSync?: PeriodicSync }

export function reminderSupport(): ReminderSupport {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || typeof Notification === 'undefined') return 'no'
  if (typeof ServiceWorkerRegistration === 'undefined' || !('periodicSync' in ServiceWorkerRegistration.prototype)) return 'no'
  return isStandalone() ? 'yes' : 'install-first'
}

async function registration(): Promise<WithPeriodic> {
  const reg = await Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 6000))])
  if (!reg) throw new Error('Reminders work in the Drape app on your home screen. Open it from there and try again.')
  return reg as WithPeriodic
}

type Details = { hour: number; name: string; latitude: number | null; longitude: number | null }

export async function turnOnReminder(d: Details): Promise<void> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notifications are blocked for Drape. Allow them in your phone settings (Apps → Drape → Notifications), then try again.')
  const reg = await registration()
  if (!reg.periodicSync) throw new Error("This phone's browser can't wake Drape on a schedule.")
  const state = await navigator.permissions?.query({ name: 'periodic-background-sync' as PermissionName }).then((s) => s.state, () => null)
  if (state === 'denied') throw new Error('Your phone hasn’t allowed Drape to check in the background yet. Use Drape from the home screen for a day or two, then try again.')
  // Checks roughly every hour; the reminder itself shows once, at or after the chosen hour.
  await reg.periodicSync.register('drape-morning', { minInterval: 60 * 60 * 1000 })
  await writeReminder({ ...d, enabled: true })
}

export async function turnOffReminder(): Promise<void> {
  await writeReminder({ enabled: false })
  try {
    const reg = await registration()
    await reg.periodicSync?.unregister('drape-morning')
  } catch {
    /* nothing registered */
  }
}

/** Keeps the name, city and hour current while the reminder is on. */
export async function updateReminder(d: Partial<Details>): Promise<void> {
  const now = await readReminder()
  if (now.enabled) await writeReminder(d)
}

export async function testReminder(name: string): Promise<void> {
  const reg = await registration()
  await reg.showNotification(name ? `Good morning, ${name}` : 'Good morning', { body: 'This is how your morning reminder will look.', icon: 'icon-192.png', tag: 'drape-test' })
}

export { readReminder, type ReminderSettings }
