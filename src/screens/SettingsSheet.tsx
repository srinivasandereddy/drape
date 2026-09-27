import { useEffect, useState } from 'react'
import { ChoiceChips } from '../components/Chips'
import { CitySearch } from '../components/CitySearch'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/toastContext'
import { useCloset, wipeLocalData } from '../lib/closet'
import { storageEstimate } from '../lib/db'
import { hasClientId, isSignedIn, listFiles, signIn, signOut, writeJson } from '../lib/drive'
import { APP_VERSION, isStandalone } from '../lib/platform'
import { ROUTINES, saveProfile, useProfile, type RoutineId } from '../lib/profile'
import { cityLabel } from '../lib/weather'

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  const { garments } = useCloset()
  const [storage, setStorage] = useState<{ usedMb: number; quotaMb: number } | null>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [signed, setSigned] = useState(isSignedIn())
  const [driveFiles, setDriveFiles] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmWipe, setConfirmWipe] = useState(false)
  const { profile } = useProfile()
  const [changingCity, setChangingCity] = useState(false)

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
      setSigned(isSignedIn())
    }
  }

  const standalone = isStandalone()

  return (
    <Sheet title="Settings" onClose={onClose}>
      <div className="stack">
        <section className="card stack" aria-labelledby="s-you">
          <h2 id="s-you">Your details</h2>
          {profile.city && !changingCity ? (
            <div className="kv">
              <span>City</span>
              <button type="button" className="link" onClick={() => setChangingCity(true)}>
                {cityLabel(profile.city)} · Change
              </button>
            </div>
          ) : (
            <CitySearch
              onSelect={(city) =>
                void run('City', async () => {
                  await saveProfile({ city })
                  setChangingCity(false)
                  toast('City saved')
                })
              }
            />
          )}
          <ChoiceChips<RoutineId>
            label="Normal weekday"
            options={ROUTINES.map((r) => ({ value: r.id, label: r.label }))}
            value={profile.routine}
            onChange={(routine) => routine && void run('Routine', () => saveProfile({ routine }))}
          />
          <p className="muted small">
            Weather comes from Open-Meteo, a free service. Only your city's map position is sent, never your name, photos or
            closet.
          </p>
        </section>

        <section className="card stack-sm" aria-labelledby="s-phone">
          <h2 id="s-phone">This phone</h2>
          <div className="kv">
            <span>Opened as</span>
            <b>{standalone ? 'Home-screen app' : 'Browser tab'}</b>
          </div>
          <div className="kv">
            <span>Pieces saved here</span>
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
          <p className="muted small">
            Until sync arrives, your closet lives only on this phone. Syncing to Google Drive comes in a later update.
          </p>
        </section>

        <section className="card stack-sm" aria-labelledby="s-drive">
          <h2 id="s-drive">Google Drive connection test</h2>
          <p className="muted small">Checks that this phone can reach Drape's private Drive folder. Your closet is not uploaded yet.</p>
          {!hasClientId ? (
            <p className="error-text">Google sign-in is not configured in this build.</p>
          ) : !signed ? (
            <button type="button" className="btn" disabled={busy} onClick={() => run('Sign in', signIn)}>
              Sign in with Google
            </button>
          ) : (
            <div className="row-actions">
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() =>
                  run('Drive test', async () => {
                    await writeJson(`test-${Date.now()}.json`, { from: 'Drape settings', at: new Date().toISOString() })
                    const files = await listFiles()
                    setDriveFiles(files.length)
                    toast('Drive connection works')
                  })
                }
              >
                Test connection
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  signOut()
                  setSigned(false)
                  setDriveFiles(null)
                }}
              >
                Sign out
              </button>
            </div>
          )}
          {driveFiles !== null && <p className="muted small">Files in Drape's Drive folder: {driveFiles}</p>}
        </section>

        <section className="card stack-sm" aria-labelledby="s-danger">
          <h2 id="s-danger">Start over</h2>
          {!confirmWipe ? (
            <button type="button" className="btn danger-ghost" onClick={() => setConfirmWipe(true)} disabled={garments.length === 0}>
              Delete everything on this phone
            </button>
          ) : (
            <div className="confirm" role="alert">
              <p>
                Delete all {garments.length} pieces and photos from this phone? This cannot be undone. Your Google Drive is not
                touched.
              </p>
              <div className="row-actions">
                <button type="button" className="btn" onClick={() => setConfirmWipe(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn danger"
                  disabled={busy}
                  onClick={() =>
                    run('Delete', async () => {
                      await wipeLocalData()
                      setConfirmWipe(false)
                      toast('Everything on this phone was deleted')
                    })
                  }
                >
                  Delete everything
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
