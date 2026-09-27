// Runs sync at the right moments and tells the screens how it is going:
// after sign-in, when the app comes back on screen, and a few seconds after any change.

import { useSyncExternalStore } from 'react'
import { onChange } from './changes'
import { reload } from './closet'
import { driveRemote, hasDriveAccess, isSignedIn, NeedsSignIn } from './drive'
import { prefs } from './platform'
import { reloadProfile } from './profile'
import { syncOnce } from './sync'
import { reloadTrips } from './trips'

export type SyncStatus = 'idle' | 'syncing' | 'paused' | 'offline' | 'error'

export interface SyncState {
  status: SyncStatus
  done: number
  total: number
  lastSyncAt: string | null
  message: string | null
  /** Changes made on this phone since the last successful sync. */
  pending: boolean
  /** The first sync attempt for this account has finished (any outcome). */
  firstDone: boolean
}

let account: string | null = null
let state: SyncState = { status: 'idle', done: 0, total: 0, lastSyncAt: null, message: null, pending: false, firstDone: false }
const listeners = new Set<() => void>()
function set(patch: Partial<SyncState>) {
  state = { ...state, ...patch }
  for (const l of listeners) l()
}

export function useSync(): SyncState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

let running: Promise<void> | null = null
let again = false

/** Syncs now (or right after the current sync finishes). Safe to call often. */
export function syncNow(): Promise<void> {
  if (!account) {
    set({ firstDone: true })
    return Promise.resolve()
  }
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    try {
      do {
        again = false
        if (!isSignedIn()) {
          set({ status: 'paused', message: 'Reconnect to Google to sync.' })
          return
        }
        if (!hasDriveAccess()) {
          set({ status: 'error', message: 'Drive access was not allowed. Sign out and in again, keeping the Drive box ticked.' })
          return
        }
        if (!navigator.onLine) {
          set({ status: 'offline', message: 'Offline. Changes will sync when you are back online.' })
          return
        }
        set({ status: 'syncing', done: 0, total: 0, message: null, pending: false })
        const r = await syncOnce(driveRemote, (done, total) => set({ done, total }))
        if (r.downloaded > 0) await Promise.all([reload(), reloadProfile(), reloadTrips()])
        const at = new Date().toISOString()
        prefs.set(`${account}.lastSync`, at)
        set({ status: 'idle', lastSyncAt: at, message: null })
      } while (again)
    } catch (e) {
      if (e instanceof NeedsSignIn) set({ status: 'paused', message: e.message, pending: true })
      else set({ status: navigator.onLine ? 'error' : 'offline', message: e instanceof Error ? e.message : 'Sync failed.', pending: true })
    } finally {
      running = null
      if (!state.firstDone) set({ firstDone: true })
    }
  })()
  return running
}

let timer: ReturnType<typeof setTimeout> | null = null
function soon(ms = 4000) {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    void syncNow()
  }, ms)
}

let wired = false
function wire() {
  if (wired) return
  wired = true
  onChange(() => {
    set({ pending: true })
    soon()
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    const last = state.lastSyncAt ? Date.parse(state.lastSyncAt) : 0
    if (Date.now() - last > 2 * 60 * 1000 || state.pending) soon(500)
  })
  window.addEventListener('online', () => soon(500))
}

/** Called when a person's closet opens: remember who, and sync straight away. */
export function startSync(sub: string | null) {
  wire()
  account = sub
  if (timer) clearTimeout(timer)
  set({ status: 'idle', done: 0, total: 0, message: null, pending: false, firstDone: false, lastSyncAt: sub ? prefs.get(`${sub}.lastSync`) : null })
  if (sub) soon(300)
}
