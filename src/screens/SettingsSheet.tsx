import { useEffect, useState } from 'react'
import { Sheet } from '../components/Sheet'
import { HowItWorksSheet } from './HowItWorksSheet'
import type { WizardStep } from '../lib/wizardSteps'
import { useToast } from '../components/toastContext'
import { allowDrive, deleteDrapeAccount, reconnect, removeAccountFromPhone, resetProfile, signOutAccount, useAccount } from '../lib/account'
import { deleteEverything, removeSamples, useCloset } from '../lib/closet'
import { storageEstimate } from '../lib/db'
import { doshaLabel } from '../lib/dosha'
import { APP_VERSION, isStandalone } from '../lib/platform'
import { syncNow, useSync } from '../lib/syncStore'
import { bodyShapeDef, seasonFor, SEASONS, SKIN_TONES } from '../lib/personal'
import { metalLabel, money, routineDef, THEMES, useProfile } from '../lib/profile'
import { styleDef } from '../lib/styles'
import { cityLabel } from '../lib/weather'
import { readReminder, reminderSupport, testReminder, turnOffReminder, turnOnReminder, updateReminder } from '../lib/reminder'

type Props = { onClose: () => void; onEditProfile: (step?: WizardStep) => void }

export function SettingsSheet({ onClose, onEditProfile }: Props) {
  const toast = useToast()
  const account = useAccount()
  const { garments } = useCloset()
  const { profile } = useProfile()
  const [storage, setStorage] = useState<{ usedMb: number; quotaMb: number } | null>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<'profile' | 'wipe' | 'remove' | 'account' | null>(null)
  const [typed, setTyped] = useState('')
  const [progress, setProgress] = useState<string | null>(null)
  const [howOpen, setHowOpen] = useState(false)
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
    }
  }

  const edit = (step: WizardStep) => {
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
    ['Metal', metalLabel(profile)],
    ['Skin tone', profile.skinTone ? `${SKIN_TONES.find((s) => s.id === profile.skinTone)!.label}${profile.undertone ? `, ${profile.undertone} undertone` : ''}` : null],
    ['Color season', (() => {
      const s = seasonFor(profile.skinTone, profile.undertone, profile.hair, profile.eyes)
      return s ? SEASONS[s].label : null
    })()],
    ['Body shape', bodyShapeDef(profile.bodyShape)?.label ?? null],
    ['Favourite colors', profile.favoriteColors.length ? profile.favoriteColors.join(', ') : null],
    ['Never wear', profile.avoidColors.length ? profile.avoidColors.join(', ') : null],
    ['Sizes', [profile.sizes.top && `Top ${profile.sizes.top}`, profile.sizes.bottom && `Bottom ${profile.sizes.bottom}`, profile.sizes.shoe && `Shoe ${profile.sizes.shoe}`].filter(Boolean).join(' · ') || null],
    ['Usual spend', profile.budget ? money(profile, profile.budget) : null],
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
            <button type="button" className="btn primary" onClick={() => edit('about')}>
              Edit profile
            </button>
            <button type="button" className="btn" onClick={() => edit('body')}>
              {profile.dosha ? 'Dosha result' : 'Take dosha quiz'}
            </button>
            <button type="button" className="btn" onClick={() => edit('look')}>
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
          <p className="muted small">Your closet is kept on this phone and backed up to your own Google Drive.</p>
        </section>

        <SyncCard />

        <ReminderCard />

        <section className="card stack-sm" aria-labelledby="s-how">
          <h2 id="s-how">How Drape picks outfits</h2>
          <p className="muted small">What it looks at, how each outfit is scored, and how your feedback changes it.</p>
          <button type="button" className="btn" onClick={() => setHowOpen(true)}>
            Read the guide
          </button>
        </section>
        {howOpen && <HowItWorksSheet onClose={() => setHowOpen(false)} />}

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
              <button type="button" className="btn danger-ghost" onClick={() => setConfirm('profile')}>
                Reset my profile
              </button>
              <button type="button" className="btn danger-ghost" onClick={() => setConfirm('wipe')} disabled={garments.length === 0}>
                Delete my whole closet
              </button>
              <button type="button" className="btn danger-ghost" onClick={() => setConfirm('remove')}>
                Remove my account from this phone
              </button>
              <button
                type="button"
                className="btn danger-ghost"
                onClick={() => {
                  setTyped('')
                  setConfirm('account')
                }}
              >
                Delete my Drape account
              </button>
            </div>
          )}
          {confirm === 'profile' && (
            <div className="confirm" role="alert">
              <p>Clear your name, age, gender, height, weight, city, routine, styles, metal, dosha result and app colors? Your clothes, trips and history stay. The setup wizard will start again, and the reset reaches your other phones too.</p>
              <div className="row-actions">
                <button type="button" className="btn" onClick={() => setConfirm(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn danger"
                  disabled={busy}
                  onClick={() =>
                    void run('Reset', async () => {
                      await resetProfile()
                      setConfirm(null)
                      onClose()
                      toast('Profile reset')
                    })
                  }
                >
                  Reset profile
                </button>
              </div>
            </div>
          )}
          {confirm === 'account' && (
            <div className="confirm" role="alert">
              <p>
                <b>This permanently deletes everything</b>: your profile, all pieces and photos, trips, outfit history and feedback, from this phone and from
                your Google Drive backup. Drape is also disconnected from your Google account and you are signed out. This cannot be undone.
              </p>
              <p className="small">Other phones keep what they have until you remove Drape there (Settings → Remove my account from this phone).</p>
              <label className="field-label" htmlFor="confirm-delete">
                Type <b>delete</b> to confirm
              </label>
              <input id="confirm-delete" className="text-input" value={typed} autoComplete="off" autoCapitalize="none" onChange={(e) => setTyped(e.target.value)} />
              {progress && <p className="small">{progress}</p>}
              <div className="row-actions">
                <button type="button" className="btn" disabled={busy} onClick={() => setConfirm(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn danger"
                  disabled={busy || typed.trim().toLowerCase() !== 'delete'}
                  onClick={() =>
                    void run('Delete account', async () => {
                      setProgress('Deleting your Drive backup…')
                      await deleteDrapeAccount((done, total) => setProgress(`Deleting your Drive backup… ${done} of ${total}`))
                      setProgress(null)
                      onClose()
                    }).finally(() => setProgress(null))
                  }
                >
                  Delete forever
                </button>
              </div>
            </div>
          )}
          {confirm === 'wipe' && (
            <div className="confirm" role="alert">
              <p>Delete all {garments.length} pieces, photos, trips, outfit history and feedback? This removes them from all your phones and from your Drive backup, and cannot be undone.</p>
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
                      await deleteEverything()
                      setConfirm(null)
                      toast('Your closet was deleted')
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
              <p>Sign out and remove your closet from this phone only? Useful before handing the phone to someone else. Your Drive backup stays, and your closet comes back when you sign in again. Anything not yet synced is lost.</p>
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

        <p className="muted small center">
          Drape {APP_VERSION} ·{' '}
          <a href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noopener">
            Privacy policy
          </a>
        </p>
      </div>
    </Sheet>
  )
}

function SyncCard() {
  const toast = useToast()
  const s = useSync()
  const [busy, setBusy] = useState(false)
  const when = s.lastSyncAt ? new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(s.lastSyncAt)) : null

  async function go(fn: () => Promise<unknown>) {
    setBusy(true)
    try {
      await fn()
      await syncNow()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Sync failed.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card stack-sm" aria-labelledby="s-sync">
      <h2 id="s-sync">Sync and backup</h2>
      <p className="muted small">Your pieces, photos, profile, trips and history are copied to a private Drape folder in your Google Drive, so every phone you sign in on shows the same closet.</p>
      <div className="kv">
        <span>Status</span>
        <b>
          {s.status === 'syncing'
            ? `Syncing${s.total ? ` ${s.done} of ${s.total}` : '…'}`
            : s.status === 'paused'
              ? 'Paused'
              : s.status === 'needs-drive'
                ? 'Drive backup is off'
              : s.status === 'offline'
                ? 'Offline'
                : s.status === 'error'
                  ? 'Problem'
                  : s.lastSyncAt
                    ? 'Up to date'
                    : 'Not synced yet'}
        </b>
      </div>
      {when && (
        <div className="kv">
          <span>Last synced</span>
          <b>{when}</b>
        </div>
      )}
      {s.message && <p className={s.status === 'error' ? 'error-text' : 'muted small'}>{s.message}</p>}
      {s.status === 'needs-drive' ? (
        <>
          <button type="button" className="btn primary" disabled={busy} onClick={() => void go(allowDrive)}>
            Allow Drive backup
          </button>
          <p className="muted small">Google will ask one question: tick the box that lets Drape use its own hidden folder in your Drive. Drape can't see any of your other files.</p>
        </>
      ) : s.status === 'paused' ? (
        <button type="button" className="btn primary" disabled={busy} onClick={() => void go(reconnect)}>
          Reconnect to Google
        </button>
      ) : (
        <button type="button" className="btn" disabled={busy || s.status === 'syncing'} onClick={() => void go(async () => {})}>
          Sync now
        </button>
      )}
      <p className="muted small">Google access lasts about an hour at a time. When it runs out, Drape pauses syncing until you tap Reconnect; nothing is lost.</p>
    </section>
  )
}

const HOURS = [5, 6, 7, 8, 9, 10]

/** Morning outfit reminder: Android (installed app) only; iPhones get a Shortcuts tip. */
function ReminderCard() {
  const toast = useToast()
  const { profile } = useProfile()
  const [on, setOn] = useState<boolean | null>(null)
  const [hour, setHour] = useState(7)
  const [busy, setBusy] = useState(false)
  const support = reminderSupport()
  const iphone = /iPhone|iPad|iPod/.test(navigator.userAgent)
  const details = (h: number) => ({ hour: h, name: profile.name.split(' ')[0] ?? '', latitude: profile.city?.latitude ?? null, longitude: profile.city?.longitude ?? null })

  useEffect(() => {
    void readReminder().then((r) => {
      setOn(r.enabled)
      setHour(r.hour)
    })
  }, [])

  async function toggle() {
    setBusy(true)
    try {
      if (on) {
        await turnOffReminder()
        setOn(false)
      } else {
        await turnOnReminder(details(hour))
        setOn(true)
        toast(`Reminder on for about ${hour}:00 each morning`)
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not change the reminder.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card stack-sm" aria-labelledby="s-remind">
      <h2 id="s-remind">Morning reminder</h2>
      {support === 'yes' ? (
        <>
          <p className="muted small">A notification each morning with the weather, so today's outfit is ready when you are. On this phone only.</p>
          <div className="field">
            <label className="field-label" htmlFor="remind-hour">
              Around
            </label>
            <select
              id="remind-hour"
              className="text-input"
              value={hour}
              onChange={(e) => {
                const h = Number(e.target.value)
                setHour(h)
                void updateReminder(details(h))
              }}
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {h}:00
                </option>
              ))}
            </select>
          </div>
          <div className="row-actions">
            <button type="button" className={on ? 'btn' : 'btn primary'} disabled={busy || on === null} onClick={() => void toggle()}>
              {on ? 'Turn off' : 'Turn on'}
            </button>
            {on && (
              <button type="button" className="btn" onClick={() => void testReminder(details(hour).name).catch((e: unknown) => toast(e instanceof Error ? e.message : 'Could not send a test.', 'error'))}>
                Send a test
              </button>
            )}
          </div>
          <p className="muted small">Android decides the exact time to save battery, so it may arrive a little after {hour}:00.</p>
        </>
      ) : support === 'install-first' ? (
        <p className="muted small">Open Drape from your home screen to turn on a morning reminder.</p>
      ) : iphone ? (
        <div className="stack-sm">
          <p className="muted small">iPhones only let web apps send scheduled notifications through a paid push server, so Drape can't do it by itself. A free way with the Shortcuts app:</p>
          <ol className="why-mini">
            <li>Open Shortcuts → Automation → New Automation → Time of Day.</li>
            <li>Pick your time, choose Daily and Run Immediately.</li>
            <li>Add the action Show Notification with the text “Check Drape for today’s outfit”.</li>
          </ol>
        </div>
      ) : (
        <p className="muted small">This browser can't schedule reminders. Use Chrome on Android with Drape added to the home screen.</p>
      )}
    </section>
  )
}
