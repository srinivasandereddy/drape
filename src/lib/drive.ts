// Google sign-in and Drive access for Drape. Drive access is limited to the hidden
// appDataFolder (`drive.appdata`), so the app cannot see any other Drive file.
// `openid email profile` tell Drape who is signed in, to keep each person's closet apart.

import type { Remote, RemoteFile } from './sync'

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata'
const SCOPES = `openid email profile ${DRIVE_SCOPE}`
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

type TokenResponse = { access_token?: string; expires_in?: number; scope?: string; error?: string; error_description?: string }
type TokenClient = { requestAccessToken: (opts?: { prompt?: string; login_hint?: string }) => void }
type GoogleGlobal = {
  accounts: {
    oauth2: {
      initTokenClient: (cfg: {
        client_id: string
        scope: string
        include_granted_scopes?: boolean
        callback: (r: TokenResponse) => void
        error_callback?: (e: { type: string; message?: string }) => void
      }) => TokenClient
      hasGrantedAllScopes: (r: TokenResponse, ...scopes: string[]) => boolean
      revoke: (token: string, done?: () => void) => void
    }
  }
}
declare global {
  interface Window {
    google?: GoogleGlobal
  }
}

export const hasClientId = Boolean(CLIENT_ID)

let scriptPromise: Promise<void> | null = null
function loadGoogleScript(): Promise<void> {
  if (window.google) return Promise.resolve()
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Could not load Google sign-in. Check your connection.'))
    document.head.appendChild(s)
  })
  return scriptPromise
}

type Token = { value: string; expiresAt: number; drive: boolean }
const TOKEN_KEY = 'drape.gtoken'

// Google access lasts about an hour. Keeping it across app restarts in that hour
// means sync keeps working when the phone reopens Drape; it is cleared on sign-out.
function loadToken(): Token | null {
  try {
    const t = JSON.parse(localStorage.getItem(TOKEN_KEY) ?? 'null') as Token | null
    return t && typeof t.value === 'string' && t.expiresAt > Date.now() ? t : null
  } catch {
    return null
  }
}
function saveToken(t: Token | null) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, JSON.stringify(t))
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* private mode: keep it in memory only */
  }
}

let token: Token | null = loadToken()

export const isSignedIn = () => Boolean(token && token.expiresAt > Date.now())
/** False if the person unticked Drive access on Google's consent screen. */
export const hasDriveAccess = () => Boolean(token?.drive)

function friendlyError(code: string): string {
  if (code === 'popup_closed' || code === 'popup_failed_to_open') return 'The Google window was closed before signing in. Try again.'
  if (code === 'access_denied') return 'Google sign-in was cancelled.'
  return `Google sign-in failed (${code}). Try again.`
}

/**
 * Opens Google's sign-in window and keeps a short-lived access token in memory.
 * `hint` pre-selects an account when signing in again.
 */
export async function signIn(hint?: string): Promise<void> {
  return requestToken(SCOPES, hint ? { prompt: '', login_hint: hint } : { prompt: 'select_account' })
}

/**
 * Asks Google for the Drive permission only. Used when the person left the Drive
 * box unticked on the first sign-in: Google then shows just that one question.
 */
export async function requestDriveAccess(hint?: string): Promise<void> {
  await requestToken(DRIVE_SCOPE, { prompt: 'consent', ...(hint ? { login_hint: hint } : {}) })
  if (!token?.drive) throw new Error('Drive access is still off. Tick the box for "See, create and delete its own configuration data in your Google Drive" to back up your closet.')
}

async function requestToken(scope: string, opts: { prompt?: string; login_hint?: string }): Promise<void> {
  if (!CLIENT_ID) throw new Error('Google sign-in is not set up in this build.')
  if (!navigator.onLine) throw new Error('You are offline. Connect to the internet to sign in.')
  await loadGoogleScript()
  await new Promise<void>((resolve, reject) => {
    const oauth = window.google!.accounts.oauth2
    const client = oauth.initTokenClient({
      client_id: CLIENT_ID,
      scope,
      // Keep earlier permissions (name, email) when asking for Drive later.
      include_granted_scopes: true,
      callback: (r) => {
        if (r.error || !r.access_token) return reject(new Error(r.error_description ?? friendlyError(r.error ?? 'unknown')))
        token = {
          value: r.access_token,
          expiresAt: Date.now() + (r.expires_in ?? 3600) * 1000 - 30_000,
          drive: oauth.hasGrantedAllScopes(r, DRIVE_SCOPE) || (r.scope ?? '').split(' ').includes(DRIVE_SCOPE),
        }
        saveToken(token)
        resolve()
      },
      error_callback: (e) => reject(new Error(friendlyError(e.type))),
    })
    client.requestAccessToken(opts)
  })
}

export interface GoogleUser {
  sub: string
  email: string
  name: string
  picture: string | null
}

