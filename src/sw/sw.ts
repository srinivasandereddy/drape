/// <reference lib="webworker" />
// Drape's service worker: keeps the app working offline, switches to a new
// version only when the person taps Update, and shows the morning outfit
// reminder where the phone allows it (installed Drape on Android, via
// periodic background sync).

import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { forecastLine, localDate, readReminder, reminderDue, writeReminder } from '../lib/reminderStore'

declare const self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
// Screens of the app open from the saved copy; the privacy page is a real page.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/privacy\.html$/] }))

self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') void self.skipWaiting()
})

async function forecast(lat: number, lon: number): Promise<string | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=1`
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!r.ok) return null
    return forecastLine(((await r.json()) as { daily?: Parameters<typeof forecastLine>[0] }).daily)
  } catch {
    return null
  }
}

async function morning(): Promise<void> {
  const s = await readReminder()
  const now = new Date()
  if (!reminderDue(s, now) || Notification.permission !== 'granted') return
  const wx = s.latitude !== null && s.longitude !== null ? await forecast(s.latitude, s.longitude) : null
  await self.registration.showNotification(s.name ? `Good morning, ${s.name}` : 'Good morning', {
    body: `${wx ? `${wx}. ` : ''}Your outfit for today is ready.`,
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: 'drape-morning',
  })
  await writeReminder({ lastShown: localDate(now) })
}

// Periodic Background Sync is not in TypeScript's DOM types yet.
self.addEventListener('periodicsync', ((event: ExtendableEvent & { tag: string }) => {
  if (event.tag === 'drape-morning') event.waitUntil(morning())
}) as EventListener)

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const open = windows[0]
      if (open) await open.focus()
      else await self.clients.openWindow(self.registration.scope)
    })(),
  )
})
