// Who is using Drape on this phone. Each Google account has its own database,
// its own preferences and (from v0.5) its own Drive folder.

import { useSyncExternalStore } from 'react'
import { resetClosetStore } from './closet'
import { closeDb, deleteAccountDb, selectAccountDb } from './db'
import { fetchUser, signIn, signOut as driveSignOut, type GoogleUser } from './drive'
import { prefs } from './platform'
import { resetProfileStore } from './profile'
import { resetTripsStore } from './trips'

export type Account = GoogleUser

function readSaved(): Account | null {
  try {
    const raw = prefs.get('account')
    if (!raw) return null
    const a = JSON.parse(raw) as Partial<Account>
    if (typeof a.sub !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(a.sub)) return null
    return { sub: a.sub, email: String(a.email ?? ''), name: String(a.name ?? ''), picture: typeof a.picture === 'string' ? a.picture : null }
  } catch {
    return null
  }
}

let current: Account | null = readSaved()
selectAccountDb(current?.sub ?? null)
const listeners = new Set<() => void>()

function switchTo(next: Account | null) {
  if (next?.sub !== current?.sub) {
    selectAccountDb(next?.sub ?? null)
    resetClosetStore()
    resetProfileStore()
    resetTripsStore()
  }
  current = next
  if (next) prefs.set('account', JSON.stringify(next))
  else prefs.remove('account')
  for (const l of listeners) l()
}

export function useAccount(): Account | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
  )
}

export const currentAccount = () => current

/** Signs in with Google and opens that person's closet. */
export async function signInAccount(): Promise<Account> {
  await signIn()
  const user = await fetchUser()
  switchTo(user)
  return user
}

/** Renews Google access for the account already open (needed for Drive). */
export async function reconnect(): Promise<void> {
  if (!current) throw new Error('Nobody is signed in.')
  await signIn(current.email)
  const user = await fetchUser()
  if (user.sub !== current.sub) {
    driveSignOut()
    throw new Error(`That was ${user.email}. Drape is open for ${current.email}; sign out first to switch.`)
  }
  switchTo(user) // refresh name and photo
}

/** Closes this person's closet on this phone. Their data stays for next time. */
export function signOutAccount() {
  driveSignOut()
  closeDb()
  switchTo(null)
}

/** Signs out and deletes this person's closet from this phone (not from their Drive). */
export async function removeAccountFromPhone(): Promise<void> {
  const sub = current?.sub
  signOutAccount()
  if (sub) {
    await deleteAccountDb(sub)
    for (const k of ['today', 'occasion']) prefs.remove(`${sub}.${k}`)
  }
}

/** Preferences that belong to the signed-in person, not the phone. */
export const accountPrefs = {
  get: (key: string) => (current ? prefs.get(`${current.sub}.${key}`) : null),
  set: (key: string, value: string) => {
    if (current) prefs.set(`${current.sub}.${key}`, value)
  },
}

/**
 * Local development only: open a closet for a made-up person without Google,
 * to test that two people's closets stay apart. Removed from real builds.
 */
export function devSignIn(name: string) {
  if (!import.meta.env.DEV) throw new Error('Test sign-in only exists in development.')
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '')
  switchTo({ sub: `dev-${slug}`, email: `${slug}@example.test`, name, picture: null })
}
