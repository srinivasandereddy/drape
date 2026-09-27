import { X } from 'lucide-react'
import { useState } from 'react'
import { isIOS, isStandalone, prefs } from '../lib/platform'

/**
 * On iPhone, Safari may clear a website's saved data after 7 days without a visit,
 * and a Safari tab does not share storage with the home-screen app. Nudge people
 * to install before they fill their closet.
 */
export function InstallBanner() {
  const [hidden, setHidden] = useState(() => isStandalone() || prefs.get('installBannerDismissed') === '1')
  if (hidden) return null
  const ios = isIOS()
  return (
    <aside className="notice" aria-label="Install Drape">
      <div>
        <b>Add Drape to your home screen</b>
        <p className="small">
          {ios
            ? 'Tap ••• or Share, then Add to Home Screen. Pieces you add in a Safari tab stay in Safari and may be cleared by iOS after 7 days without use.'
            : 'Open the ⋮ menu and choose Install app or Add to Home screen, so your closet opens like an app.'}
        </p>
      </div>
      <button
        type="button"
        className="icon-btn"
        aria-label="Dismiss"
        onClick={() => {
          prefs.set('installBannerDismissed', '1')
          setHidden(true)
        }}
      >
        <X size={18} aria-hidden="true" />
      </button>
    </aside>
  )
}
