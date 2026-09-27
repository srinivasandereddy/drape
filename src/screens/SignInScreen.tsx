import { useState } from 'react'
import { devSignIn, signInAccount } from '../lib/account'
import { hasClientId } from '../lib/drive'

/** First screen: each person signs in with their own Google account and sees only their own closet. */
export function SignInScreen() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function go() {
    setBusy(true)
    setError(null)
    try {
      await signInAccount()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed. Try again.')
      setBusy(false)
    }
  }

  return (
    <main className="signin">
      <div className="signin-strip" aria-hidden="true">
        {['#1F2A44', '#B5502D', '#C9B48F', '#6B7040', '#ECEBE6', '#3A3D42', '#B83B5E'].map((c) => (
          <i key={c} style={{ background: c }} />
        ))}
      </div>
      <h1 className="signin-title">Drape</h1>
      <p className="signin-lede">Your wardrobe, your colors, and an outfit for today that fits your weather, your plans and your style.</p>
      <button type="button" className="btn primary block" onClick={() => void go()} disabled={busy || !hasClientId}>
        {busy ? 'Opening Google…' : 'Sign in with Google'}
      </button>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {!hasClientId && <p className="error-text">Google sign-in is not set up in this build.</p>}
      {import.meta.env.DEV && (
        <div className="row-actions">
          <button type="button" className="btn" onClick={() => devSignIn('Maanya')}>
            Test user: Maanya
          </button>
          <button type="button" className="btn" onClick={() => devSignIn('Maanvi')}>
            Test user: Maanvi
          </button>
        </div>
      )}
      <ul className="signin-points small muted">
        <li>Your closet is private to your Google account. Someone else signing in on another phone sees only theirs.</li>
        <li>Drape asks Google for your name and email, and for its own hidden folder in your Drive. It cannot see your other files.</li>
        <li>Photos stay on your phone and in your own Drive. No ads, no tracking.</li>
      </ul>
    </main>
  )
}
