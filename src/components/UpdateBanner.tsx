import { RefreshCw } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const HOUR = 60 * 60 * 1000

/**
 * Installed web apps keep a saved copy of Drape so it opens offline, and phones
 * often resume the app instead of restarting it. So we check for a new version
 * whenever Drape comes back on screen, and offer a one-tap switch.
 * The switch never happens by itself, so a half-filled form is never lost.
 */
export function UpdateBanner() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const check = () => {
        if (document.visibilityState === 'visible' && navigator.onLine) {
          registration.update().catch(() => {
            /* offline or server hiccup: try again next time */
          })
        }
      }
      document.addEventListener('visibilitychange', check)
      setInterval(check, HOUR)
    },
  })

  if (!needRefresh) return null
  return (
    <aside className="notice" aria-label="Update available" role="status">
      <div>
        <b>A new version of Drape is ready</b>
        <p className="small">Your closet stays as it is.</p>
      </div>
      <button type="button" className="btn small primary" onClick={() => void updateServiceWorker(true)}>
        <RefreshCw size={16} aria-hidden="true" /> Update
      </button>
    </aside>
  )
}
