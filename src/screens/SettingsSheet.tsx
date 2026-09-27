import { useEffect, useState } from 'react'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/toastContext'
import { reconnect, removeAccountFromPhone, signOutAccount, useAccount } from '../lib/account'
import { removeSamples, useCloset, wipeLocalData } from '../lib/closet'
import { storageEstimate } from '../lib/db'
import { doshaLabel } from '../lib/dosha'
import { hasDriveAccess, isSignedIn, listFiles, writeJson } from '../lib/drive'
import { APP_VERSION, isStandalone } from '../lib/platform'
import { metalLabel, MODESTY_LABELS, routineDef, THEMES, useProfile } from '../lib/profile'
import { styleDef } from '../lib/styles'
import { cityLabel } from '../lib/weather'

type Props = { onClose: () => void; onEditProfile: (step?: number) => void }

export function SettingsSheet({ onClose, onEditProfile }: Props) {
  const toast = useToast()
  const account = useAccount()
  const { garments } = useCloset()
  const { profile } = useProfile()
  const [storage, setStorage] = useState<{ usedMb: number; quotaMb: number } | null>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [online, setOnline] = useState(isSignedIn())
  const [driveFiles, setDriveFiles] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<'wipe' | 'remove' | null>(null)
  const samples = garments.filter((g) => g.source === 'sample').length

  useEffect(() => {
    void storageEstimate().then(setStorage)
    navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(null))
  }, [])

  async function run(label: string, fn: () => Promise<unknown>) {
    if (busy) return
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      toast(`${label}: ${e instanceof Error ? e.message : 'failed'}`, 'error')
    } finally {
      setBusy(false)
      setOnline(isSignedIn())
    }
  }

  const edit = (step: number) => {
    onClose()
    onEditProfile(step)
  }

  const gender = profile.gender.kind === 'other' ? profile.gender.custom || 'Non-binary / other' : profile.gender.kind === 'female' ? 'Female' : profile.gender.kind === 'male' ? 'Male' : null
  const rows: [string, string | null][] = [
    ['Name', profile.name || null],
    ['Age', profile.age ? String(profile.age) : null],
    ['Gender', gender],
    ['Height / weight', profile.heightCm || profile.weightKg ? [profile.heightCm && `${profile.heightCm} cm`, profile.weightKg && `${profile.weightKg} kg`].filter(Boolean).join(' · ') : null],
    ['City', profile.city ? cityLabel(profile.city) : null],
    ['Weekday', routineDef(profile.routine)?.label ?? null],
    ['Styles', profile.styles.length ? profile.styles.map((s) => styleDef(s).label).join(', ') : null],
    ['Coverage', MODESTY_LABELS[profile.modesty]],
    ['Metal', metalLabel(profile)],
    ['Dosha', profile.dosha ? doshaLabel(profile.dosha) : null],
    ['Colors', THEMES.find((t) => t.id === profile.theme)?.label ?? null],
  ]

  return (
    <Sheet title="Settings" onClose={onClose}>
      <div className="stack">
        {account && (
          <section className="card stack-sm account-card" aria-label="Your account">
            <div className="account-row">
              {account.picture && <img className="avatar" src={account.picture} alt="" referrerPolicy="no-referrer" />}
              <div>
                <b>{account.name || 'Signed in'}</b>
                <p className="muted small">{account.email}</p>
              </div>
            </div>
            <p className="muted small">Your closet is private to this Google account. Other people signing in see only their own.</p>
            <div className="row-actions">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  onClose()
                  signOutAccount()
                }}
              >
                Sign out
              </button>
            </div>
          </section>
        )}

        <section className="card stack-sm" aria-labelledby="s-you">
          <h2 id="s-you">Your profile</h2>
          <dl className="details">
            {rows.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd className={v ? '' : 'muted'}>{v ?? 'Not set'}</dd>
              </div>
            ))}
          </dl>
          <div className="row-actions">
            <button type="button" className="btn primary" onClick={() => edit(0)}>
              Edit profile
            </button>
            <button type="button" className="btn" onClick={() => edit(3)}>
              {profile.dosha ? 'Dosha result' : 'Take dosha quiz'}
            </button>
            <button type="button" className="btn" onClick={() => edit(4)}>
              App colors
            </button>
          </div>
          <p className="muted small">Weather comes from Open-Meteo, a free service. Only your city's map position is sent, never your name, photos or closet.</p>
        </section>

        <section className="card stack-sm" aria-labelledby="s-phone">
          <h2 id="s-phone">This phone</h2>
          <div className="kv">
            <span>Opened as</span>
            <b>{isStandalone() ? 'Home-screen app' : 'Browser tab'}</b>
          </div>
          <div className="kv">
            <span>Your pieces here</span>
            <b className="mono">{garments.length}</b>
          </div>
          <div className="kv">
            <span>Storage used</span>
            <b className="mono">{storage ? `${storage.usedMb.toFixed(1)} MB` : '—'}</b>
          </div>
          <div className="kv">
            <span>Protected from clean-up</span>
            <b>{persisted === null ? 'Unknown' : persisted ? 'Yes' : 'Not yet'}</b>
          </div>
          <p className="muted small">Until sync arrives (next update), your closet lives only on this phone.</p>
        </section>

        <section className="card stack-sm" aria-labelledby="s-drive">
          <h2 id="s-drive">Google Drive connection</h2>
          <p className="muted small">Checks that this phone can reach Drape's private folder in your Drive. Your closet is not uploaded yet.</p>
          {!online ? (
            <button type="button" className="btn" disabled={busy} onClick={() => void run('Connect', reconnect)}>
              Connect to Google Drive
            </button>
          ) : !hasDriveAccess() ? (
            <p className="error-text">Drive access was not allowed at sign-in. Sign out and in again, and keep the Drive box ticked.</p>
          ) : (
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() =>
                void run('Drive test', async () => {
                  await writeJson(`test-${Date.now()}.json`, { from: 'Drape settings', at: new Date().toISOString() })
                  const files = await listFiles()
                  setDriveFiles(files.length)
                  toast('Drive connection works')
                })
              }
            >
              Test connection
            </button>
          )}
          {driveFiles !== null && <p className="muted small">Files in Drape's Drive folder: {driveFiles}</p>}
        </section>

        {samples > 0 && (
          <section className="card stack-sm" aria-labelledby="s-samples">
            <h2 id="s-samples">Sample pieces</h2>
            <p className="muted small">
              {samples} sample piece{samples === 1 ? '' : 's'} in your closet.
            </p>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() =>
                void run('Samples', async () => {
                  const n = await removeSamples()
                  toast(`Removed ${n} sample piece${n === 1 ? '' : 's'}`)
                })
              }
            >
              Remove sample pieces
            </button>
          </section>
        )}

        <section className="card stack-sm" aria-labelledby="s-danger">
          <h2 id="s-danger">Start over</h2>
          {confirm === null && (
            <div className="stack-sm">
              <button type="button" className="btn danger-ghost" onClick={() => setConfirm('wipe')} disabled={garments.length === 0}>
                Delete my closet on this phone
              </button>
              <button type="button" className="btn danger-ghost" onClick={() => setConfirm('remove')}>
                Remove my account from this phone
              </button>
            </div>
          )}
          {confirm === 'wipe' && (
            <div className="confirm" role="alert">
              <p>Delete all {garments.length} pieces, photos, outfit history and feedback from this phone? This cannot be undone. Your Google Drive is not touched.</p>
              <div className="row-actions">
                <button type="button" className="btn" onClick={() => setConfirm(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn danger"
                  disabled={busy}
                  onClick={() =>
                    void run('Delete', async () => {
                      await wipeLocalData()
                      setConfirm(null)
                      toast('Your closet on this phone was deleted')
                    })
                  }
                >
                  Delete everything
                </button>
              </div>
            </div>
          )}
          {confirm === 'remove' && (
            <div className="confirm" role="alert">
              <p>Sign out and delete your closet, profile and history from this phone? Useful before handing the phone to someone else. Your Google Drive is not touched.</p>
              <div className="row-actions">
                <button type="button" className="btn" onClick={() => setConfirm(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn danger"
                  disabled={busy}
                  onClick={() =>
                    void run('Remove', async () => {
                      onClose()
                      await removeAccountFromPhone()
                    })
                  }
                >
                  Remove from this phone
                </button>
              </div>
            </div>
          )}
        </section>

        <p className="muted small center">Drape {APP_VERSION}</p>
      </div>
    </Sheet>
  )
}