/** Who is signed in. Needs the token from `signIn`. */
export async function fetchUser(): Promise<GoogleUser> {
  const res = await api('https://openidconnect.googleapis.com/v1/userinfo')
  const u = (await res.json()) as Record<string, unknown>
  if (typeof u.sub !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(u.sub)) throw new Error('Google did not say who is signed in. Try again.')
  return {
    sub: u.sub,
    email: typeof u.email === 'string' ? u.email : '',
    name: typeof u.name === 'string' ? u.name : typeof u.given_name === 'string' ? u.given_name : '',
    picture: typeof u.picture === 'string' && u.picture.startsWith('https://') ? u.picture : null,
  }
}

export function signOut() {
  const t = token?.value
  token = null
  saveToken(null)
  // Also tell Google, so the next sign-in shows the account picker again.
  if (t && window.google) window.google.accounts.oauth2.revoke(t)
}

/** Thrown when Google access has expired and the person must reconnect. */
export class NeedsSignIn extends Error {
  constructor() {
    super('Google access expired. Tap to reconnect.')
    this.name = 'NeedsSignIn'
  }
}

async function api(url: string, init: RequestInit = {}, attempt = 0): Promise<Response> {
  if (!isSignedIn()) throw new NeedsSignIn()
  let res: Response
  try {
    res = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token!.value}` } })
  } catch {
    throw new Error('No internet connection. Drape will sync when you are back online.')
  }
  if (res.status === 401) {
    token = null
    saveToken(null)
    throw new NeedsSignIn()
  }
  // Rate limits and server hiccups: wait and retry a few times.
  if ((res.status === 429 || res.status >= 500) && attempt < 3) {
    await new Promise((r) => setTimeout(r, 800 * 2 ** attempt))
    return api(url, init, attempt + 1)
  }
  if (!res.ok) throw new Error(`Google Drive replied ${res.status}. Try again later.`)
  return res
}

export type DriveFile = { id: string; name: string; modifiedTime: string }

export async function listFiles(): Promise<DriveFile[]> {
  const q = new URLSearchParams({
    spaces: 'appDataFolder',
    fields: 'files(id,name,modifiedTime)',
    orderBy: 'modifiedTime desc',
    pageSize: '100',
  })
  const res = await api(`https://www.googleapis.com/drive/v3/files?${q}`)
  return (await res.json()).files
}

export async function writeJson(name: string, data: unknown): Promise<DriveFile> {
  const boundary = 'drape' + Math.random().toString(36).slice(2)
  const meta = { name, parents: ['appDataFolder'] }
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(data)}\r\n--${boundary}--`
  const res = await api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  })
  return res.json()
}

export async function readJson<T>(id: string): Promise<T> {
  const res = await api(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`)
  return res.json()
}

// ---------- the Remote used by sync ----------


const FILES = 'https://www.googleapis.com/drive/v3/files'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files'

function multipart(meta: object, body: Blob | object): { body: Blob; type: string } {
  const boundary = 'drape' + Math.random().toString(36).slice(2)
  const content = body instanceof Blob ? body : new Blob([JSON.stringify(body)], { type: 'application/json' })
  return {
    type: `multipart/related; boundary=${boundary}`,
    body: new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n`,
      `--${boundary}\r\nContent-Type: ${content.type || 'application/octet-stream'}\r\n\r\n`,
      content,
      `\r\n--${boundary}--`,
    ]),
  }
}

const toRemote = (f: { id: string; name: string; appProperties?: { u?: string } }): RemoteFile => ({ id: f.id, name: f.name, updatedAt: f.appProperties?.u ?? '' })

/** Drape's hidden appDataFolder, as a sync Remote. */
export const driveRemote: Remote = {
  async list() {
    const out: RemoteFile[] = []
    let pageToken: string | undefined
    do {
      const q = new URLSearchParams({ spaces: 'appDataFolder', fields: 'nextPageToken,files(id,name,appProperties)', pageSize: '1000' })
      if (pageToken) q.set('pageToken', pageToken)
      const data = (await (await api(`${FILES}?${q}`)).json()) as { nextPageToken?: string; files: { id: string; name: string; appProperties?: { u?: string } }[] }
      out.push(...data.files.map(toRemote))
      pageToken = data.nextPageToken
    } while (pageToken)
    return out
  },
  async getJson(id) {
    return (await api(`${FILES}/${id}?alt=media`)).json()
  },
  async getBlob(id) {
    return (await api(`${FILES}/${id}?alt=media`)).blob()
  },
  async put(name, body, updatedAt, existingId) {
    const meta = existingId ? { appProperties: { u: updatedAt } } : { name, parents: ['appDataFolder'], appProperties: { u: updatedAt } }
    const m = multipart(meta, body)
    const url = existingId ? `${UPLOAD}/${existingId}?uploadType=multipart&fields=id,name,appProperties` : `${UPLOAD}?uploadType=multipart&fields=id,name,appProperties`
    const res = await api(url, { method: existingId ? 'PATCH' : 'POST', headers: { 'Content-Type': m.type }, body: m.body })
    return toRemote(await res.json())
  },
  async remove(id) {
    try {
      await api(`${FILES}/${id}`, { method: 'DELETE' })
    } catch (e) {
      // Already gone (e.g. removed by another phone): that's fine.
      if (!(e instanceof Error && e.message.includes('404'))) throw e
    }
  },
}
